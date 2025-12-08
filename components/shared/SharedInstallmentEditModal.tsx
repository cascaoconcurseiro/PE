import React, { useState, useMemo } from 'react';
import { Transaction, Account, FamilyMember } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { formatCurrency, parseDate, round2dec } from '../../utils';
import { Calendar, Edit3, FastForward, Check, AlertCircle, DollarSign, Hash } from 'lucide-react';

interface SharedInstallmentEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    transaction: Transaction;
    allTransactions: Transaction[];
    accounts: Account[];
    members: FamilyMember[];
    onUpdateTransaction: (t: Transaction) => void;
    onDeleteTransaction: (id: string, scope?: 'SINGLE' | 'SERIES') => void;
}

export const SharedInstallmentEditModal: React.FC<SharedInstallmentEditModalProps> = ({
    isOpen,
    onClose,
    transaction,
    allTransactions,
    accounts,
    members,
    onUpdateTransaction,
    onDeleteTransaction
}) => {
    const [editMode, setEditMode] = useState<'view' | 'editValue' | 'anticipate'>('view');
    const [newTotalValue, setNewTotalValue] = useState('');
    const [selectedInstallments, setSelectedInstallments] = useState<string[]>([]);
    const [anticipateDate, setAnticipateDate] = useState(new Date().toISOString().split('T')[0]);

    // Get all installments in this series
    const seriesInstallments = useMemo(() => {
        if (!transaction.seriesId) return [transaction];
        return allTransactions
            .filter(t => t.seriesId === transaction.seriesId && !t.deleted)
            .sort((a, b) => parseDate(a.date).getTime() - parseDate(b.date).getTime());
    }, [transaction, allTransactions]);

    // Future installments (for anticipation)
    const futureInstallments = useMemo(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return seriesInstallments.filter(t => parseDate(t.date) > today);
    }, [seriesInstallments]);

    const totalOriginalValue = transaction.originalAmount || (transaction.amount * (transaction.totalInstallments || 1));
    const totalInstallments = transaction.totalInstallments || 1;

    const getMemberName = (id: string) => {
        if (id === 'me' || !id) return 'Você';
        return members.find(m => m.id === id)?.name || 'Desconhecido';
    };

    // Handle Edit Value
    const handleEditValue = () => {
        const newTotal = parseFloat(newTotalValue);
        if (isNaN(newTotal) || newTotal <= 0) {
            alert('Digite um valor válido.');
            return;
        }

        const newInstallmentValue = round2dec(newTotal / seriesInstallments.length);
        const remainder = round2dec(newTotal - (newInstallmentValue * seriesInstallments.length));

        seriesInstallments.forEach((t, index) => {
            const adjustedAmount = index === 0 ? round2dec(newInstallmentValue + remainder) : newInstallmentValue;

            // Recalculate shared splits proportionally
            const ratio = adjustedAmount / t.amount;
            const updatedSharedWith = t.sharedWith?.map(s => ({
                ...s,
                assignedAmount: round2dec(s.assignedAmount * ratio)
            }));

            onUpdateTransaction({
                ...t,
                amount: adjustedAmount,
                originalAmount: newTotal,
                sharedWith: updatedSharedWith
            });
        });

        setEditMode('view');
        setNewTotalValue('');
        onClose();
    };

    // Handle Anticipate
    const toggleInstallment = (id: string) => {
        setSelectedInstallments(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const handleAnticipate = () => {
        if (selectedInstallments.length === 0) {
            alert('Selecione pelo menos uma parcela.');
            return;
        }

        selectedInstallments.forEach(id => {
            const t = seriesInstallments.find(tx => tx.id === id);
            if (t) {
                onUpdateTransaction({
                    ...t,
                    date: anticipateDate
                });
            }
        });

        setSelectedInstallments([]);
        setEditMode('view');
        onClose();
    };

    const totalSelectedAmount = useMemo(() => {
        return futureInstallments
            .filter(t => selectedInstallments.includes(t.id))
            .reduce((sum, t) => sum + t.amount, 0);
    }, [selectedInstallments, futureInstallments]);

    if (!isOpen) return null;

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Gerenciar Parcelas">
            <div className="space-y-4">
                {/* Transaction Info */}
                <div className="bg-slate-50 dark:bg-slate-900 rounded-2xl p-4 border border-slate-200 dark:border-slate-700">
                    <p className="text-sm font-bold text-slate-900 dark:text-white mb-1">{transaction.description}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                        {transaction.currentInstallment}/{totalInstallments} • {formatCurrency(totalOriginalValue)} total
                    </p>
                    {transaction.sharedWith && transaction.sharedWith.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                            {transaction.sharedWith.map(s => (
                                <span key={s.memberId} className="text-[10px] bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 px-2 py-0.5 rounded-full">
                                    {getMemberName(s.memberId)}: {formatCurrency(s.assignedAmount * totalInstallments)}
                                </span>
                            ))}
                        </div>
                    )}
                </div>

                {/* Mode Selection */}
                {editMode === 'view' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <button
                            onClick={() => {
                                setNewTotalValue(totalOriginalValue.toString());
                                setEditMode('editValue');
                            }}
                            className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-indigo-300 dark:hover:border-indigo-700 transition-all text-left"
                        >
                            <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-2">
                                <DollarSign className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">Editar Valor</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Alterar valor total</p>
                        </button>

                        <button
                            onClick={() => setEditMode('anticipate')}
                            className="p-4 rounded-xl border-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300 dark:hover:border-purple-700 transition-all text-left"
                            disabled={futureInstallments.length === 0}
                        >
                            <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mb-2">
                                <FastForward className="w-5 h-5" />
                            </div>
                            <p className="font-bold text-sm text-slate-900 dark:text-white">Antecipar</p>
                            <p className="text-xs text-slate-500 dark:text-slate-400">
                                {futureInstallments.length > 0 ? `${futureInstallments.length} disponíveis` : 'Nenhuma futura'}
                            </p>
                        </button>
                    </div>
                )}

                {/* Edit Value Mode */}
                {editMode === 'editValue' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                                Novo Valor Total
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-3 text-slate-400 font-bold">R$</span>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={newTotalValue}
                                    onChange={e => setNewTotalValue(e.target.value)}
                                    className="w-full pl-10 pr-4 h-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-900 dark:text-white font-bold text-lg"
                                    placeholder="0,00"
                                />
                            </div>
                            <p className="text-xs text-slate-500 mt-2">
                                Nova parcela: {formatCurrency(parseFloat(newTotalValue || '0') / seriesInstallments.length)}
                            </p>
                        </div>

                        <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 rounded-xl p-3 flex gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-900 dark:text-amber-200">
                                Isso atualizará {seriesInstallments.length} parcelas proporcionalmente.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setEditMode('view')} className="flex-1 h-12">
                                Voltar
                            </Button>
                            <Button onClick={handleEditValue} className="flex-1 h-12 bg-indigo-600 hover:bg-indigo-700">
                                Salvar
                            </Button>
                        </div>
                    </div>
                )}

                {/* Anticipate Mode */}
                {editMode === 'anticipate' && (
                    <div className="space-y-4">
                        <div>
                            <label className="text-sm font-bold text-slate-700 dark:text-slate-300 mb-2 block">
                                Nova Data
                            </label>
                            <div className="relative">
                                <Calendar className="absolute left-3 top-3.5 w-5 h-5 text-slate-400" />
                                <input
                                    type="date"
                                    value={anticipateDate}
                                    onChange={e => setAnticipateDate(e.target.value)}
                                    className="w-full pl-11 pr-4 h-12 bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-purple-500 text-slate-900 dark:text-white font-medium"
                                />
                            </div>
                        </div>

                        <div className="max-h-48 overflow-y-auto space-y-2">
                            {futureInstallments.map(t => {
                                const isSelected = selectedInstallments.includes(t.id);
                                return (
                                    <div
                                        key={t.id}
                                        onClick={() => toggleInstallment(t.id)}
                                        className={`p-3 rounded-xl border-2 cursor-pointer transition-all flex items-center justify-between ${isSelected ? 'bg-purple-600 text-white border-purple-600' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-purple-300'}`}
                                    >
                                        <div>
                                            <p className={`font-bold text-sm ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                                Parcela {t.currentInstallment}/{t.totalInstallments}
                                            </p>
                                            <p className={`text-xs ${isSelected ? 'text-purple-200' : 'text-slate-500'}`}>
                                                {parseDate(t.date).toLocaleDateString('pt-BR')}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className={`font-bold ${isSelected ? 'text-white' : 'text-slate-900 dark:text-white'}`}>
                                                {formatCurrency(t.amount)}
                                            </span>
                                            {isSelected && <Check className="w-4 h-4" />}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {selectedInstallments.length > 0 && (
                            <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-3 flex justify-between items-center">
                                <span className="text-sm text-purple-700 dark:text-purple-300">Total Selecionado</span>
                                <span className="font-bold text-purple-700 dark:text-purple-300">{formatCurrency(totalSelectedAmount)}</span>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <Button variant="secondary" onClick={() => setEditMode('view')} className="flex-1 h-12">
                                Voltar
                            </Button>
                            <Button
                                onClick={handleAnticipate}
                                className="flex-1 h-12 bg-purple-600 hover:bg-purple-700"
                                disabled={selectedInstallments.length === 0}
                            >
                                Antecipar {selectedInstallments.length > 0 ? `(${selectedInstallments.length})` : ''}
                            </Button>
                        </div>
                    </div>
                )}

                {/* Installments List (View Mode) */}
                {editMode === 'view' && (
                    <div>
                        <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase mb-2">Todas as Parcelas</p>
                        <div className="max-h-48 overflow-y-auto space-y-1 bg-slate-50 dark:bg-slate-900 rounded-xl p-2">
                            {seriesInstallments.map(t => (
                                <div key={t.id} className="flex justify-between items-center p-2 rounded-lg hover:bg-white dark:hover:bg-slate-800 transition-colors">
                                    <div>
                                        <span className="text-sm font-medium text-slate-900 dark:text-white">
                                            {t.currentInstallment}/{t.totalInstallments}
                                        </span>
                                        <span className="text-xs text-slate-500 dark:text-slate-400 ml-2">
                                            {parseDate(t.date).toLocaleDateString('pt-BR')}
                                        </span>
                                    </div>
                                    <span className="text-sm font-bold text-slate-900 dark:text-white">{formatCurrency(t.amount)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </Modal>
    );
};
