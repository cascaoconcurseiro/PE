import React from 'react';
import { Wallet, TrendingUp, TrendingDown, LineChart, AlertCircle } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';

interface FinancialProjectionCardProps {
    projectedBalance: number;
    currentBalance: number;
    pendingIncome: number;
    pendingExpenses: number;
    monthlyIncome: number;
    monthlyExpense: number;
    healthStatus: 'POSITIVE' | 'WARNING' | 'CRITICAL';
    currentDate: Date;
    showValues: boolean;
}

export const FinancialProjectionCard: React.FC<FinancialProjectionCardProps> = ({
    projectedBalance,
    currentBalance,
    pendingIncome,
    pendingExpenses,
    monthlyIncome,
    monthlyExpense,
    healthStatus,
    currentDate,
    showValues
}) => {
    // Detect if viewing a past month
    const now = new Date();
    const viewingMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isViewingPastMonth = viewingMonthStart < currentMonthStart;
    const isViewingFutureMonth = viewingMonthStart > currentMonthStart;

    // Adjust labels based on period
    const balanceLabel = isViewingPastMonth
        ? 'Resultado do Mês'
        : isViewingFutureMonth
            ? 'Saldo Projetado'
            : 'Saldo Final Previsto';

    // For past months, show actual monthly result (income - expense), not projected balance
    // For current/future months, show projected balance
    const displayBalance = isViewingPastMonth
        ? (monthlyIncome - monthlyExpense)
        : projectedBalance;

    return (
        <div className="bg-indigo-900 dark:bg-indigo-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
                <LineChart className="w-40 h-40 text-white" />
            </div>

            <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-8 items-center">
                <div>
                    <div className="flex items-center gap-2 mb-2 text-indigo-300">
                        <Wallet className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">{balanceLabel}</span>
                    </div>
                    <div className="mb-1">
                        <span className={`text-4xl font-black tracking-tight ${displayBalance < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                            <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(displayBalance)}</PrivacyBlur>
                        </span>
                    </div>
                    <p className="text-sm text-indigo-200">
                        {isViewingPastMonth
                            ? `Receitas - Despesas em ${currentDate.toLocaleDateString('pt-BR', { month: 'long' })}`
                            : `Receitas - Despesas em ${currentDate.toLocaleDateString('pt-BR', { month: 'long' })}`}
                    </p>
                </div>

                <div className="bg-white/10 rounded-2xl p-4 backdrop-blur-sm border border-white/10">
                    <div className="space-y-4 text-xs">
                        <div className="flex justify-between items-center text-emerald-300">
                            <span className="flex items-center gap-1"><TrendingUp className="w-3 h-3" /> A Receber</span>
                            <span className="font-bold text-sm">
                                <PrivacyBlur showValues={showValues} darkBg={true}>+ {formatCurrency(pendingIncome)}</PrivacyBlur>
                            </span>
                        </div>
                        <div className="flex justify-between items-center text-red-300">
                            <span className="flex items-center gap-1"><TrendingDown className="w-3 h-3" /> A Pagar</span>
                            <span className="font-bold text-sm">
                                <PrivacyBlur showValues={showValues} darkBg={true}>- {formatCurrency(pendingExpenses)}</PrivacyBlur>
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {healthStatus === 'CRITICAL' && (
                <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-300 shrink-0" />
                    <div>
                        <p className="text-sm font-bold text-red-100">Atenção ao Orçamento</p>
                        <p className="text-xs text-red-200">Suas despesas projetadas superam suas receitas este mês. Revise seus gastos.</p>
                    </div>
                </div>
            )}
        </div>
    );
};