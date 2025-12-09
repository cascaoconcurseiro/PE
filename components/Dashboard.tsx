import React, { useMemo, Suspense, lazy, useState } from 'react';
import { Account, Transaction, TransactionType, AccountType, Goal, Category } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue } from '../services/financialLogic';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { Loader2, PieChart, CreditCard, Layers } from 'lucide-react';
import { Button } from './ui/Button';

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
    onNotificationPay?: (id: string) => void;
    isLoading?: boolean;
    pendingSharedRequestsCount?: number;
    pendingSettlements?: any[];
    onOpenShared?: () => void;
    onOpenSettlement?: (request: any) => void;
}

const ChartSkeleton = () => (
    <div className="w-full h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ accounts, transactions, goals = [], currentDate = new Date(), showValues, onEditRequest, onNotificationPay, isLoading = false, pendingSharedRequestsCount = 0, pendingSettlements = [], onOpenShared, onOpenSettlement }) => {
    const [spendingView, setSpendingView] = useState<'CATEGORY' | 'SOURCE'>('CATEGORY');


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
    const monthlyResult = monthlyIncome - monthlyExpense;
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

    // Annual Cash Flow Data (Calendar Year: Jan - Dec)
    const cashFlowData = useMemo(() => {
        const selectedYear = currentDate.getFullYear();

        // Initialize 12 months with 0
        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(selectedYear, i, 1);
            return {
                date: date,
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
                year: selectedYear,
                monthIndex: i,
                Receitas: 0,
                Despesas: 0
            };
        });

        transactions
            .filter(shouldShowTransaction)
            .forEach(t => {
                const tDate = new Date(t.date);
                // Filter strict by year
                if (tDate.getFullYear() !== selectedYear) return;

                // Exclude transfers from Cash Flow visualization (focus on In/Out)
                if (t.type === TransactionType.TRANSFER) return;

                const account = accounts.find(a => a.id === t.accountId);

                // Calculate Effective Amount in BRL
                const effectiveAmount = calculateEffectiveTransactionValue(t);
                const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');

                // Find correctly matching month bucket
                const bucket = data.find(d => d.monthIndex === tDate.getMonth());

                if (bucket) {
                    if (t.type === TransactionType.EXPENSE) {
                        const value = t.isRefund ? -amountBRL : amountBRL;
                        // Determine if it's actually an expense or positive
                        if (value > 0) bucket.Despesas -= value; // Store as negative for chart
                        else bucket.Receitas += Math.abs(value); // Refund becomes income visually
                    } else if (t.type === TransactionType.INCOME) {
                        const value = t.isRefund ? -amountBRL : amountBRL;
                        if (value > 0) bucket.Receitas += value;
                        else bucket.Despesas -= Math.abs(value);
                    }
                }
            });

        return data;
    }, [transactions, currentDate, accounts]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas < 0), [cashFlowData]);

    // Upcoming Bills Logic
    const upcomingBills = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        return transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts
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

    // Spending Chart Data (Dynamic: Category or Source)
    const spendingChartData = useMemo(() => {
        const chartTxs = monthlyTransactions
            .filter(t => t.type === TransactionType.EXPENSE)
            // Fix: Exclude Opening Balance / Adjustment from Spending Reports
            .filter(t => t.category !== Category.OPENING_BALANCE);

        if (spendingView === 'CATEGORY') {
            return Object.entries(
                chartTxs.reduce((acc, t) => {
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
                .sort((a, b) => b.value - a.value);
        } else {
            // SOURCE VIEW
            return Object.entries(
                chartTxs.reduce((acc, t) => {
                    const account = accounts.find(a => a.id === t.accountId);
                    const effectiveAmount = calculateEffectiveTransactionValue(t);
                    const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');
                    const amount = t.isRefund ? -amountBRL : amountBRL;

                    // Determine Source Label
                    let sourceLabel = 'Outros';
                    if (account) {
                        if (account.type === AccountType.CREDIT_CARD) sourceLabel = 'Cartão de Crédito';
                        else if (account.type === AccountType.CHECKING || account.type === AccountType.SAVINGS) sourceLabel = 'Conta Bancária';
                        else if (account.type === AccountType.CASH) sourceLabel = 'Dinheiro';
                        else sourceLabel = account.type; // Fallback
                    }

                    acc[sourceLabel] = (acc[sourceLabel] || 0) + (amount as number);
                    return acc;
                }, {} as Record<string, number>)
            )
                .filter(([_, val]) => (val as number) > 0)
                .map(([name, value]) => ({ name, value: value as number }))
                .sort((a, b) => b.value - a.value);
        }
    }, [monthlyTransactions, accounts, spendingView]);

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-safe">
            <FinancialProjectionCard

                {/* Pending Actions Section */}
                {(pendingSharedRequestsCount > 0 || (pendingSettlements && pendingSettlements.length > 0)) && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4 animate-in slide-in-from-top-4">
                        <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                            <Layers className="w-5 h-5" /> Ações Pendentes
                        </h3>
                        <div className="space-y-3">
                            {pendingSharedRequestsCount > 0 && (
                                <div className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-100 dark:border-amber-900 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">Convites Compartilhados</p>
                                        <p className="text-sm text-slate-500">{pendingSharedRequestsCount} solicitações aguardando aceite.</p>
                                    </div>
                                    <Button size="sm" onClick={onOpenShared} className="bg-amber-100 text-amber-900 hover:bg-amber-200 dark:bg-amber-900 dark:text-amber-100">
                                        Ver Todos
                                    </Button>
                                </div>
                            )}
                            {pendingSettlements?.map(s => (
                                <div key={s.id} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-amber-100 dark:border-amber-900 flex justify-between items-center shadow-sm">
                                    <div>
                                        <p className="font-bold text-slate-800 dark:text-slate-200">
                                            {s.type === 'CHARGE' ? 'Cobrança Recebida' : 'Pagamento Recebido'}
                                        </p>
                                        <p className="text-sm text-slate-500">
                                            {s.other_user_name} {s.type === 'CHARGE' ? 'te cobrou' : 'pagou'} <strong>{s.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong>
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => onOpenSettlement && onOpenSettlement(s)}
                                        className={s.type === 'CHARGE' ? "bg-red-100 text-red-900 hover:bg-red-200" : "bg-emerald-100 text-emerald-900 hover:bg-emerald-200"}
                                    >
                                        {s.type === 'CHARGE' ? 'Pagar' : 'Confirmar'}
                                    </Button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

            <FinancialProjectionCard
                projectedBalance={monthlyResult}
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
                    periodLabel={`Visão anual de ${selectedYear}`}
                    showValues={showValues}
                />
            </Suspense>

            <UpcomingBills
                bills={upcomingBills}
                accounts={accounts}
                showValues={showValues}
                onEditRequest={onEditRequest}
            />

            <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-sm border border-slate-200 dark:border-slate-700">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">
                        {spendingView === 'CATEGORY' ? 'Gastos por Categoria' : 'Fontes de Gasto'}
                    </h3>

                    <div className="flex bg-slate-100 dark:bg-slate-900 rounded-lg p-1 gap-1">
                        <button
                            onClick={() => setSpendingView('CATEGORY')}
                            className={`p-2 rounded-md transition-all ${spendingView === 'CATEGORY' ? 'bg-white dark:bg-slate-800 shadow text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'}`}
                            title="Ver por Categoria"
                        >
                            <PieChart className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setSpendingView('SOURCE')}
                            className={`p-2 rounded-md transition-all ${spendingView === 'SOURCE' ? 'bg-white dark:bg-slate-800 shadow text-violet-600 dark:text-violet-400' : 'text-slate-500 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-300'}`}
                            title="Ver por Fonte (Cartão, Dinheiro...)"
                        >
                            <CreditCard className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <Suspense fallback={<ChartSkeleton />}>
                    <CategorySpendingChart
                        data={spendingChartData}
                        totalExpense={monthlyExpense}
                        showValues={showValues}
                    />
                </Suspense>
            </div>
        </div>
    );
};