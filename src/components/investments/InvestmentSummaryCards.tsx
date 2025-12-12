import React from 'react';
import { Card } from '../ui/Card';
import { Wallet, TrendingUp, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { formatCurrency } from '../../utils';

interface InvestmentSummaryCardsProps {
    currentTotal: number;
    totalInvested: number;
    profit: number;
    profitPercentage: number;
    showValues: boolean;
}

export const InvestmentSummaryCards: React.FC<InvestmentSummaryCardsProps> = ({
    currentTotal,
    totalInvested,
    profit,
    profitPercentage,
    showValues
}) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="bg-gradient-to-br from-slate-800 to-slate-950 text-white border-none shadow-lg relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-5"><Wallet className="w-24 h-24 text-white" /></div>
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="p-2 bg-white/10 rounded-lg backdrop-blur-md"><Wallet className="w-5 h-5 text-emerald-400" /></div>
                        <span className="text-slate-300 text-xs font-bold uppercase tracking-widest">Patrimônio Total</span>
                    </div>
                    <div className="text-3xl font-black tracking-tight">{showValues ? formatCurrency(currentTotal) : 'R$ ••••••'}</div>
                </div>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 rounded-lg"><TrendingUp className="w-5 h-5 text-indigo-600 dark:text-indigo-400" /></div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Total Investido</span>
                </div>
                <div className="text-3xl font-black text-slate-900 dark:text-white">{showValues ? formatCurrency(totalInvested) : 'R$ ••••••'}</div>
            </Card>

            <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`p-2 rounded-lg ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-900/30' : 'bg-red-50 dark:bg-red-900/30'}`}>
                        {profit >= 0 ? <ArrowUpRight className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> : <ArrowDownRight className="w-5 h-5 text-red-600 dark:text-red-400" />}
                    </div>
                    <span className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest">Rentabilidade</span>
                </div>
                <div className={`text-3xl font-black tracking-tight ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                    {showValues ? formatCurrency(profit) : '••••••'}
                    <span className="text-sm font-bold ml-2 opacity-80 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded-lg text-slate-600 dark:text-slate-300 inline-block align-middle">
                        {profitPercentage.toFixed(2)}%
                    </span>
                </div>
            </Card>
        </div>
    );
};
