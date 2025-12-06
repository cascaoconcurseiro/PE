import React, { useMemo } from 'react';
import { Account, Transaction, TransactionType, AccountType, Goal } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue } from '../services/financialLogic';
import { shouldShowTransaction } from '../utils/transactionFilters';

// Sub-components
import { FinancialProjectionCard } from './dashboard/FinancialProjectionCard';
import { SummaryCards } from './dashboard/SummaryCards';
import { CashFlowChart } from './dashboard/CashFlowChart';
import { UpcomingBills } from './dashboard/UpcomingBills';
import { CategorySpendingChart } from './dashboard/CategorySpendingChart';

import { DashboardSkeleton } from '../components/ui/Skeleton';

interface DashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    goals?: Goal[];
    currentDate?: Date;
    showValues: boolean;
    onEditRequest?: (id: string) => void;
    isLoading?: boolean;
}

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

    // Annual Cash Flow Data (Using Effective Values)
    const cashFlowData = useMemo(() => {
        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(selectedYear, i, 1);
            return {
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
                monthIndex: i,
                Receitas: 0,
                Despesas: 0
            };
        });

        transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .forEach(t => {
                const tDate = new Date(t.date);
                if (tDate.getFullYear() !== selectedYear) return;
                if (t.type === TransactionType.TRANSFER) return;

                const monthIndex = tDate.getMonth();
                const account = accounts.find(a => a.id === t.accountId);

                // Calculate Effective Amount in BRL
                const effectiveAmount = calculateEffectiveTransactionValue(t);
                const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');

                if (t.type === TransactionType.EXPENSE) {
                    const value = t.isRefund ? -amountBRL : amountBRL;
                    data[monthIndex].Despesas += value;
                } else if (t.type === TransactionType.INCOME) {
                    const value = t.isRefund ? -amountBRL : amountBRL;
                    data[monthIndex].Receitas += value;
                }
            });

        return data;
    }, [transactions, selectedYear, accounts]);

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

            <CashFlowChart
                data={cashFlowData}
                hasData={hasCashFlowData}
                year={selectedYear}
                showValues={showValues}
            />

            <UpcomingBills
                bills={upcomingBills}
                accounts={accounts}
                showValues={showValues}
                onEditRequest={onEditRequest}
            />

            <CategorySpendingChart
                data={categoryData}
                totalExpense={monthlyExpense}
                showValues={showValues}
            />
        </div>
    );
};