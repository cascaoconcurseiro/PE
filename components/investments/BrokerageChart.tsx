import React from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { Asset, Account } from '../../types';
import { convertToBRL } from '../../services/currencyService';
import { formatCurrency } from '../../utils';

interface BrokerageChartProps {
    assets: Asset[];
    accounts: Account[];
    showValues: boolean;
}

export const BrokerageChart: React.FC<BrokerageChartProps> = ({ assets, accounts, showValues }) => {
    const data = React.useMemo(() => {
        const result: { [key: string]: number } = {};
        assets.forEach(asset => {
            const account = accounts.find(a => a.id === asset.accountId);
            const accountName = account ? account.name : 'Desconhecida';
            const value = convertToBRL(asset.quantity * asset.currentPrice, asset.currency);
            result[accountName] = (result[accountName] || 0) + value;
        });
        return Object.entries(result)
            .map(([name, value]) => ({ name, value }))
            .sort((a, b) => b.value - a.value);
    }, [assets, accounts]);

    const COLORS = ['#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#6366f1', '#ef4444', '#14b8a6'];

    if (data.length === 0) {
        return (
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex items-center justify-center h-[380px]">
                <p className="text-slate-400 text-sm">Sem dados para exibir</p>
            </div>
        );
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4">Por Corretora</h3>
            <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((entry, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                        </Pie>
                        <Tooltip
                            formatter={(value: number) => showValues ? formatCurrency(value) : '••••'}
                            contentStyle={{ backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff', borderRadius: '8px' }}
                            itemStyle={{ color: '#fff' }}
                        />
                        <Legend />
                    </PieChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
};
