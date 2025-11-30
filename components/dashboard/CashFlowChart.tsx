import React from 'react';
import { Card } from '../ui/Card';
import { BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip } from 'recharts';
import { formatCurrency } from '../../utils';

interface CashFlowChartProps {
    data: any[];
    hasData: boolean;
    year: number;
    showValues: boolean;
}

export const CashFlowChart: React.FC<CashFlowChartProps> = ({ data, hasData, year, showValues }) => {
    return (
        <Card className="border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6 px-2">
                <div className="p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-indigo-600 dark:text-indigo-400">
                    <BarChart3 className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Fluxo de Caixa</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Visão anual de {year}</p>
                </div>
            </div>
            <div className="h-60 md:h-72 w-full">
                {hasData ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--color-border)" className="stroke-slate-200 dark:stroke-slate-800" />
                            <XAxis
                                dataKey="month"
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'currentColor' }}
                                className="text-slate-500 dark:text-slate-400 font-medium"
                                interval="preserveStartEnd"
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fontSize: 10, fill: 'currentColor' }}
                                className="text-slate-400 dark:text-slate-400"
                                tickFormatter={(value) => {
                                    if (value >= 1000000) return `${(value / 1000000).toFixed(0)}M`;
                                    if (value >= 1000) return `${(value / 1000).toFixed(0)}k`;
                                    return value.toFixed(0);
                                }}
                            />
                            <Tooltip
                                formatter={(value: number) => showValues ? formatCurrency(value) : '****'}
                                contentStyle={{
                                    backgroundColor: 'var(--color-bg)',
                                    borderColor: 'var(--color-border)',
                                    borderRadius: '12px',
                                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                                    color: 'var(--color-text)'
                                }}
                                itemStyle={{ color: 'inherit' }}
                                cursor={{ fill: 'rgba(148, 163, 184, 0.1)' }}
                                wrapperClassName="dark:!bg-slate-800 dark:!border-slate-700 dark:!text-slate-200"
                            />
                            <Bar name="Receitas" dataKey="Receitas" fill="#10b981" radius={[4, 4, 0, 0]} maxBarSize={40} />
                            <Bar name="Despesas" dataKey="Despesas" fill="#ef4444" radius={[4, 4, 0, 0]} maxBarSize={40} />
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-800">
                        <BarChart3 className="w-8 h-8 mb-2 opacity-50" />
                        <p className="text-sm font-medium">Sem dados para este ano</p>
                    </div>
                )}
            </div>
        </Card>
    );
};