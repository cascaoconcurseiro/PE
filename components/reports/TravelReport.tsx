import React, { useState, useMemo } from 'react';
import { Trip, Transaction, TransactionType } from '../../types';
import { formatCurrency } from '../../utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';
import { Plane, Calendar } from 'lucide-react';

interface TravelReportProps {
    trips: Trip[];
    transactions: Transaction[];
}

export const TravelReport: React.FC<TravelReportProps> = ({ trips, transactions }) => {
    const [selectedTripId, setSelectedTripId] = useState<string>(trips[0]?.id || '');

    const selectedTrip = trips.find(t => t.id === selectedTripId);

    const tripTransactions = useMemo(() => {
        if (!selectedTripId) return [];
        return transactions.filter(t => t.tripId === selectedTripId && t.type === TransactionType.EXPENSE);
    }, [selectedTripId, transactions]);

    const stats = useMemo(() => {
        const total = tripTransactions.reduce((acc, t) => acc + t.amount, 0);
        const byCategory: Record<string, number> = {};

        tripTransactions.forEach(t => {
            byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
        });

        const categoryData = Object.entries(byCategory)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);

        return { total, categoryData };
    }, [tripTransactions]);

    const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#ef4444'];

    if (!trips.length) {
        return <div className="p-8 text-center text-slate-500">Nenhuma viagem cadastrada.</div>;
    }

    return (
        <div className="space-y-6">
            {/* Trip Selector */}
            <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
                <div className="p-3 bg-violet-100 dark:bg-violet-900/30 rounded-full text-violet-600 dark:text-violet-400">
                    <Plane className="w-6 h-6" />
                </div>
                <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Selecione a Viagem</label>
                    <select
                        value={selectedTripId}
                        onChange={(e) => setSelectedTripId(e.target.value)}
                        className="w-full bg-transparent font-bold text-lg text-slate-800 dark:text-white outline-none"
                    >
                        {trips.map(t => (
                            <option key={t.id} value={t.id}>{t.name} ({t.currency})</option>
                        ))}
                    </select>
                </div>
                <div className="text-right">
                    <span className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-1">Total Gasto</span>
                    <span className="text-xl font-black text-violet-600 dark:text-violet-400">
                        {selectedTrip ? formatCurrency(stats.total, selectedTrip.currency) : '-'}
                    </span>
                </div>
            </div>

            {selectedTrip && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Category Chart */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Gastos por Categoria</h3>
                        <div className="h-[300px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={stats.categoryData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {stats.categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        formatter={(value: number) => formatCurrency(value, selectedTrip.currency)}
                                        contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Top Expenses List */}
                    <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col">
                        <h3 className="font-bold text-slate-700 dark:text-slate-300 mb-4">Maiores Gastos</h3>
                        <div className="overflow-y-auto custom-scrollbar flex-1 pr-2">
                            {tripTransactions
                                .sort((a, b) => b.amount - a.amount)
                                .slice(0, 10)
                                .map(t => (
                                    <div key={t.id} className="flex justify-between items-center py-3 border-b border-slate-100 dark:border-slate-700 last:border-0">
                                        <div>
                                            <p className="font-bold text-slate-800 dark:text-slate-200 text-sm">{t.description}</p>
                                            <p className="text-xs text-slate-500">{new Date(t.date).toLocaleDateString()} • {t.category}</p>
                                        </div>
                                        <span className="font-bold text-slate-900 dark:text-white text-sm">
                                            {formatCurrency(t.amount, selectedTrip.currency)}
                                        </span>
                                    </div>
                                ))
                            }
                            {tripTransactions.length === 0 && <p className="text-slate-400 text-sm text-center py-10">Nenhum gasto registrado.</p>}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
