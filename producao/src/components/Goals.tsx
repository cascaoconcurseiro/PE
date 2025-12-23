import React, { useState } from 'react';
import { Goal, Account, Transaction, TransactionType, Category } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Edit2, Trash2, Target, Trophy, Calendar, TrendingUp, Minus, X, Wallet, CheckCircle2 } from 'lucide-react';
import { formatCurrency } from '../utils';
import { GoalsSummary } from './goals/GoalsSummary';

interface GoalsProps {
    goals: Goal[];
    accounts: Account[];
    onAddGoal: (goal: Omit<Goal, 'id'>) => void;
    onUpdateGoal: (goal: Goal) => void;
    onDeleteGoal: (id: string) => void;
    onAddTransaction: (transaction: Omit<Transaction, 'id'>) => void;
}

export const Goals: React.FC<GoalsProps> = ({ goals, accounts, onAddGoal, onUpdateGoal, onDeleteGoal, onAddTransaction }) => {
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingGoal, setEditingGoal] = useState<Goal | null>(null);

    // Transaction Modal State
    const [transactingGoal, setTransactingGoal] = useState<Goal | null>(null);
    const [transactionType, setTransactionType] = useState<'DEPOSIT' | 'WITHDRAW'>('DEPOSIT');
    const [transactionAmount, setTransactionAmount] = useState('');
    const [selectedAccountId, setSelectedAccountId] = useState('');

    const [newGoal, setNewGoal] = useState<Partial<Goal>>({
        currentAmount: 0,
        targetAmount: 0
    });

    const handleSave = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGoal.name || !newGoal.targetAmount) return;

        if (editingGoal) {
            onUpdateGoal({ ...editingGoal, ...newGoal } as Goal);
        } else {
            onAddGoal(newGoal as Omit<Goal, 'id'>);
        }
        setIsFormOpen(false);
        setEditingGoal(null);
        setNewGoal({ currentAmount: 0, targetAmount: 0 });
    };

    const handleEdit = (goal: Goal) => {
        setEditingGoal(goal);
        setNewGoal(goal);
        setIsFormOpen(true);
    };

    const openTransactionModal = (goal: Goal, type: 'DEPOSIT' | 'WITHDRAW') => {
        setTransactingGoal(goal);
        setTransactionType(type);
        setTransactionAmount('');
        // Auto-select first account if available
        if (accounts.length > 0) setSelectedAccountId(accounts[0].id);
    };

    const submitTransaction = (e: React.FormEvent) => {
        e.preventDefault();
        if (!transactingGoal || !transactionAmount || !selectedAccountId) return;

        const amount = Number(transactionAmount);

        // 1. Update Goal Amount
        const newAmount = transactionType === 'DEPOSIT'
            ? transactingGoal.currentAmount + amount
            : transactingGoal.currentAmount - amount;

        onUpdateGoal({ ...transactingGoal, currentAmount: newAmount });

        // 2. Create Real Transaction
        const transaction: Omit<Transaction, 'id'> = {
            description: transactionType === 'DEPOSIT' ? `Depósito Meta: ${transactingGoal.name}` : `Resgate Meta: ${transactingGoal.name}`,
            amount: amount,
            date: new Date().toISOString().split('T')[0],
            type: transactionType === 'DEPOSIT' ? TransactionType.EXPENSE : TransactionType.INCOME,
            accountId: selectedAccountId,
            category: Category.INVESTMENT,
            isRecurring: false,
            currency: 'BRL',
            domain: 'PERSONAL'
        };

        onAddTransaction(transaction);

        setTransactingGoal(null);
    };

    return (
        <div className="space-y-6 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Metas Financeiras</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Transforme sonhos em realidade.</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)} size="sm" className="shadow-md shadow-emerald-500/20 bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Meta
                </Button>
            </div>

            <GoalsSummary goals={goals} />

            {/* Transaction Modal Overlay */}
            {transactingGoal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-2xl w-full max-w-xs overflow-hidden transform scale-100 transition-all">
                        <div className={`p-5 text-white flex justify-between items-center ${transactionType === 'DEPOSIT' ? 'bg-gradient-to-r from-emerald-600 to-teal-600' : 'bg-gradient-to-r from-red-500 to-rose-600'}`}>
                            <div>
                                <h3 className="font-bold text-base flex items-center gap-2">
                                    {transactionType === 'DEPOSIT' ? <Plus className="w-5 h-5" /> : <Minus className="w-5 h-5" />}
                                    {transactionType === 'DEPOSIT' ? 'Investir na Meta' : 'Resgatar Valor'}
                                </h3>
                                <p className="text-xs opacity-90 mt-1">{transactingGoal.name}</p>
                            </div>
                            <button onClick={() => setTransactingGoal(null)} className="p-1.5 hover:bg-white/20 rounded-full transition-colors active:scale-90">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <form onSubmit={submitTransaction} className="p-6">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-bold uppercase tracking-wider text-center">
                                {transactionType === 'DEPOSIT' ? 'Quanto você vai guardar?' : 'Quanto deseja retirar?'}
                            </p>

                            <div className="relative mb-6">
                                <span className={`absolute left-4 top-1/2 -translate-y-1/2 font-bold text-xl ${transactionType === 'DEPOSIT' ? 'text-emerald-600' : 'text-red-500'}`}>R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    autoFocus
                                    value={transactionAmount}
                                    onChange={e => setTransactionAmount(e.target.value)}
                                    className={`w-full pl-12 pr-4 py-4 text-3xl font-black text-center border-2 rounded-2xl outline-none transition-all bg-slate-50 dark:bg-slate-900 ${transactionType === 'DEPOSIT' ? 'border-emerald-100 dark:border-emerald-900 focus:border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-red-100 dark:border-red-900 focus:border-red-500 text-red-700 dark:text-red-400'}`}
                                    placeholder="0,00"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2 pl-1">
                                    {transactionType === 'DEPOSIT' ? 'Origem do dinheiro:' : 'Destino do dinheiro:'}
                                </label>
                                <div className="relative">
                                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        className="w-full pl-9 pr-3 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 appearance-none transition-shadow"
                                        value={selectedAccountId}
                                        onChange={e => setSelectedAccountId(e.target.value)}
                                        required
                                    >
                                        <option value="" disabled>Selecione uma conta</option>
                                        {accounts.map(acc => (
                                            <option key={acc.id} value={acc.id}>{acc.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <Button type="submit" className={`w-full py-6 text-base font-bold rounded-xl shadow-lg transition-transform active:scale-[0.98] ${transactionType === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-500/20' : 'bg-red-500 hover:bg-red-600 shadow-red-500/20'} text-white`}>
                                Confirmar
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {isFormOpen && (
                <Card className="bg-white dark:bg-slate-800 border-none shadow-xl ring-1 ring-slate-200 dark:ring-slate-700 mb-6" title={editingGoal ? "Editar Meta" : "Nova Meta"}>
                    <form onSubmit={handleSave} className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Nome da Meta</label>
                            <input
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm font-medium transition-all"
                                value={newGoal.name || ''}
                                onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                                placeholder="Ex: Viagem para Europa"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Valor Alvo (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm font-medium transition-all"
                                    value={newGoal.targetAmount || ''}
                                    onChange={e => setNewGoal({ ...newGoal, targetAmount: Number(e.target.value) })}
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Já Guardado (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm font-medium transition-all"
                                    value={newGoal.currentAmount || ''}
                                    onChange={e => setNewGoal({ ...newGoal, currentAmount: Number(e.target.value) })}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5">Prazo Estimado</label>
                            <input
                                type="date"
                                onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                className="w-full px-3 py-2.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm font-medium transition-all"
                                value={newGoal.deadline || ''}
                                onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })}
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <Button type="submit" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">Salvar</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setIsFormOpen(false); setEditingGoal(null); }} className="flex-1 text-slate-600 dark:text-slate-400">Cancelar</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {goals.map(goal => {
                    const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                    const isCompleted = percentage >= 100;

                    return (
                        <div key={goal.id} className="group bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl p-5 shadow-sm relative overflow-hidden hover:shadow-lg transition-all duration-300 hover:border-emerald-200 dark:hover:border-emerald-800">
                            {/* Card Header & Actions */}
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-start gap-3">
                                    <div className={`p-3 rounded-2xl ${isCompleted ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400' : 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-400'} shadow-inner`}>
                                        {isCompleted ? <Trophy className="w-6 h-6" /> : <Target className="w-6 h-6" />}
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white text-base leading-tight group-hover:text-emerald-700 dark:group-hover:text-emerald-400 transition-colors">{goal.name}</h3>
                                        {goal.deadline && (
                                            <p className="text-[11px] font-medium text-slate-400 mt-1 flex items-center gap-1">
                                                <Calendar className="w-3 h-3" />
                                                {new Date(goal.deadline).toLocaleDateString()}
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => handleEdit(goal)} className="p-2 text-slate-300 hover:text-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-900/30 rounded-xl transition-colors"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => onDeleteGoal(goal.id)} className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                                </div>
                            </div>

                            {/* Progress Section */}
                            <div className="mb-5">
                                <div className="flex justify-between items-end mb-2">
                                    <span className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{formatCurrency(goal.currentAmount)}</span>
                                    <div className="text-right">
                                        <p className="text-[10px] uppercase font-bold text-slate-400 mb-0.5">Alvo</p>
                                        <p className="text-sm font-bold text-slate-600 dark:text-slate-300">{formatCurrency(goal.targetAmount)}</p>
                                    </div>
                                </div>

                                <div className="relative h-3 bg-slate-100 dark:bg-slate-700/50 rounded-full overflow-hidden">
                                    <div
                                        className={`absolute top-0 left-0 h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-gradient-to-r from-amber-400 to-orange-500' : 'bg-gradient-to-r from-emerald-400 to-teal-500'}`}
                                        style={{ width: `${percentage}%` }}
                                    >
                                        <div className="absolute top-0 left-0 w-full h-full bg-white/20 animate-pulse-slow"></div>
                                    </div>
                                </div>
                                <div className="flex justify-between mt-1.5 items-center">
                                    <span className={`text-[10px] font-bold ${isCompleted ? 'text-amber-600' : 'text-emerald-600'}`}>{percentage.toFixed(0)}% Concluído</span>
                                    {isCompleted && <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600"><CheckCircle2 className="w-3 h-3" /> Meta Batida!</span>}
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-2.5">
                                <button
                                    onClick={() => openTransactionModal(goal, 'DEPOSIT')}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition-colors text-xs font-bold uppercase tracking-wider"
                                >
                                    <Plus className="w-4 h-4" /> Investir
                                </button>
                                <button
                                    onClick={() => openTransactionModal(goal, 'WITHDRAW')}
                                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-slate-50 dark:bg-slate-700/30 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition-colors text-xs font-bold uppercase tracking-wider"
                                >
                                    <Minus className="w-4 h-4" /> Resgatar
                                </button>
                            </div>
                        </div>
                    );
                })}

                {goals.length === 0 && !isFormOpen && (
                    <div className="col-span-full text-center py-16 bg-slate-50 dark:bg-slate-900/50 rounded-3xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="bg-white dark:bg-slate-800 p-4 rounded-full inline-flex mb-4 shadow-sm ring-4 ring-slate-100 dark:ring-slate-800">
                            <TrendingUp className="w-10 h-10 text-slate-400" />
                        </div>
                        <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">Nenhuma meta definida</h3>
                        <p className="text-slate-500 dark:text-slate-400 font-medium text-sm mt-1 mb-5">Defina objetivos financeiros para realizar seus sonhos.</p>
                        <Button onClick={() => setIsFormOpen(true)} className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-lg shadow-emerald-500/20">
                            Criar Primeira Meta
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};