import React, { useState } from 'react';
import { Goal, Account, Transaction, TransactionType, Category } from '../types';
import { Card } from './ui/Card';
import { Button } from './ui/Button';
import { Plus, Edit2, Trash2, Target, Trophy, Calendar, TrendingUp, DollarSign, Minus, X, Wallet } from 'lucide-react';
import { formatCurrency } from '../utils';

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
            isRecurring: false
        };

        onAddTransaction(transaction);

        setTransactingGoal(null);
    };

    return (
        <div className="space-y-4 pb-24 animate-in fade-in duration-500">
            <div className="flex justify-between items-center px-1">
                <div>
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">Metas</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-xs">Foco no objetivo.</p>
                </div>
                <Button onClick={() => setIsFormOpen(true)} size="sm" className="shadow-sm bg-emerald-600 hover:bg-emerald-700 text-white h-9 text-xs">
                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nova Meta
                </Button>
            </div>

            {/* Transaction Modal Overlay */}
            {transactingGoal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xs overflow-hidden">
                        <div className={`p-4 text-white flex justify-between items-center ${transactionType === 'DEPOSIT' ? 'bg-emerald-600' : 'bg-red-500'}`}>
                            <h3 className="font-bold text-sm flex items-center gap-2">
                                {transactionType === 'DEPOSIT' ? <Plus className="w-4 h-4" /> : <Minus className="w-4 h-4" />}
                                {transactionType === 'DEPOSIT' ? 'Adicionar Valor' : 'Retirar Valor'}
                            </h3>
                            <button onClick={() => setTransactingGoal(null)} className="p-1 hover:bg-white/20 rounded-full transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <form onSubmit={submitTransaction} className="p-5">
                            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4 font-medium text-center">
                                {transactionType === 'DEPOSIT' ? 'Quanto você guardou hoje?' : 'Quanto precisa retirar?'}
                            </p>

                            <div className="relative mb-4">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-lg">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    autoFocus
                                    value={transactionAmount}
                                    onChange={e => setTransactionAmount(e.target.value)}
                                    className={`w-full pl-10 pr-4 py-3 text-2xl font-bold text-center border-2 rounded-xl outline-none transition-colors bg-white dark:bg-slate-900 ${transactionType === 'DEPOSIT' ? 'border-emerald-100 dark:border-emerald-900 focus:border-emerald-500 text-emerald-700 dark:text-emerald-400' : 'border-red-100 dark:border-red-900 focus:border-red-500 text-red-700 dark:text-red-400'}`}
                                    placeholder="0,00"
                                    required
                                />
                            </div>

                            <div className="mb-6">
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1.5 pl-1">
                                    {transactionType === 'DEPOSIT' ? 'Saindo da conta:' : 'Depositando na conta:'}
                                </label>
                                <div className="relative">
                                    <Wallet className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <select
                                        className="w-full pl-9 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-semibold text-slate-700 dark:text-slate-300 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 dark:focus:ring-indigo-900/30 appearance-none"
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

                            <Button type="submit" className={`w-full py-6 text-base ${transactionType === 'DEPOSIT' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-500 hover:bg-red-600'} text-white shadow-lg`}>
                                Confirmar
                            </Button>
                        </form>
                    </div>
                </div>
            )}

            {isFormOpen && (
                <Card className="bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 shadow-sm" title={editingGoal ? "Editar Meta" : "Nova Meta"}>
                    <form onSubmit={handleSave} className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nome</label>
                            <input
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                                value={newGoal.name || ''}
                                onChange={e => setNewGoal({ ...newGoal, name: e.target.value })}
                                placeholder="Ex: Viagem, Carro"
                                required
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Alvo (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                                    value={newGoal.targetAmount || ''}
                                    onChange={e => setNewGoal({ ...newGoal, targetAmount: Number(e.target.value) })}
                                    placeholder="0,00"
                                    required
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Atual (R$)</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                                    value={newGoal.currentAmount || ''}
                                    onChange={e => setNewGoal({ ...newGoal, currentAmount: Number(e.target.value) })}
                                    placeholder="0,00"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Prazo</label>
                            <input
                                type="date"
                                onClick={(e) => { try { e.currentTarget.showPicker() } catch (e) { /* ignore */ } }}
                                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg focus:ring-2 focus:ring-emerald-500 outline-none text-slate-900 dark:text-white text-sm"
                                value={newGoal.deadline || ''}
                                onChange={e => setNewGoal({ ...newGoal, deadline: e.target.value })}
                            />
                        </div>
                        <div className="flex gap-2 pt-2">
                            <Button type="submit" size="sm" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white">Salvar</Button>
                            <Button type="button" size="sm" variant="ghost" onClick={() => { setIsFormOpen(false); setEditingGoal(null); }} className="flex-1">Cancelar</Button>
                        </div>
                    </form>
                </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {goals.map(goal => {
                    const percentage = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                    const isCompleted = percentage >= 100;

                    return (
                        <div key={goal.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 shadow-sm relative overflow-hidden group hover:border-emerald-300 dark:hover:border-emerald-700 transition-all flex flex-col justify-between h-full">
                            <div>
                                <div className="flex justify-between items-start mb-3">
                                    <div className="flex items-center gap-2.5">
                                        <div className={`p-2 rounded-lg ${isCompleted ? 'bg-yellow-100 text-yellow-600' : 'bg-emerald-50 text-emerald-600'}`}>
                                            {isCompleted ? <Trophy className="w-4 h-4" /> : <Target className="w-4 h-4" />}
                                        </div>
                                        <div>
                                            <h3 className="font-bold text-slate-800 dark:text-white text-sm leading-tight">{goal.name}</h3>
                                            {goal.deadline && (
                                                <p className="text-[10px] text-slate-400 mt-0.5">
                                                    {new Date(goal.deadline).toLocaleDateString()}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center">
                                        <button onClick={() => handleEdit(goal)} className="p-1.5 text-slate-300 hover:text-indigo-600 transition-colors"><Edit2 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => onDeleteGoal(goal.id)} className="p-1.5 text-slate-300 hover:text-red-600 transition-colors"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </div>
                                </div>

                                <div className="mb-2">
                                    <div className="flex justify-between items-end mb-1">
                                        <span className="text-xl font-bold text-slate-900 dark:text-white tracking-tight">{formatCurrency(goal.currentAmount)}</span>
                                        <span className="text-[10px] font-semibold text-slate-400 mb-1">de {formatCurrency(goal.targetAmount)}</span>
                                    </div>

                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden w-full">
                                        <div
                                            className={`h-full rounded-full transition-all duration-1000 ${isCompleted ? 'bg-yellow-400' : 'bg-emerald-500'}`}
                                            style={{ width: `${percentage}%` }}
                                        />
                                    </div>
                                    <div className="text-right mt-1">
                                        <span className="text-[10px] font-bold text-emerald-600">{percentage.toFixed(0)}%</span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex gap-2 mt-2 pt-3 border-t border-slate-50">
                                <button
                                    onClick={() => openTransactionModal(goal, 'DEPOSIT')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors text-xs font-bold"
                                >
                                    <Plus className="w-3.5 h-3.5" /> Adicionar
                                </button>
                                <button
                                    onClick={() => openTransactionModal(goal, 'WITHDRAW')}
                                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg bg-red-50 text-red-700 hover:bg-red-100 transition-colors text-xs font-bold"
                                >
                                    <Minus className="w-3.5 h-3.5" /> Retirar
                                </button>
                            </div>
                        </div>
                    );
                })}

                {goals.length === 0 && !isFormOpen && (
                    <div className="col-span-full text-center py-10 bg-slate-50 dark:bg-slate-900 rounded-xl border border-dashed border-slate-300 dark:border-slate-700">
                        <div className="bg-white dark:bg-slate-800 p-3 rounded-full inline-flex mb-3 shadow-sm">
                            <TrendingUp className="w-6 h-6 text-slate-400" />
                        </div>
                        <p className="text-slate-600 dark:text-slate-400 font-medium text-sm">Nenhuma meta definida.</p>
                        <Button onClick={() => setIsFormOpen(true)} variant="ghost" size="sm" className="mt-3 text-emerald-600 hover:bg-emerald-50 text-xs">
                            Criar Primeira Meta
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};