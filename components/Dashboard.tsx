import React, { useMemo, Suspense, lazy } from 'react';
import { Account, Transaction, TransactionType, AccountType, Goal } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue } from '../services/financialLogic';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { Loader2 } from 'lucide-react';

// Sub-components (Critical: Loaded immediately)
import { FinancialProjectionCard } from './dashboard/FinancialProjectionCard';
import { SummaryCards } from './dashboard/SummaryCards';
import { UpcomingBills } from './dashboard/UpcomingBills';

import { DashboardSkeleton } from '../components/ui/Skeleton';

// Performance: Lazy Load Charts to improve LCP
const CashFlowChart = lazy(() => import('./dashboard/CashFlowChart').then(m => ({ default: m.CashFlowChart })));
const CategorySpendingChart = lazy(() => import('./dashboard/CategorySpendingChart').then(m => ({ default: m.CategorySpendingChart })));

interface DashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    goals?: Goal[];
    currentDate?: Date;
    showValues: boolean;
    onEditRequest?: (id: string) => void;
    isLoading?: boolean;
}

const ChartSkeleton = () => (
    <div className="w-full h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ accounts, transactions, goals = [], currentDate = new Date(), showValues, onEditRequest, isLoading = false }) => {
    if (isLoading) {
        return <DashboardSkeleton />;
    }
    const selectedYear = currentDate.getFullYear();

    // --- FINANCIAL LOGIC INTEGRATION ---
    // 1. Calculate Projection
    const { currentBalance, projectedBalance, pendingIncome, pendingExpenses } = useMemo(() =>
        calculateProjectedBalance(accounts, transactions, currentDate),
        [accounts, transactions, currentDate]);

    // 2. Filter Transactions for Charts
    const monthlyTransactions = useMemo(() =>
        transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .filter(t => isSameMonth(t.date, currentDate)),
        [transactions, currentDate]);

    // 3. Realized Totals (Using Effective Values to Reflect Splits)
    const monthlyIncome = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((acc, t) => {
            const account = accounts.find(a => a.id === t.accountId);
            const amount = t.isRefund ? -t.amount : t.amount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    const monthlyExpense = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => {
            const account = accounts.find(a => a.id === t.accountId);
            // Use Effective Value (My Share) instead of raw Amount
            const effectiveAmount = calculateEffectiveTransactionValue(t);
            const amount = t.isRefund ? -effectiveAmount : effectiveAmount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    // 4. Financial Health Check
    const healthStatus = analyzeFinancialHealth(monthlyIncome + pendingIncome, monthlyExpense + pendingExpenses);

    // 5. Total Net Worth (All Accounts - Credit Card Debt)
    const netWorth = useMemo(() => {
        const accountsTotal = accounts.reduce((acc, curr) => {
            // Subtract Credit Card Debt from Net Worth
            if (curr.type === AccountType.CREDIT_CARD) {
                return acc - Math.abs(convertToBRL(curr.balance, curr.currency || 'BRL'));
            }
            return acc + convertToBRL(curr.balance, curr.currency || 'BRL');
        }, 0);

        return accountsTotal;
    }, [accounts]);

    // Annual Cash Flow Data (Rolling 12 Months starting from selected date)
    const cashFlowData = useMemo(() => {
        const startMonth = currentDate.getMonth();
        const startYear = currentDate.getFullYear();

        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(startYear, startMonth + i, 1);
            return {
                date: date, // Store full date for comparison
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                year: date.getFullYear(),
                monthIndex: date.getMonth(),
                Receitas: 0,
                Despesas: 0
            };
        });

        const endDate = new Date(startYear, startMonth + 12, 0); // End of the 12th month

        transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .forEach(t => {
                const tDate = new Date(t.date);
                // Filter by range [currentDate start, currentDate + 12 months]
                const rangeStart = new Date(startYear, startMonth, 1);

                if (tDate < rangeStart || tDate > endDate) return;
                if (t.type === TransactionType.TRANSFER) return;

                const account = accounts.find(a => a.id === t.accountId);

                // Calculate Effective Amount in BRL
                const effectiveAmount = calculateEffectiveTransactionValue(t);
                const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');

                // Find correctly matching month bucket
                const bucket = data.find(d =>
                    d.monthIndex === tDate.getMonth() && d.year === tDate.getFullYear()
                );

                if (bucket) {
                    if (t.type === TransactionType.EXPENSE) {
                        const value = t.isRefund ? -amountBRL : amountBRL;
                        bucket.Despesas += value;
                    } else if (t.type === TransactionType.INCOME) {
                        const value = t.isRefund ? -amountBRL : amountBRL;
                        bucket.Receitas += value;
                    }
                }
            });

        return data;
    }, [transactions, currentDate, accounts]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0), [cashFlowData]);

    // Upcoming Bills Logic
    const upcomingBills = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .filter(t => t.enableNotification && t.type === TransactionType.EXPENSE && !t.isRefund)
            .filter(t => {
                const targetDateStr = t.notificationDate || t.date;
                const tDate = new Date(targetDateStr);
                return tDate >= today || (tDate < today && isSameMonth(targetDateStr, today));
            })
            .sort((a, b) => {
                const dateA = new Date(a.notificationDate || a.date).getTime();
                const dateB = new Date(b.notificationDate || b.date).getTime();
                return dateA - dateB;
            })
            .slice(0, 3);
    }, [transactions]);

    // Category Pie Chart Data (Using Effective Values)
    const categoryData = useMemo(() => Object.entries(
        monthlyTransactions
            .filter(t => t.type === TransactionType.EXPENSE)
            .reduce((acc, t) => {
                const account = accounts.find(a => a.id === t.accountId);
                const effectiveAmount = calculateEffectiveTransactionValue(t);
                const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');
                const amount = t.isRefund ? -amountBRL : amountBRL;
                acc[t.category] = (acc[t.category] || 0) + (amount as number);
                return acc;
            }, {} as Record<string, number>)
    )
        .filter(([_, val]) => (val as number) > 0)
        .map(([name, value]) => ({ name, value: value as number }))
        .sort((a, b) => b.value - a.value), // Sort by value desc
        [monthlyTransactions, accounts]);

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-safe">
            <FinancialProjectionCard
                projectedBalance={projectedBalance}
                currentBalance={currentBalance}
                pendingIncome={pendingIncome}
                pendingExpenses={pendingExpenses}
                healthStatus={healthStatus}
                currentDate={currentDate}
                showValues={showValues}
            />

            <SummaryCards
                netWorth={netWorth}
                monthlyIncome={monthlyIncome}
                monthlyExpense={monthlyExpense}
                currentDate={currentDate}
                showValues={showValues}
            />

            <Suspense fallback={<ChartSkeleton />}>
                <CashFlowChart
                    data={cashFlowData}
                    hasData={hasCashFlowData}
                    periodLabel={`${currentDate.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })} - ${new Date(currentDate.getFullYear(), currentDate.getMonth() + 11, 1).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`}
                    showValues={showValues}
                />
            </Suspense>

            <UpcomingBills
                bills={upcomingBills}
                accounts={accounts}
                showValues={showValues}
                onEditRequest={onEditRequest}
            />

            <Suspense fallback={<ChartSkeleton />}>
                <CategorySpendingChart
                    data={categoryData}
                    totalExpense={monthlyExpense}
                    showValues={showValues}
                />
            </Suspense>
        </div>
    );
};