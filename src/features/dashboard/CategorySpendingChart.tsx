import React from 'react';
import { Card } from '../ui/Card';
import { PieChart as PieIcon, Wallet } from 'lucide-react';
import { SimplePieChart } from '../ui/SimpleCharts';
import { formatCurrency } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';

interface CategorySpendingChartProps {
    data: { name: string; value: number }[];
    totalExpense: number;
    showValues: boolean;
}

export const CategorySpendingChart: React.FC<CategorySpendingChartProps> = ({ data, totalExpense, showValues }) => {
    const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#6366f1', '#14b8a6', '#f43f5e'];

    // Transform data for SimplePieChart
    const chartData = data.map((item, index) => ({
        name: item.name,
        value: item.value,
        color: COLORS[index % COLORS.length]
    }));

    return (
        <Card className="border-slate-200 bg-white dark:bg-slate-900 dark:border-slate-800">
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl text-emerald-600 dark:text-emerald-400">
                    <PieIcon className="w-5 h-5" />
                </div>
                <div>
                    <h3 className="font-bold text-slate-800 dark:text-white text-lg">Distribuição de Gastos</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">Top categorias do mês (Valor Efetivo)</p>
                </div>
            </div>

            {data.length > 0 ? (
                <div className="flex flex-col items-center gap-6">
                    {/* Total in center */}
                    <div className="text-center mb-4">
                        <span className="text-xs text-slate-400 uppercase font-bold block mb-1">Total Gasto</span>
                        <span className="text-2xl font-bold text-slate-900 dark:text-white block">
                            <PrivacyBlur showValues={showValues}>{formatCurrency(totalExpense)}</PrivacyBlur>
                        </span>
                    </div>

                    {/* Pie Chart */}
                    <SimplePieChart data={chartData.slice(0, 5)} size={200} />

                    {/* Legend */}
                    <div className="w-full grid grid-cols-1 gap-2 mt-4">
                        {data.slice(0, 5).map((entry, index) => (
                            <div key={index} className="flex items-center justify-between p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                                <div className="flex items-center gap-3 overflow-hidden">
                                    <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: COLORS[index % COLORS.length] }}></div>
                                    <span className="font-semibold text-slate-700 dark:text-slate-300 text-sm">{entry.name}</span>
                                </div>
                                <div className="text-right shrink-0">
                                    <span className="text-slate-900 dark:text-white font-bold text-sm block">
                                        <PrivacyBlur showValues={showValues}>{formatCurrency(entry.value)}</PrivacyBlur>
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-medium">
                                        {((entry.value / totalExpense) * 100).toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        ))}
                        {data.length > 5 && (
                            <div className="text-center mt-2">
                                <span className="text-xs text-slate-400 italic">+ {data.length - 5} outras categorias</span>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="h-56 flex flex-col items-center justify-center text-slate-400 bg-slate-50 dark:bg-slate-900/30 rounded-2xl border border-dashed border-slate-200 dark:border-slate-800">
                    <Wallet className="w-8 h-8 mb-2 opacity-50" />
                    <p className="font-medium text-sm">Sem despesas registradas.</p>
                </div>
            )}
        </Card>
    );
};