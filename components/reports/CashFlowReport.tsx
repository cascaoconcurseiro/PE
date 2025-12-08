import React, { useMemo } from 'react';
import { Transaction, Account, TransactionType, AccountType } from '../../types';
import { calculateMyExpense } from '../../utils/expenseUtils';
import { shouldShowTransaction } from '../../utils/transactionFilters';
import { formatCurrency, parseDate } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';

interface CashFlowReportProps {
    transactions: Transaction[];
    accounts: Account[];
    showValues: boolean;
}

export const CashFlowReport: React.FC<CashFlowReportProps> = ({ transactions, accounts, showValues }) => {
    // Cash Flow Logic (Competência vs Caixa)
    const cashFlowReport = useMemo(() => {
        const report: Record<string, { accrual: number, cash: number }> = {};

        // Filter out deleted transactions and unpaid debts
        const activeTransactions = transactions.filter(shouldShowTransaction);

        activeTransactions.forEach(t => {
            if (t.currency !== 'BRL') return; // Cash Flow Report usually focuses on main currency (BRL)

            const month = t.date.substring(0, 7); // YYYY-MM
            if (!report[month]) report[month] = { accrual: 0, cash: 0 };

            // Accrual (Competência): Based on transaction date
            if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                report[month].accrual += myVal;
            }
            if (t.type === TransactionType.INCOME) report[month].accrual -= t.amount;

            if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                // Determine if it's Credit Card
                const account = accounts.find(a => a.id === t.accountId);
                if (account && account.type === AccountType.CREDIT_CARD) {
                    // Find due date. We don't have it explicitly on transaction.
                    // We have 'closingDay' and 'dueDay' on account.
                    // Simple logic: If date > closingDay, it goes to next month's due day.
                    const txDate = parseDate(t.date);
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

                    // For Cash Flow, strictly speaking, if I paid, full amount left my account.
                    // But user wants to see "My Debt/Expense".
                    // If I paid 100 and split 50, 100 left my account.
                    // If I use myVal (50), I'm hiding the 50 I lent.
                    // However, user complained "some places consider 100 as my expense".
                    // Let's use myVal to satisfy "only my debt enters".
                    report[cashMonthStr].cash += myVal;

                } else {
                    // Bank/Cash: Cash happens same day
                    report[month].cash += myVal;
                }
            }
        });

        // Convert to array and sort
        return Object.entries(report)
            .map(([month, data]) => ({ month, ...data }))
            .sort((a, b) => a.month.localeCompare(b.month));
    }, [transactions, accounts]);

    return (
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
                                    {parseDate(item.month + '-01').toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                    <PrivacyBlur showValues={showValues}>{formatCurrency(item.accrual)}</PrivacyBlur>
                                </td>
                                <td className="px-6 py-4 text-right font-mono text-slate-600 dark:text-slate-300 whitespace-nowrap">
                                    <PrivacyBlur showValues={showValues}>{formatCurrency(item.cash)}</PrivacyBlur>
                                </td>
                                <td className={`px-6 py-4 text-right font-bold font-mono whitespace-nowrap ${item.cash > item.accrual ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                                    <PrivacyBlur showValues={showValues}>{formatCurrency(item.accrual - item.cash)}</PrivacyBlur>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
};
