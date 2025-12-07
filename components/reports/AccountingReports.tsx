import React, { useMemo } from 'react';
import { Transaction, Account } from '../../types';
import { generateLedger, getTrialBalance } from '../../services/ledger';
import { formatCurrency } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';

interface AccountingReportsProps {
    transactions: Transaction[];
    accounts: Account[];
    showValues: boolean;
    activeTab: 'TRIAL' | 'LEDGER';
}

export const AccountingReports: React.FC<AccountingReportsProps> = ({ transactions, accounts, showValues, activeTab }) => {
    const ledger = useMemo(() => generateLedger(transactions, accounts), [transactions, accounts]);
    const trialBalance = useMemo(() => getTrialBalance(ledger), [ledger]);

    return (
        <>
            {activeTab === 'TRIAL' ? (
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
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(item.debit)}</PrivacyBlur>
                                    </td>
                                    <td className="px-6 py-4 text-right text-emerald-600 dark:text-emerald-400 font-mono whitespace-nowrap">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(item.credit)}</PrivacyBlur>
                                    </td>
                                    <td className="px-6 py-4 text-right font-bold text-slate-900 dark:text-white font-mono whitespace-nowrap">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(item.balance)}</PrivacyBlur>
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
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(entry.amount)}</PrivacyBlur>
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
        </>
    );
};
