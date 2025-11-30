import React, { useState, useMemo } from 'react';
import { Account, Transaction, TransactionType, AccountType, Trip, FamilyMember } from '../types';
import { generateLedger, getTrialBalance } from '../services/ledger';
import { formatCurrency } from '../utils';
import { FileText, BookOpen, Download, TrendingUp, Plane, Users } from 'lucide-react';
import { Button } from './ui/Button';
import { exportToCSV } from '../services/exportUtils';
import { TravelReport } from './reports/TravelReport';
import { SharedExpensesReport } from './reports/SharedExpensesReport';

interface ReportsProps {
    accounts: Account[];
    transactions: Transaction[];
    trips: Trip[];
    familyMembers: FamilyMember[];
    showValues: boolean;
}

export const Reports: React.FC<ReportsProps> = ({ accounts, transactions, trips, familyMembers, showValues }) => {
    const [activeTab, setActiveTab] = useState<'TRIAL' | 'LEDGER' | 'CASH_FLOW' | 'TRAVEL' | 'SHARED'>('TRIAL');

    const ledger = useMemo(() => generateLedger(transactions, accounts), [transactions, accounts]);
    const trialBalance = useMemo(() => getTrialBalance(ledger), [ledger]);

    // Cash Flow Logic (Competência vs Caixa)
    const cashFlowReport = useMemo(() => {
        const report: Record<string, { accrual: number, cash: number }> = {};

        transactions.forEach(t => {
            if (t.currency !== 'BRL') return; // Cash Flow Report usually focuses on main currency (BRL)

            const month = t.date.substring(0, 7); // YYYY-MM
            if (!report[month]) report[month] = { accrual: 0, cash: 0 };

            // Accrual (Competência): Based on transaction date
            if (t.type === TransactionType.EXPENSE) report[month].accrual += t.amount;
            if (t.type === TransactionType.INCOME) report[month].accrual -= t.amount;

            if (t.type === TransactionType.EXPENSE) {
                // Determine if it's Credit Card
                const account = accounts.find(a => a.id === t.accountId);
                if (account && account.type === AccountType.CREDIT_CARD) {
                    // Find due date. We don't have it explicitly on transaction.
                    // We have 'closingDay' and 'dueDay' on account.
                    // Simple logic: If date > closingDay, it goes to next month's due day.
                    const txDate = new Date(t.date);
                    const closingDay = account.closingDay || 1;
                    const dueDay = account.dueDay || 10;

                    let targetMonth = txDate.getMonth();
                    let targetYear = txDate.getFullYear();

                    if (txDate.getDate() > closingDay) {
                        targetMonth++; // Next month
                        if (targetMonth > 11) {
                            targetMonth = 0;
                            targetYear++;
                        }
                    }

                    // The cash outflow happens on the Due Day of that target month
                    const cashDate = new Date(targetYear, targetMonth, dueDay);
                    const cashMonthStr = cashDate.toISOString().substring(0, 7);

                    if (!report[cashMonthStr]) report[cashMonthStr] = { accrual: 0, cash: 0 };
                    report[cashMonthStr].cash += t.amount;

                } else {
                    // Bank/Cash: Cash happens same day
                    report[month].cash += t.amount;
                }
            }
        });

        // Convert to array and sort
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

    const PrivacyBlur = ({ children }: { children: React.ReactNode }) => {
        if (showValues) return <>{children}</>;
        return <span className="blur-sm select-none opacity-60">••••</span>;
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
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-900 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
                <button
                    onClick={() => setActiveTab('TRIAL')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'TRIAL' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <FileText className="w-4 h-4" /> Balancete
                </button>
                <button
                    onClick={() => setActiveTab('LEDGER')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'LEDGER' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <BookOpen className="w-4 h-4" /> Razão
                </button>
                <button
                    onClick={() => setActiveTab('CASH_FLOW')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'CASH_FLOW' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <TrendingUp className="w-4 h-4" /> Fluxo de Caixa
                </button>
                <button
                    onClick={() => setActiveTab('TRAVEL')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
                >
                    <Plane className="w-4 h-4" /> Viagens
                </button>
                <button
                    onClick={() => setActiveTab('SHARED')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition-all whitespace-nowrap ${activeTab === 'SHARED' ? 'bg-white dark:bg-slate-800 text-indigo-600 dark:text-indigo-400 shadow-sm' : 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'}`}
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
                    <div className="p-6">
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-xl text-amber-800 dark:text-amber-300 text-sm mb-6">
                            <p><strong>Competência (Consumo):</strong> Quando a compra foi feita.</p>
                            <p><strong>Caixa (Pagamento):</strong> Quando o dinheiro efetivamente sai da conta (ex: vencimento da fatura).</p>
                        </div>
                        <div className="overflow-x-auto pb-4">
                            <table className="w-full text-sm text-left min-w-[600px]">
                                <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                                    <tr>
                                        <th className="px-6 py-4 whitespace-nowrap">Mês</th>
                                        <th className="px-6 py-4 text-right whitespace-nowrap">Competência (Consumo)</th>
                                        <th className="px-6 py-4 text-right whitespace-nowrap">Caixa (Pagamento)</th>
                                        <th className="px-6 py-4 text-right whitespace-nowrap">Diferença</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                    {cashFlowReport.map((item) => (
                                        <tr key={item.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                            <td className="px-6 py-4 font-bold text-slate-800 dark:text-white capitalize whitespace-nowrap">
                                                {new Date(item.month + '-02').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                <PrivacyBlur>{formatCurrency(item.accrual)}</PrivacyBlur>
                                            </td>
                                            <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                                <PrivacyBlur>{formatCurrency(item.cash)}</PrivacyBlur>
                                            </td>
                                            <td className={`px-6 py-4 text-right font-bold font-mono whitespace-nowrap ${item.cash > item.accrual ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                                <PrivacyBlur>{formatCurrency(item.accrual - item.cash)}</PrivacyBlur>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : activeTab === 'TRIAL' ? (
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-sm text-left min-w-[600px]">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap">Conta / Categoria</th>
                                    <th className="px-6 py-4 text-right text-red-600 dark:text-red-400 whitespace-nowrap">Débito Total</th>
                                    <th className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Crédito Total</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">Saldo Líquido</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {trialBalance.map((item) => (
                                    <tr key={item.accountName} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-white whitespace-nowrap">{item.accountName}</td>
                                        <td className="px-6 py-4 text-right text-red-600 dark:text-red-400 font-mono whitespace-nowrap">
                                            <PrivacyBlur>{formatCurrency(item.debit)}</PrivacyBlur>
                                        </td>
                                        <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                                            <PrivacyBlur>{formatCurrency(item.credit)}</PrivacyBlur>
                                        </td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                                            <PrivacyBlur>{formatCurrency(item.balance)}</PrivacyBlur>
                                        </td>
                                    </tr>
                                ))}
                                {trialBalance.length === 0 && (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                                            Nenhum dado contábil encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="overflow-x-auto pb-4">
                        <table className="w-full text-sm text-left min-w-[800px]">
                            <thead className="bg-slate-50 dark:bg-slate-800 text-slate-500 dark:text-slate-400 font-medium border-b border-slate-200 dark:border-slate-700">
                                <tr>
                                    <th className="px-6 py-4 whitespace-nowrap">Data</th>
                                    <th className="px-6 py-4 whitespace-nowrap">Descrição</th>
                                    <th className="px-6 py-4 text-red-600 dark:text-red-400 whitespace-nowrap">Débito (Destino)</th>
                                    <th className="px-6 py-4 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">Crédito (Origem)</th>
                                    <th className="px-6 py-4 text-right whitespace-nowrap">Valor</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {ledger.map((entry) => (
                                    <tr key={entry.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                        <td className="px-6 py-4 text-slate-500 dark:text-slate-400 whitespace-nowrap">
                                            {new Date(entry.date).toLocaleDateString('pt-BR')}
                                        </td>
                                        <td className="px-6 py-4 font-medium text-slate-800 dark:text-white max-w-xs truncate" title={entry.description}>{entry.description}</td>
                                        <td className="px-6 py-4 text-red-600 dark:text-red-400 whitespace-nowrap">{entry.debit}</td>
                                        <td className="px-6 py-4 text-emerald-600 dark:text-emerald-400 whitespace-nowrap">{entry.credit}</td>
                                        <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                                            <PrivacyBlur>{formatCurrency(entry.amount)}</PrivacyBlur>
                                        </td>
                                    </tr>
                                ))}
                                {ledger.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                            Nenhum lançamento encontrado.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};