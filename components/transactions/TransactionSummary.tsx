import React from 'react';
import { formatCurrency } from '../../utils';

interface TransactionSummaryProps {
    income: number;
    expense: number;
    balance: number;
    showValues: boolean;
}

const BlurValue = ({ value, show }: { value: number, show: boolean }) => {
    if (show) return <>{formatCurrency(value)}</>;
    return <span className="blur-sm select-none opacity-60">R$ ••••</span>;
};

export const TransactionSummary: React.FC<TransactionSummaryProps> = ({ income, expense, balance, showValues }) => {
    return (
        <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Entradas</span>
                <span className="text-sm font-black text-emerald-600">
                    <BlurValue value={income} show={showValues} />
                </span>
            </div>
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-sm flex flex-col items-center justify-center">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saídas</span>
                <span className="text-sm font-black text-red-600">
                    <BlurValue value={expense} show={showValues} />
                </span>
            </div>
            <div className="bg-slate-900 rounded-2xl p-4 shadow-lg flex flex-col items-center justify-center text-white">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Saldo</span>
                <span className={`text-sm font-black ${balance >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                    <BlurValue value={balance} show={showValues} />
                </span>
            </div>
        </div>
    );
};