import React, { Suspense, useState } from 'react';
import { Account, Transaction, Goal, Trip } from '../types';
import { generateMonthlyReport, generateAnnualReport } from '../services/pdfService';
import { Loader2, PieChart, CreditCard, Layers, Printer } from 'lucide-react';
import { Button } from './ui/Button';

// Sub-components (Critical: Loaded immediately)
import { FinancialProjectionCard } from './dashboard/FinancialProjectionCard';
import { SummaryCards } from './dashboard/SummaryCards';
import { UpcomingBills } from './dashboard/UpcomingBills';

import { DashboardSkeleton } from '../components/ui/Skeleton';

import { lazyImport } from '../utils/lazyImport';
import { useFinancialDashboard } from '../hooks/useFinancialDashboard';

const CashFlowChart = lazyImport(() => import('./dashboard/CashFlowChart').then(m => ({ default: m.CashFlowChart })));
const CategorySpendingChart = lazyImport(() => import('./dashboard/CategorySpendingChart').then(m => ({ default: m.CategorySpendingChart })));

interface DashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    trips?: Trip[]; // NEW: Required for currency filtering
    goals?: Goal[];
    currentDate?: Date;
    showValues: boolean;
    onEditRequest?: (id: string) => void;
    onNotificationPay?: (id: string) => void;
    isLoading?: boolean;
    pendingSettlements?: any[];
    projectedAccounts?: Account[];
    onOpenShared?: () => void;
    onOpenSettlement?: (request: any) => void;
}

const ChartSkeleton = () => (
    <div className="w-full h-64 bg-slate-100 dark:bg-slate-800/50 rounded-2xl animate-pulse flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
    </div>
);

export const Dashboard: React.FC<DashboardProps> = ({ accounts, projectedAccounts, transactions, trips, currentDate = new Date(), showValues, onEditRequest, isLoading = false, pendingSettlements = [], onOpenShared, onOpenSettlement }) => {
    const [spendingView, setSpendingView] = useState<'CATEGORY' | 'SOURCE'>('CATEGORY');
    const selectedYear = currentDate.getFullYear();

    const {
        currentBalance,
        projectedBalance,
        pendingIncome,
        pendingExpenses,
        healthStatus,
        netWorth,
        monthlyIncome,
        monthlyExpense,
        cashFlowData,
        hasCashFlowData,
        incomeSparkline,
        expenseSparkline,
        upcomingBills,
        spendingChartData
    } = useFinancialDashboard({
        accounts,
        transactions,
        projectedAccounts,
        trips, // NEW
        currentDate,
        spendingView
    });

    if (isLoading) {
        return <DashboardSkeleton />;
    }

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-safe">

            {/* Pending Actions Section */}
            {(pendingSettlements && pendingSettlements.length > 0) && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4 animate-in slide-in-from-top-4">
                    <h3 className="font-bold text-amber-900 dark:text-amber-100 mb-3 flex items-center gap-2">
                        <Layers className="w-5 h-5" /> Ações Pendentes
                    </h3>
                    <div className="space-y-3">

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
                incomeSparkline={incomeSparkline}
                expenseSparkline={expenseSparkline}
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

            {/* Report Buttons - Bottom of Page */}
            <div className="flex justify-center gap-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateMonthlyReport(transactions, accounts, currentDate)}
                    className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Imprimir Relatório Mensal"
                >
                    <Printer className="w-4 h-4 mr-2" />
                    Relatório Mensal
                </Button>
                <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => generateAnnualReport(transactions, accounts, selectedYear)}
                    className="text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                    title="Imprimir Relatório Anual"
                >
                    <Printer className="w-4 h-4 mr-2" />
                    Relatório Anual
                </Button>
            </div>
        </div>
    );
};