import React from 'react';
import { Card } from '../ui/Card';
import { PieChart as PieChartIcon } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { formatCurrency } from '../../utils';

interface AllocationChartProps {
    data: { name: string; value: number }[];
    currentTotal: number;
    showValues: boolean;
}

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

export const AllocationChart: React.FC<AllocationChartProps> = ({
    data,
    currentTotal,
    showValues
}) => {
    return (
        <Card className="border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2">
                    <PieChartIcon className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                    Alocação da Carteira
                </h3>
            </div>
            <div className="p-4">
                <div className="h-64 w-full relative">
                    <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                {data.map((entry, index) => (<Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />))}
                            </Pie>
                            <Tooltip formatter={(value: number) => showValues ? formatCurrency(value) : 'R$ ****'} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }} />
                            <Legend verticalAlign="bottom" height={36} iconType="circle" />
                        </PieChart>
                    </ResponsiveContainer>
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none flex-col">
                        <span className="text-[10px] font-bold text-slate-400 uppercase">Total</span>
                        <span className="text-sm font-black text-slate-900 dark:text-white">{showValues ? formatCurrency(currentTotal) : '••••'}</span>
                    </div>
                </div>
                <div className="mt-4 space-y-3">
                    {data.sort((a, b) => b.value - a.value).map((item, idx) => (
                        <div key={item.name} className="flex justify-between text-xs items-center">
                            <span className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full shadow-sm" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></span>
                                <span className="text-slate-600 dark:text-slate-300 font-bold">{item.name}</span>
                            </span>
                            <span className="font-bold text-slate-900 dark:text-white bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{currentTotal > 0 ? ((item.value / currentTotal) * 100).toFixed(1) : 0}%</span>
                        </div>
                    ))}
                </div>
            </div>
        </Card>
    );
};
