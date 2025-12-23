import React from 'react';
import { formatCurrency } from '../../utils';
import { ArrowUpRight, ArrowDownLeft, Wallet } from 'lucide-react';

// Reusable Blur Component
const BlurValue = ({ value, show, scale = 1, currency = 'BRL' }: { value: number, show: boolean, scale?: number, currency?: string }) => {
    if (show) return <>{formatCurrency(value, currency)}</>;
    return <span className={`blur-sm select-none opacity-60 scale-${scale * 100}`}>{currency === 'BRL' ? 'R$' : currency} ••••</span>;
};

interface TransactionSummaryProps {
    income: number;
    expense: number;
    balance: number;
    showValues: boolean;
    currency?: string;
}

export const TransactionSummary: React.FC<TransactionSummaryProps> = ({ income, expense, balance, showValues, currency = 'BRL' }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* SALDO CARD - PREMIUM GRADIENT */}
            <div className="relative overflow-hidden rounded-3xl bg-slate-900 shadow-xl col-span-1 md:col-span-1 border border-slate-700">
                <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -ml-16 -mb-16"></div>

                <div className="relative p-6 flex flex-col justify-between h-full">
                    <div className="flex items-center gap-2 mb-2">
                        <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-indigo-400">
                            <Wallet className="w-4 h-4" />
                        </div>
                        <span className="text-sm font-bold text-slate-400 uppercase tracking-wider">Saldo Atual</span>
                    </div>
                    <div>
                        <span className={`text-3xl font-black tracking-tight ${balance >= 0 ? 'text-white' : 'text-red-400'}`}>
                            <BlurValue value={balance} show={showValues} currency={currency} />
                        </span>
                    </div>
                </div>
            </div>

            {/* INCOME CARD */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center gap-1 group hover:border-emerald-200 dark:hover:border-emerald-900/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Entradas</span>
                    <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center text-emerald-600 dark:text-emerald-400 group-hover:scale-110 transition-transform duration-300">
                        <ArrowDownLeft className="w-4 h-4" />
                    </div>
                </div>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">
                    <BlurValue value={income} show={showValues} currency={currency} />
                </span>
            </div>

            {/* EXPENSE CARD */}
            <div className="bg-white dark:bg-slate-800 rounded-3xl p-6 border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col justify-center gap-1 group hover:border-red-200 dark:hover:border-red-900/50 transition-colors">
                <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Saídas</span>
                    <div className="w-8 h-8 rounded-full bg-red-50 dark:bg-red-900/20 flex items-center justify-center text-red-600 dark:text-red-400 group-hover:scale-110 transition-transform duration-300">
                        <ArrowUpRight className="w-4 h-4" />
                    </div>
                </div>
                <span className="text-2xl font-black text-red-600 dark:text-red-400 tracking-tight">
                    <BlurValue value={expense} show={showValues} currency={currency} />
                </span>
            </div>
        </div>
    );
};