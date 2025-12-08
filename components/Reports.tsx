import React, { useState, useMemo } from 'react';
import { Account, Transaction, TransactionType, AccountType, Trip, FamilyMember } from '../types';
import { generateLedger, getTrialBalance } from '../services/ledger';
import { calculateMyExpense } from '../utils/expenseUtils';
import { parseDate } from '../utils';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { FileText, BookOpen, Download, TrendingUp, Plane, Users } from 'lucide-react';
import { Button } from './ui/Button';
import { exportToCSV } from '../services/exportUtils';
import { TravelReport } from './reports/TravelReport';
import { SharedExpensesReport } from './reports/SharedExpensesReport';
import { CashFlowReport } from './reports/CashFlowReport';
import { AccountingReports } from './reports/AccountingReports';

interface ReportsProps {
    accounts: Account[];
    transactions: Transaction[];
    trips: Trip[];
    familyMembers: FamilyMember[];
    showValues: boolean;
}

export const Reports: React.FC<ReportsProps> = ({ accounts, transactions, trips, familyMembers, showValues }) => {
    const [activeTab, setActiveTab] = useState<'TRIAL' | 'LEDGER' | 'CASH_FLOW' | 'TRAVEL' | 'SHARED'>('TRIAL');

    // Memoized data needed for export
    const ledger = useMemo(() => generateLedger(transactions, accounts), [transactions, accounts]);
    const trialBalance = useMemo(() => getTrialBalance(ledger), [ledger]);

    const cashFlowReport = useMemo(() => {
        // Re-implement simplified logic just for export (or move export logic to component and use ref? keeping simple here)
        // For accurate export, we should probably extract this logic to a shared helper or hook. 
        // Given time constraints, I will duplicate the lightweight export preparation logic or accept that export button is here.
        // Actually, to avoid duplication, I will leave the Export logic here, but for now I'll just use the same logic as in the component.
        // OR better: Move `useCashFlow` to a hook. 
        // For now, let's keep it simple. The code below is required for the "handleExport" function to work without access to the child component state.

        const report: Record<string, { accrual: number, cash: number }> = {};
        const activeTransactions = transactions.filter(shouldShowTransaction);

        activeTransactions.forEach(t => {
            if (t.currency !== 'BRL') return;
            const month = t.date.substring(0, 7);
            if (!report[month]) report[month] = { accrual: 0, cash: 0 };

            if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                report[month].accrual += myVal;
            }
            if (t.type === TransactionType.INCOME) report[month].accrual -= t.amount;

            if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                const account = accounts.find(a => a.id === t.accountId);
                if (account && account.type === AccountType.CREDIT_CARD) {
                    const txDate = parseDate(t.date);
                    const closingDay = account.closingDay || 1;
                    const dueDay = account.dueDay || 10;
                    let targetMonth = txDate.getMonth();
                    let targetYear = txDate.getFullYear();
                    if (txDate.getDate() > closingDay) {
                        targetMonth++;
                        if (targetMonth > 11) { targetMonth = 0; targetYear++; }
                    }
                    const cashDate = new Date(targetYear, targetMonth, dueDay);
                    const cashMonthStr = cashDate.toISOString().substring(0, 7);
                    if (!report[cashMonthStr]) report[cashMonthStr] = { accrual: 0, cash: 0 };
                    report[cashMonthStr].cash += myVal;
                } else {
                    report[month].cash += myVal;
                }
            }
        });
        return Object.entries(report)
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [transactions, accounts]);


    const handleExport = () => {
        if (activeTab === 'TRIAL') {
            exportToCSV(trialBalance, ['Conta', 'Débito', 'Crédito', 'Saldo'], 'Balancete');
        } else if (activeTab === 'LEDGER') {
            exportToCSV(ledger, ['ID', 'Data', 'Descrição', 'Débito', 'Crédito', 'Valor'], 'Razao_Contabil');
        } else if (activeTab === 'CASH_FLOW') {
            exportToCSV(cashFlowReport, ['Mês', 'Competência (Consumo)', 'Caixa (Pagamento)'], 'Fluxo_Caixa');
        }
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Relatórios Avançados</h2>
                    <p className="text-slate-500 dark:text-slate-400">Análise detalhada de fluxo de caixa, viagens e contabilidade.</p>
                </div>
                {['TRIAL', 'LEDGER', 'CASH_FLOW'].includes(activeTab) && (
                    <Button onClick={handleExport} variant="secondary" className="gap-2">
                        <Download className="w-4 h-4" /> Exportar CSV
                    </Button>
                )}
            </div>

            {/* Tabs */}
            <div className="grid grid-cols-2 sm:flex sm:flex-nowrap gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-full sm:overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('TRIAL')}
                    className={`flex - 1 sm: flex - none px - 4 py - 2 rounded - lg text - sm font - bold flex items - center justify - center sm: justify - start gap - 2 transition - all whitespace - nowrap ${activeTab === 'TRIAL' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'} `}
                >
                    <FileText className="w-4 h-4" /> Balancete
                </button>
                <button
                    onClick={() => setActiveTab('LEDGER')}
                    className={`flex - 1 sm: flex - none px - 4 py - 2 rounded - lg text - sm font - bold flex items - center justify - center sm: justify - start gap - 2 transition - all whitespace - nowrap ${activeTab === 'LEDGER' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'} `}
                >
                    <BookOpen className="w-4 h-4" /> Razão
                </button>
                <button
                    onClick={() => setActiveTab('CASH_FLOW')}
                    className={`flex - 1 sm: flex - none px - 4 py - 2 rounded - lg text - sm font - bold flex items - center justify - center sm: justify - start gap - 2 transition - all whitespace - nowrap ${activeTab === 'CASH_FLOW' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'} `}
                >
                    <TrendingUp className="w-4 h-4" /> Fluxo de Caixa
                </button>
                <button
                    onClick={() => setActiveTab('TRAVEL')}
                    className={`flex - 1 sm: flex - none px - 4 py - 2 rounded - lg text - sm font - bold flex items - center justify - center sm: justify - start gap - 2 transition - all whitespace - nowrap ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'} `}
                >
                    <Plane className="w-4 h-4" /> Viagens
                </button>
                <button
                    onClick={() => setActiveTab('SHARED')}
                    className={`col - span - 2 sm: col - span - auto flex - 1 sm: flex - none px - 4 py - 2 rounded - lg text - sm font - bold flex items - center justify - center sm: justify - start gap - 2 transition - all whitespace - nowrap ${activeTab === 'SHARED' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'} `}
                >
                    <Users className="w-4 h-4" /> Compartilhado
                </button>
            </div>

            {/* Content */}
            <div className="bg-white dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden min-h-[400px]">
                {activeTab === 'TRAVEL' ? (
                    <div className="p-6">
                        <TravelReport trips={trips} transactions={transactions} />
                    </div>
                ) : activeTab === 'SHARED' ? (
                    <div className="p-6">
                        <SharedExpensesReport transactions={transactions} familyMembers={familyMembers} />
                    </div>
                ) : activeTab === 'CASH_FLOW' ? (
                    <CashFlowReport transactions={transactions} accounts={accounts} showValues={showValues} />
                ) : (
                    <div className="p-0">
                        {/* Accounting reports (trial balance and ledger) share similar table style so they are grouped in the component, 
                            but we could split them. Passing activeTab to let component decide what to render */}
                        <AccountingReports transactions={transactions} accounts={accounts} showValues={showValues} activeTab={activeTab} />
                    </div>
                )}
            </div>
        </div>
    );
};