import React, { useState, useMemo } from 'react';
import { Transaction, Category, Budget, TransactionType } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Edit2, Trash2, AlertTriangle, CheckCircle2, TrendingUp, PieChart, ArrowRight } from 'lucide-react';
import { formatCurrency, getCategoryIcon } from '../utils';

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

    // Calculate spending per category for the current month
    const categorySpending = useMemo(() => {
        const spending: Record<string, number> = {};
        const currentMonth = currentDate.getMonth();
        const currentYear = currentDate.getFullYear();

        transactions.forEach(t => {
            if (t.type === TransactionType.EXPENSE && !t.isRefund) {
                const tDate = new Date(t.date);
                if (tDate.getMonth() === currentMonth && tDate.getFullYear() === currentYear) {
                    const cat = t.category;
                    spending[cat] = (spending[cat] || 0) + t.amount;
                }
            }
        });
        return spending;
    }, [transactions, currentDate]);

    // Calculate Rollover Balances (Accumulated savings/debt from previous months of the current year)
    const rolloverBalances = useMemo(() => {
        const balances: Record<string, number> = {};
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth();

        budgets.filter(b => b.rollover).forEach(budget => {
            let accumulated = 0;
            // Iterate from Jan to Last Month
            for (let m = 0; m < currentMonth; m++) {
                // Calculate spending for month 'm'
                const spentInMonth = transactions.reduce((acc, t) => {
                    if (t.type === TransactionType.EXPENSE && !t.isRefund && t.category === budget.categoryId) {
                        const tDate = new Date(t.date);
                        if (tDate.getMonth() === m && tDate.getFullYear() === currentYear) {
                            return acc + t.amount;
                        }
                    }
                    return acc;
                }, 0);

                accumulated += (budget.amount - spentInMonth);
            }
            balances[budget.categoryId as string] = accumulated;
        });
        return balances;
    }, [transactions, budgets, currentDate]);

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newBudget.categoryId || !newBudget.amount) return;

        if (editingBudget) {
            onUpdateBudget({ ...editingBudget, ...newBudget } as Budget);
        } else {
            onAddBudget(newBudget as Omit<Budget, 'id'>);
        }
        setIsFormOpen(false);
        setEditingBudget(null);
        setNewBudget({ period: 'MONTHLY', alertThreshold: 80, amount: 0, rollover: false });
    };

    const handleEdit = (budget: Budget) => {
        setEditingBudget(budget);
        setNewBudget(budget);
        setIsFormOpen(true);
    };

    // Calculate total budget vs total spending
    const totalBudgeted = budgets.reduce((acc, b) => acc + b.amount, 0);
    const totalSpentInBudgets = budgets.reduce((acc, b) => acc + (categorySpending[b.categoryId] || 0), 0);
    const totalProgress = totalBudgeted > 0 ? (totalSpentInBudgets / totalBudgeted) * 100 : 0;

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-slate-800">Orçamentos Inteligentes</h2>
                    <p className="text-slate-600 text-sm">Planeje seus gastos e economize mais.</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)} className="shadow-lg shadow-indigo-500/20">
                    <Plus className="w-4 h-4 mr-2" /> Novo Orçamento
                </Button>
            </div>

            {/* Overview Card */}
            <div className="bg-gradient-to-br from-indigo-600 to-violet-700 rounded-2xl p-6 text-white shadow-xl relative overflow-hidden">
                <div className="absolute top-0 right-0 p-6 opacity-10">
                    <PieChart className="w-32 h-32" />
                </div>
                <div className="relative z-10">
                    <div className="flex justify-between items-end mb-4">
                        <div>
                            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Total Orçado (Mês)</p>
                            <h3 className="text-3xl font-bold">{formatCurrency(totalBudgeted)}</h3>
                        </div>
                        <div className="text-right">
                            <p className="text-indigo-100 text-xs font-bold uppercase tracking-wider mb-1">Gasto Atual</p>
                            <h3 className="text-2xl font-bold">{formatCurrency(totalSpentInBudgets)}</h3>
                        </div>
                    </div>

                    <div className="relative pt-1">
                        <div className="flex mb-2 items-center justify-between">
                            <div>
                                <span className="text-xs font-semibold inline-block py-1 px-2 uppercase rounded-full text-indigo-600 bg-indigo-200">
                                    Progresso Geral
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="text-xs font-semibold inline-block text-white">
                                    {totalProgress.toFixed(0)}%
                                </span>
                            </div>
                        </div>
                        <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-indigo-900/50">
                            <div style={{ width: `${Math.min(totalProgress, 100)}%` }} className={`shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center ${totalProgress > 100 ? 'bg-red-500' : totalProgress > 80 ? 'bg-amber-400' : 'bg-emerald-400'}`}></div>
                        </div>
                    </div>
                </div>
            </div>

            {isFormOpen && (
                <Card className="bg-slate-50/50 border-slate-200" title={editingBudget ? "Editar Orçamento" : "Novo Orçamento"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Categoria</label>
                            <select
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                                value={newBudget.categoryId || ''}
                                onChange={e => setNewBudget({ ...newBudget, categoryId: e.target.value })}
                                required
                            >
                                <option value="">Selecione...</option>
                                {Object.values(Category).map(c => (
                                    <option key={c} value={c}>{c}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-1">Limite Mensal</label>
                            <input
                                type="number"
                                step="0.01"
                                className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-slate-900"
                                value={newBudget.amount || ''}
                                onChange={e => setNewBudget({ ...newBudget, amount: Number(e.target.value) })}
                                placeholder="0,00"
                                required
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                id="rollover"
                                checked={newBudget.rollover || false}
                                onChange={e => setNewBudget({ ...newBudget, rollover: e.target.checked })}
                                className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                            />
                            <label htmlFor="rollover" className="text-sm font-medium text-slate-700">
                                Rollover (Saldo não utilizado passa para o próximo mês)
                            </label>
                        </div>
                        <div className="flex gap-3">
                            <Button type="submit" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">Salvar</Button>
                            <Button type="button" variant="ghost" onClick={() => { setIsFormOpen(false); setEditingBudget(null); }} className="flex-1">Cancelar</Button>
                        </div>
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
                    const isWarning = percentage >= budget.alertThreshold;
                    const CatIcon = getCategoryIcon(budget.categoryId as string);

                    return (
                        <div key={budget.id} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm relative overflow-hidden group">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-slate-100 rounded-xl text-slate-600">
                                        <CatIcon className="w-6 h-6" />
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-800">{budget.categoryId}</h3>
                                        <div className="flex items-center gap-2 text-xs text-slate-500 font-medium">
                                            <span>Limite Mensal: {formatCurrency(budget.amount)}</span>
                                            {budget.rollover && rollover !== 0 && (
                                                <span className={`px-1.5 py-0.5 rounded ${rollover > 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                                                    {rollover > 0 ? '+' : ''}{formatCurrency(rollover)} (Rollover)
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => handleEdit(budget)} className="p-2 text-slate-400 hover:text-indigo-600 transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => onDeleteBudget(budget.id)} className="p-2 text-slate-400 hover:text-red-600 transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            <div className="mb-1 flex justify-between items-center text-xs font-bold">
                                <span className={`${isOver ? 'text-red-600' : 'text-slate-600'}`}>
                                    {formatCurrency(spent)} gasto de {formatCurrency(effectiveLimit)}
                                </span>
                                <span className={`${isOver ? 'text-red-600' : isWarning ? 'text-amber-600' : 'text-emerald-600'}`}>{percentage.toFixed(0)}%</span>
                            </div>

                            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-red-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-500'}`}
                                    style={{ width: `${Math.min(percentage, 100)}%` }}
                                />
                            </div>

                            {isOver && (
                                <div className="mt-3 flex items-center gap-2 text-xs font-bold text-red-600 bg-red-50 p-2 rounded-lg">
                                    <AlertTriangle className="w-4 h-4" />
                                    Você excedeu o orçamento desta categoria!
                                </div>
                            )}
                        </div>
                    );
                })}

                {budgets.length === 0 && !isFormOpen && (
                    <div className="text-center py-10 bg-slate-50 rounded-2xl border border-dashed border-slate-300">
                        <div className="bg-white p-4 rounded-full inline-flex mb-3 shadow-sm">
                            <TrendingUp className="w-8 h-8 text-slate-400" />
                        </div>
                        <p className="text-slate-600 font-medium">Nenhum orçamento definido.</p>
                        <p className="text-slate-400 text-sm mt-1">Crie limites para suas categorias e controle seus gastos.</p>
                        <Button onClick={() => setIsFormOpen(true)} variant="ghost" className="mt-4 text-indigo-600 hover:bg-indigo-50">
                            Criar Primeiro Orçamento
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};