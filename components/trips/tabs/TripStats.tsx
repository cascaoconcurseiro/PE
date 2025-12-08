import React from 'react';
import { Trip, Transaction, TransactionType } from '../../../types';
import { Card } from '../../ui/Card';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import { formatCurrency, parseDate } from '../../../utils';

interface TripStatsProps {
    trip: Trip;
    transactions: Transaction[];
}

export const TripStats: React.FC<TripStatsProps> = ({ trip, transactions }) => {
    const totalSpent = transactions.reduce((acc, t) => acc + (t.type === TransactionType.EXPENSE ? t.amount : 0), 0);
    const duration = Math.max(1, (parseDate(trip.endDate).getTime() - parseDate(trip.startDate).getTime()) / (1000 * 3600 * 24));

    const expensesByCategory = transactions.reduce((acc, t) => {
        if (t.type === TransactionType.EXPENSE) {
            acc[t.category] = (acc[t.category] || 0) + t.amount;
        }
        return acc;
    }, {} as Record<string, number>);

    const pieData = Object.entries(expensesByCategory).map(([name, value]) => ({ name, value }));
    const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#ef4444'];

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            <Card title="Gastos por Categoria">
                {transactions.length > 0 ? (
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={pieData}
                                    dataKey="value"
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                >
                                    {pieData.map((_, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip formatter={(value: number) => formatCurrency(value, trip.currency)} />
                                <Legend />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="h-32 flex items-center justify-center text-slate-500 dark:text-slate-400 text-sm">
                        Sem dados suficientes
                    </div>
                )}
            </Card>

            <div className="grid grid-cols-2 gap-4">
                <Card className="bg-violet-50 dark:bg-violet-900/20 border-violet-100 dark:border-violet-800">
                    <p className="text-xs font-bold text-violet-600 dark:text-violet-400 uppercase">Média Diária</p>
                    <p className="text-2xl font-bold text-violet-800 dark:text-violet-300 mt-1">
                        {formatCurrency(totalSpent / duration, trip.currency)}
                    </p>
                </Card>
                <Card className="bg-indigo-50 dark:bg-indigo-900/20 border-indigo-100 dark:border-indigo-800">
                    <p className="text-xs font-bold text-indigo-600 dark:text-indigo-400 uppercase">Total Itens</p>
                    <p className="text-2xl font-bold text-indigo-800 dark:text-indigo-300 mt-1">
                        {transactions.length}
                    </p>
                </Card>
            </div>
        </div>
    );
};
