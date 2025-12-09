import React, { useState } from 'react';
import { Trip, Transaction, TransactionType } from '../../../types';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Target, Pencil, X, Save, Sparkles, Calculator, ArrowRight } from 'lucide-react';
import { formatCurrency, getCategoryIcon, parseDate } from '../../../utils';
import { calculateTripDebts } from '../../../services/balanceEngine';

interface TripOverviewProps {
    trip: Trip;
    transactions: Transaction[];
    onUpdateTrip?: (trip: Trip) => void;
    onNavigateToShared?: () => void;
    onEditTransaction?: (id: string) => void;
}

export const TripOverview: React.FC<TripOverviewProps> = ({ trip, transactions, onUpdateTrip, onNavigateToShared, onEditTransaction }) => {
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempBudget, setTempBudget] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [loadingAi, setLoadingAi] = useState(false);

    const totalSpent = transactions.reduce((acc, t) => acc + (t.type === TransactionType.EXPENSE ? t.amount : 0), 0);
    const budget = trip.budget || 0;
    const percentUsed = budget > 0 ? (totalSpent / budget) * 100 : 0;
    const isOverBudget = totalSpent > budget && budget > 0;
    const remaining = budget - totalSpent;

    const handleSaveBudget = () => {
        if (!onUpdateTrip) return;
        const budgetVal = parseFloat(tempBudget);
        if (isNaN(budgetVal) || budgetVal < 0) {
            alert("Orçamento inválido.");
            return;
        }
        onUpdateTrip({ ...trip, budget: budgetVal });
        setIsEditingBudget(false);
    };

    const startEditingBudget = () => {
        setTempBudget(trip.budget?.toString() || '');
        setIsEditingBudget(true);
    };

    const handleSettlement = async () => {
        setLoadingAi(true);
        const settlementLines = calculateTripDebts(transactions, trip.participants);
        const report = `# Resumo do Acerto de Contas\n\n${settlementLines.map(l => `- ${l}`).join('\n')}\n\n---\n*Este cálculo considera apenas dívidas não quitadas.*`;
        setAiAnalysis(report);
        setLoadingAi(false);
    };

    return (
        <div className="space-y-6 animate-in slide-in-from-right-4 duration-300">
            {/* BUDGET CARD */}
            <Card className="border-violet-100 dark:border-violet-900">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2 text-violet-800 dark:text-violet-300">
                        <Target className="w-5 h-5" />
                        <h3 className="font-bold">Orçamento da Viagem</h3>
                    </div>
                    {!isEditingBudget ? (
                        <button onClick={startEditingBudget} className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/30 rounded-full transition-colors no-print">
                            <Pencil className="w-4 h-4" />
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditingBudget(false)} className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full"><X className="w-4 h-4" /></button>
                            <button onClick={handleSaveBudget} className="p-2 text-emerald-600 bg-emerald-50 dark:bg-emerald-900/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 rounded-full"><Save className="w-4 h-4" /></button>
                        </div>
                    )}
                </div>
                {isEditingBudget ? (
                    <div className="mb-4">
                        <label className="text-xs font-bold text-slate-600 dark:text-slate-400 uppercase">Definir Limite Total</label>
                        <input
                            type="number"
                            autoFocus
                            className="w-full text-2xl font-bold text-slate-800 dark:text-white border-b-2 border-violet-200 dark:border-violet-700 outline-none py-1 focus:border-violet-500 bg-transparent"
                            value={tempBudget}
                            onChange={e => setTempBudget(e.target.value)}
                            placeholder="0,00"
                        />
                    </div>
                ) : (
                    <>
                        <div className="mb-3">
                            <div className="flex justify-between text-sm font-medium mb-1">
                                <span className={`${isOverBudget ? 'text-red-700 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`}>
                                    {formatCurrency(totalSpent, trip.currency)} ({percentUsed.toFixed(0)}%)
                                </span>
                                <span className="text-slate-500 dark:text-slate-400">Meta: {formatCurrency(budget, trip.currency)}</span>
                            </div>
                            <div className="h-3 w-full bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-1000 ${percentUsed > 100 ? 'bg-red-600' : percentUsed > 75 ? 'bg-amber-500' : 'bg-emerald-600'}`}
                                    style={{ width: `${Math.min(percentUsed, 100)}%` }}
                                ></div>
                            </div>
                        </div>
                        {budget > 0 && (
                            <div className={`text-xs font-bold p-2 rounded-lg text-center ${isOverBudget ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-300' : 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-300'}`}>
                                {isOverBudget ? `Orçamento excedido em ${formatCurrency(Math.abs(remaining), trip.currency)}` : `Resta ${formatCurrency(remaining, trip.currency)} disponível`}
                            </div>
                        )}
                        {budget === 0 && (
                            <div className="text-xs text-center text-slate-500 dark:text-slate-400 italic">Defina um orçamento para acompanhar seu progresso.</div>
                        )}
                    </>
                )}
            </Card>

            {/* Transactions List */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden">
                <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 flex justify-between items-center">
                    <h3 className="font-bold text-slate-700 dark:text-slate-300">Histórico de Gastos</h3>
                </div>
                <div className="divide-y divide-slate-100 dark:divide-slate-700">
                    {transactions.length === 0 ? (
                        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                            <Sparkles className="w-8 h-8 text-violet-300 dark:text-violet-700 mx-auto mb-2" />
                            <p className="text-sm font-medium">Nenhuma despesa registrada ainda.</p>
                            <p className="text-xs text-slate-400 dark:text-slate-500">Comece a aproveitar sua viagem!</p>
                        </div>
                    ) : (
                        transactions.map(t => {
                            const CatIcon = getCategoryIcon(t.category);
                            // Calculate original foreign amount if exchange rate exists
                            const originalAmount = (t.exchangeRate && t.exchangeRate > 0)
                                ? t.amount / t.exchangeRate
                                : t.amount;

                            return (
                                <div
                                    key={t.id}
                                    onClick={() => onEditTransaction && onEditTransaction(t.id)}
                                    className="flex justify-between items-center p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer active:bg-slate-100"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="h-10 w-10 rounded-full bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center text-violet-700 dark:text-violet-400 font-bold border border-violet-100 dark:border-violet-800">
                                            <CatIcon className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-slate-900 dark:text-white">{t.description}</p>
                                            <div className="flex gap-2 text-xs text-slate-500 dark:text-slate-400">
                                                <span>{parseDate(t.date).toLocaleDateString('pt-BR')}</span>
                                                <span>•</span>
                                                <span>{t.category}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <span className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(originalAmount, trip.currency)}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </div>

            {/* AI Settlement */}
            <div className="space-y-4 no-print">
                <Card className="bg-slate-900 text-white border-none shadow-xl">
                    <div className="flex flex-col items-center text-center space-y-4 p-2">
                        <div className="p-3 bg-white/10 rounded-full">
                            <Sparkles className="w-8 h-8 text-yellow-400" />
                        </div>
                        <h3 className="text-xl font-bold">Divisão Inteligente</h3>
                        <p className="text-slate-300 text-sm leading-relaxed">Calcular quem deve quanto a quem (Split).</p>
                        <div className="w-full space-y-2">
                            <Button className="w-full bg-white text-slate-900 hover:bg-slate-100 font-bold rounded-xl" onClick={handleSettlement} isLoading={loadingAi}>
                                <Calculator className="w-4 h-4 mr-2" />Calcular Acerto Pendente
                            </Button>
                            {onNavigateToShared && (
                                <Button variant="secondary" className="w-full bg-slate-800 text-slate-200 hover:bg-slate-700 font-bold rounded-xl border-slate-700" onClick={onNavigateToShared}>
                                    Ver Detalhes no Compartilhado
                                    <ArrowRight className="w-4 h-4 ml-2" />
                                </Button>
                            )}
                        </div>
                    </div>
                </Card>
                {aiAnalysis && (
                    <Card title="Resultado do Acerto (Pendentes)" className="border-violet-200 shadow-md bg-violet-50/50">
                        <div className="prose prose-sm prose-violet max-w-none">
                            {aiAnalysis.split('\n').map((line, i) => (
                                <p key={i} className={`text-slate-700 text-sm mb-2 ${line.startsWith('#') ? 'font-bold mt-2 text-violet-900' : ''} ${line.startsWith('-') ? 'ml-4' : ''}`}>
                                    {line.replace(/^#+\s/, '').replace(/^-\s/, '• ')}
                                </p>
                            ))}
                        </div>
                    </Card>
                )}
            </div>
        </div>
    );
};
