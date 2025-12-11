import React, { useState } from 'react';
import { Trip, Transaction, TransactionType, Account, FamilyMember } from '../../../types';
import { TransactionList } from '../../transactions/TransactionList';
import { Card } from '../../ui/Card';
import { Button } from '../../ui/Button';
import { Target, Pencil, X, Save, Sparkles, Calculator, ArrowRight } from 'lucide-react';
import { formatCurrency, getCategoryIcon, parseDate } from '../../../utils';
import { calculateTripDebts } from '../../../services/balanceEngine';

interface TripOverviewProps {
    trip: Trip;
    transactions: Transaction[];
    accounts: Account[];
    familyMembers: FamilyMember[];
    onUpdateTrip?: (trip: Trip) => void;
    onNavigateToShared?: () => void;
    onEditTransaction?: (id: string) => void;
    onDeleteTransaction?: (id: string) => void;
}

export const TripOverview: React.FC<TripOverviewProps> = ({ trip, transactions, accounts, familyMembers, onUpdateTrip, onNavigateToShared, onEditTransaction, onDeleteTransaction }) => {
    const [isEditingBudget, setIsEditingBudget] = useState(false);
    const [tempBudget, setTempBudget] = useState('');
    const [aiAnalysis, setAiAnalysis] = useState<string>('');
    const [loadingAi, setLoadingAi] = useState(false);

    // Calculate totals in the TRIP'S currency (e.g. USD)
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
            {/* MODERN BUDGET WIDGET */}
            <div className="grid grid-cols-1 gap-4">
                <Card className="border-none shadow-lg bg-gradient-to-br from-white to-slate-50 dark:from-slate-800 dark:to-slate-900 overflow-hidden relative">
                    <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-500 to-fuchsia-500"></div>

                    <div className="flex justify-between items-start mb-6">
                        <div>
                            <span className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1 block">Orçamento Total</span>
                            <div className="flex items-baseline gap-2">
                                {isEditingBudget ? (
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            autoFocus
                                            className="text-3xl font-black bg-transparent border-b-2 border-violet-500 w-48 outline-none text-slate-900 dark:text-white"
                                            value={tempBudget}
                                            onChange={e => setTempBudget(e.target.value)}
                                            placeholder="0,00"
                                        />
                                        <button onClick={handleSaveBudget} className="p-2 bg-emerald-500 text-white rounded-lg hover:bg-emerald-600 transition-colors"><Save className="w-4 h-4" /></button>
                                        <button onClick={() => setIsEditingBudget(false)} className="p-2 bg-slate-200 text-slate-600 rounded-lg hover:bg-slate-300 transition-colors"><X className="w-4 h-4" /></button>
                                    </div>
                                ) : (
                                    <>
                                        <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">
                                            {formatCurrency(budget, trip.currency)}
                                        </h2>
                                        <button onClick={startEditingBudget} className="text-slate-300 hover:text-violet-500 transition-colors">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className={`px-3 py-1.5 rounded-full text-xs font-bold border flex items-center gap-1.5 ${isOverBudget
                            ? 'bg-red-50 text-red-600 border-red-100 dark:bg-red-900/20 dark:border-red-900'
                            : remaining < (budget * 0.2)
                                ? 'bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-900'
                                : 'bg-emerald-50 text-emerald-600 border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-900'
                            }`}>
                            <div className={`w-2 h-2 rounded-full ${isOverBudget ? 'bg-red-500' : remaining < (budget * 0.2) ? 'bg-amber-500' : 'bg-emerald-500'
                                }`}></div>
                            {isOverBudget ? 'ESTOUROU' : remaining < (budget * 0.2) ? 'ATENÇÃO' : 'DENTRO DA META'}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <div className="flex justify-between text-sm font-semibold">
                            <span className="text-slate-600 dark:text-slate-400">Gasto: <span className="text-slate-900 dark:text-white">{formatCurrency(totalSpent, trip.currency)}</span></span>
                            <span className={`${remaining < 0 ? 'text-red-500' : 'text-emerald-500'}`}>
                                {remaining < 0 ? 'Excedente: ' : 'Disponível: '}
                                {formatCurrency(Math.abs(remaining), trip.currency)}
                            </span>
                        </div>

                        <div className="h-4 w-full bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden p-1">
                            <div
                                className={`h-full rounded-full transition-all duration-1000 shadow-sm ${percentUsed > 100 ? 'bg-gradient-to-r from-red-500 to-red-600' :
                                    percentUsed > 75 ? 'bg-gradient-to-r from-amber-400 to-orange-500' :
                                        'bg-gradient-to-r from-emerald-400 to-emerald-600'
                                    }`}
                                style={{ width: `${Math.min(percentUsed, 100)}%` }}
                            ></div>
                        </div>
                        <p className="text-right text-[10px] font-bold text-slate-400 uppercase tracking-wider">{percentUsed.toFixed(1)}% USADO</p>
                    </div>
                </Card>
            </div >

            {/* Transactions List - UNWRAPPED to look like Main Feed */}
            < div className="pt-4" >
                <div className="flex items-center gap-4 mb-6 px-2">
                    <h3 className="font-bold text-lg text-slate-800 dark:text-white">Linha do Tempo</h3>
                    <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800"></div>
                </div>

                <TransactionList
                    groupedTxs={
                        transactions.reduce((groups, t) => {
                            const date = t.date;
                            if (!groups[date]) groups[date] = [];
                            groups[date].push(t);
                            return groups;
                        }, {} as Record<string, Transaction[]>)
                    }
                    accounts={accounts}
                    familyMembers={familyMembers}
                    showValues={true}
                    onEdit={(t) => onEditTransaction && onEditTransaction(t.id)}
                    onDelete={(id) => onDeleteTransaction && onDeleteTransaction(id)}
                    onAddClick={() => { }}
                    emptyMessage="Nenhuma despesa nesta viagem ainda."
                />
            </div >
        </div >
    );
};
