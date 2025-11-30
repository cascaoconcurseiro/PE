import React, { useMemo } from 'react';
import { Transaction, TransactionType, FamilyMember } from '../../types';
import { formatCurrency } from '../../utils';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { Users } from 'lucide-react';

interface SharedExpensesReportProps {
    transactions: Transaction[];
    familyMembers: FamilyMember[];
}

export const SharedExpensesReport: React.FC<SharedExpensesReportProps> = ({ transactions, familyMembers }) => {

    // 1. Monthly Evolution of Shared Expenses
    const monthlyData = useMemo(() => {
        const data: Record<string, { month: string, total: number, shared: number }> = {};

        transactions.forEach(t => {
            if (t.type !== TransactionType.EXPENSE || t.currency !== 'BRL') return;

            const month = t.date.substring(0, 7); // YYYY-MM
            if (!data[month]) data[month] = { month, total: 0, shared: 0 };

            data[month].total += t.amount;
            if (t.sharedWith && t.sharedWith.length > 0) {
                // It's a shared transaction
                data[month].shared += t.amount;
            }
        });

        return Object.values(data)
            .sort((a, b) => a.month.localeCompare(b.month))
            .slice(-12); // Last 12 months
    }, [transactions]);

    // 2. Future Installments (Shared)
    const futureInstallments = useMemo(() => {
        const today = new Date();
        let totalFutureShared = 0;

        transactions.forEach(t => {
            if (t.type === TransactionType.EXPENSE && t.currency === 'BRL' && new Date(t.date) > today) {
                if (t.sharedWith && t.sharedWith.length > 0) {
                    totalFutureShared += t.amount;
                }
            }
        });
        return totalFutureShared;
    }, [transactions]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                    <div className="p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full text-indigo-600 dark:text-indigo-400">
                        <Users className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase">Parcelas Futuras (Compart.)</p>
                        <p className="text-xl font-black text-slate-800 dark:text-white">{formatCurrency(futureInstallments)}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-6">Evolução de Gastos Compartilhados (Últimos 12 meses)</h3>
                <div className="h-[350px]">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={monthlyData}>
                            <CartesianGrid strokeDasharray="3 3" opacity={0.1} />
                            <XAxis
                                dataKey="month"
                                tickFormatter={(val) => new Date(val + '-02').toLocaleDateString('pt-BR', { month: 'short' })}
                                stroke="#94a3b8"
                                fontSize={12}
                            />
                            <YAxis stroke="#94a3b8" fontSize={12} tickFormatter={(val) => `R$ ${val / 1000}k`} />
                            <Tooltip
                                formatter={(value: number) => formatCurrency(value)}
                                contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                            />
                            <Legend />
                            <Bar dataKey="total" name="Total Geral" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
                            <Bar dataKey="shared" name="Compartilhado" fill="#6366f1" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
};
