import React from 'react';
import { Wallet, TrendingUp, TrendingDown, LineChart, AlertCircle, CheckCircle2, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils';
import { PrivacyBlur } from '../ui/PrivacyBlur';

interface FinancialProjectionCardProps {
    projectedBalance: number;
    currentBalance: number;
    pendingIncome: number;
    pendingExpenses: number;
    totalMonthIncome: number;
    totalMonthExpenses: number;
    realizedIncome: number;
    realizedExpenses: number;
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
    totalMonthIncome,
    totalMonthExpenses,
    realizedIncome,
    realizedExpenses,
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

    // Resultado do mês
    const monthResult = totalMonthIncome - totalMonthExpenses;

    // Labels baseados no período
    const resultLabel = isViewingPastMonth
        ? 'Resultado do Mês'
        : isViewingFutureMonth
            ? 'Resultado Projetado'
            : 'Resultado Previsto';

    const monthName = currentDate.toLocaleDateString('pt-BR', { month: 'long' });

    return (
        <div className="bg-indigo-900 dark:bg-indigo-950 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            <div className="absolute top-0 right-0 p-6 opacity-10">
                <LineChart className="w-40 h-40 text-white" />
            </div>

            <div className="relative z-10">
                {/* Header com Resultado do Mês */}
                <div className="mb-6">
                    <div className="flex items-center gap-2 mb-2 text-indigo-300">
                        <Wallet className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">{resultLabel}</span>
                    </div>
                    <div className="mb-1">
                        <span className={`text-4xl font-black tracking-tight ${monthResult < 0 ? 'text-red-300' : 'text-emerald-300'}`}>
                            <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(monthResult)}</PrivacyBlur>
                        </span>
                    </div>
                    <p className="text-sm text-indigo-200">
                        Receitas - Despesas em {monthName}
                    </p>
                </div>

                {/* Grid com Receitas e Despesas */}
                <div className="grid grid-cols-2 gap-4">
                    {/* Total a Receber */}
                    <div className="bg-emerald-500/20 rounded-2xl p-4 border border-emerald-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingUp className="w-4 h-4 text-emerald-300" />
                            <span className="text-xs font-semibold text-emerald-200 uppercase">Total a Receber</span>
                        </div>
                        <div className="text-2xl font-bold text-emerald-300 mb-3">
                            <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(totalMonthIncome)}</PrivacyBlur>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-emerald-200/80">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Recebido
                                </span>
                                <span><PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(realizedIncome)}</PrivacyBlur></span>
                            </div>
                            <div className="flex justify-between text-emerald-200/80">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Pendente
                                </span>
                                <span><PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(pendingIncome)}</PrivacyBlur></span>
                            </div>
                        </div>
                    </div>

                    {/* Total a Pagar */}
                    <div className="bg-red-500/20 rounded-2xl p-4 border border-red-500/30">
                        <div className="flex items-center gap-2 mb-3">
                            <TrendingDown className="w-4 h-4 text-red-300" />
                            <span className="text-xs font-semibold text-red-200 uppercase">Total a Pagar</span>
                        </div>
                        <div className="text-2xl font-bold text-red-300 mb-3">
                            <PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(totalMonthExpenses)}</PrivacyBlur>
                        </div>
                        <div className="space-y-1 text-xs">
                            <div className="flex justify-between text-red-200/80">
                                <span className="flex items-center gap-1">
                                    <CheckCircle2 className="w-3 h-3" /> Pago
                                </span>
                                <span><PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(realizedExpenses)}</PrivacyBlur></span>
                            </div>
                            <div className="flex justify-between text-red-200/80">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" /> Pendente
                                </span>
                                <span><PrivacyBlur showValues={showValues} darkBg={true}>{formatCurrency(pendingExpenses)}</PrivacyBlur></span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Alerta de saúde financeira */}
                {healthStatus === 'CRITICAL' && (
                    <div className="mt-4 bg-red-500/20 border border-red-500/30 rounded-xl p-3 flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 text-red-300 shrink-0" />
                        <div>
                            <p className="text-sm font-bold text-red-100">Atenção ao Orçamento</p>
                            <p className="text-xs text-red-200">Suas despesas superam suas receitas este mês. Revise seus gastos.</p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
