import React, { useState, useMemo } from 'react';
import { Transaction, Category, Budget, TransactionType } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Edit2, Trash2, AlertTriangle, PieChart } from 'lucide-react';
import { formatCurrency, getCategoryIcon, parseDate } from '../utils';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { calculateEffectiveTransactionValue } from '../services/financialLogic';

interface BudgetsProps {
    transactions: Transaction[];
    budgets: Budget[];
    onAddBudget: (budget: Omit<Budget, 'id'>) => void;
    onUpdateBudget: (budget: Budget) => void;
    onDeleteBudget: (id: string) => void;
    currentDate: Date;
}

export const Budgets: React.FC<BudgetsProps> = ({ transactions, budgets, onAddBudget, onUpdateBudget, onDeleteBudget, currentDate }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingBudget, setEditingBudget] = useState<Budget | null>(null);
    const [newBudget, setNewBudget] = useState<Partial<Budget>>({
        period: 'MONTHLY',
        alertThreshold: 80,
        amount: 0,
        rollover: false
    });

    const { categorySpending, rolloverBalances } = useMemo(() => {
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();
        const spendingMap = new Map<string, number>();
        const currentMonthSpending: Record<string, number> = {};

        transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts (someone paid for me)
            .forEach(t => {
                if (t.type === TransactionType.EXPENSE && !t.isRefund) {
                    // ✅ FIX: Use parseDate to avoid Timezone shifts (e.g. 2025-05-01 becoming 2025-04-30)
                    const tDate = parseDate(t.date);
                    const tYear = tDate.getFullYear();
                    if (tYear === currentYear) {
                        const tMonth = tDate.getMonth();
                        // ✅ FIX: Fluxo de Caixa nos Orçamentos
                        // Se eu paguei 100, consumi 100 do meu orçamento de fluxo de caixa momentaneamente.
                        let effectiveAmount = t.amount;
                        if (t.isShared && t.payerId && t.payerId !== 'me') {
                            effectiveAmount = calculateEffectiveTransactionValue(t);
                        }
                        const key = `${t.category}|${tYear}|${tMonth}`;
                        spendingMap.set(key, (spendingMap.get(key) || 0) + effectiveAmount);
                        if (tMonth === currentMonth) {
                            currentMonthSpending[t.category] = (currentMonthSpending[t.category] || 0) + effectiveAmount;
                        }
                    }
                }
            });

        const rollovers: Record<string, number> = {};
        budgets.filter(b => b.rollover).forEach(budget => {
            let accumulated = 0;
            for (let m = 0; m < currentMonth; m++) {
                const key = `${budget.categoryId}|${currentYear}|${m}`;
                accumulated += (budget.amount - (spendingMap.get(key) || 0));
            }
            rollovers[budget.categoryId as string] = accumulated;
        });

        return { categorySpending: currentMonthSpending, rolloverBalances: rollovers };
    }, [transactions, budgets, currentDate]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBudget.categoryId || !newBudget.amount) return;
        if (editingBudget) { onUpdateBudget({ ...editingBudget, ...newBudget } as Budget); } else { onAddBudget(newBudget as Omit<Budget, 'id'>); }
        setIsFormOpen(false); setEditingBudget(null); setNewBudget({ period: 'MONTHLY', alertThreshold: 80, amount: 0, rollover: false });
    };

    const totalBudgeted = budgets.reduce((acc, b) => acc + b.amount, 0);
    const totalSpentInBudgets = budgets.reduce((acc, b) => acc + (categorySpending[b.categoryId] || 0), 0);
    const totalProgress = totalBudgeted > 0 ? (totalSpentInBudgets / totalBudgeted) * 100 : 0;

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div><h2 className="text-2xl font-bold text-slate-800 dark:text-white">Orçamentos</h2><p className="text-slate-600 dark:text-slate-400 text-sm">Planeje seus limites mensais.</p></div>
                <Button onClick={() => setIsFormOpen(true)}><Plus className="w-4 h-4 mr-2" /> Novo Orçamento</Button>
            </div>

            {/* Overview Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10"><PieChart className="w-32 h-32" /></div>
                <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4">
                        <div><p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Total Orçado</p><h3 className="text-3xl font-bold">{formatCurrency(totalBudgeted)}</h3></div>
                        <div className="text-right"><p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Gasto Atual</p><h3 className="text-2xl font-bold">{formatCurrency(totalSpentInBudgets)}</h3></div>
                    </div>
                    <div className="relative pt-1">
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-900/50">
                            <div style={{ width: `${Math.min(totalProgress, 100)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${totalProgress > 100 ? 'bg-red-500' : totalProgress > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                        </div>
                    </div>
                </div>
            </div>

            {isFormOpen && (
                <Card className="bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700" title={editingBudget ? "Editar Orçamento" : "Novo Orçamento"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Categoria</label><select className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" value={newBudget.categoryId || ''} onChange={e => setNewBudget({ ...newBudget, categoryId: e.target.value })} required><option value="">Selecione...</option>{Object.values(Category).map(c => (<option key={c} value={c}>{c}</option>))}</select></div>
                        <div><label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Limite Mensal</label><input type="number" step="0.01" className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-lg outline-none text-slate-900 dark:text-white" value={newBudget.amount || ''} onChange={e => setNewBudget({ ...newBudget, amount: Number(e.target.value) })} placeholder="0,00" required /></div>
                        <div className="flex items-center gap-2"><input type="checkbox" id="rollover" checked={newBudget.rollover || false} onChange={e => setNewBudget({ ...newBudget, rollover: e.target.checked })} className="w-4 h-4 rounded" /><label htmlFor="rollover" className="text-sm font-medium text-slate-700 dark:text-slate-300">Rollover (Acumular saldo)</label></div>
                        <div className="flex gap-3"><Button type="submit" className="flex-1">Salvar</Button><Button type="button" variant="ghost" onClick={() => { setIsFormOpen(false); setEditingBudget(null); }} className="flex-1">Cancelar</Button></div>
                    </form>
                </Card>
            )}

            <div className="grid grid-cols-1 gap-4">
                {budgets.map(budget => {
                    const spent = categorySpending[budget.categoryId] || 0;
                    const rollover = rolloverBalances[budget.categoryId as string] || 0;
                    const effectiveLimit = budget.amount + rollover;
                    const percentage = effectiveLimit > 0 ? (spent / effectiveLimit) * 100 : 0;
                    const isOver = percentage > 100;
                    const CatIcon = getCategoryIcon(budget.categoryId as string);

                    return (
                        <div key={budget.id} className={`bg-white dark:bg-slate-800 border rounded-2xl p-4 shadow-sm relative overflow-hidden ${isOver ? 'border-red-300 dark:border-red-700 ring-2 ring-red-500/20' : percentage > 80 ? 'border-amber-300 dark:border-amber-700' : 'border-slate-200 dark:border-slate-700'}`}>
                            {/* Alert Banner */}
                            {isOver && (
                                <div className="absolute top-0 left-0 right-0 bg-red-500 text-white text-xs font-bold px-3 py-1 flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    LIMITE EXCEDIDO em {formatCurrency(spent - effectiveLimit)}
                                </div>
                            )}
                            {!isOver && percentage > 80 && (
                                <div className="absolute top-0 left-0 right-0 bg-amber-500 text-white text-xs font-bold px-3 py-1 flex items-center gap-2">
                                    <AlertTriangle className="w-3 h-3" />
                                    ATENÇÃO: {percentage.toFixed(0)}% do limite usado
                                </div>
                            )}

                            <div className={`flex flex-wrap items-center justify-between mb-3 gap-3 ${isOver || percentage > 80 ? 'mt-6' : ''}`}>
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-xl ${isOver ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}><CatIcon className="w-6 h-6" /></div>
                                    <div><h3 className="font-bold text-slate-800 dark:text-white">{budget.categoryId}</h3><div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium"><span>Limite: {formatCurrency(budget.amount)}</span>{rollover !== 0 && (<span className={`px-1.5 py-0.5 rounded ${rollover > 0 ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'}`}>{rollover > 0 ? '+' : ''}{formatCurrency(rollover)}</span>)}</div></div>
                                </div>
                                <div className="flex gap-2"><button onClick={() => { setEditingBudget(budget); setNewBudget(budget); setIsFormOpen(true); }} className="p-2 text-slate-400 hover:text-indigo-600"><Edit2 className="w-4 h-4" /></button><button onClick={() => onDeleteBudget(budget.id)} className="p-2 text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button></div>
                            </div>
                            <div className="mb-1 flex justify-between items-center text-xs font-bold"><span className={`${isOver ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-400'}`}>{formatCurrency(spent)} de {formatCurrency(effectiveLimit)}</span><span className={`${isOver ? 'text-red-600' : 'text-emerald-600'}`}>{percentage.toFixed(0)}%</span></div>

                            {/* Progress Bar Fix: Better dark mode contrast */}
                            <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden border border-slate-200 dark:border-slate-600">
                                <div className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : percentage > 80 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};