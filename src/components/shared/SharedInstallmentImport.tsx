import React, { useState, useEffect } from 'react';
import { Transaction, FamilyMember, Account, Category, TransactionType, SyncStatus, TransactionSplit } from '../../types';
import { Button } from '../ui/Button';
import { round2dec } from '../../utils';
import { X, Calendar, DollarSign, CreditCard, Layers, Check } from 'lucide-react';

// Helper for currency format inside component
const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
}

interface SharedInstallmentImportProps {
    isOpen: boolean;
    onClose: () => void;
    onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
    members: FamilyMember[];
    accounts: Account[];
    currentUserId: string;
    currentUserName?: string;
}

export const SharedInstallmentImport: React.FC<SharedInstallmentImportProps> = ({
    isOpen, onClose, onImport, members, accounts, currentUserId, currentUserName
}) => {
    const [description, setDescription] = useState('');
    const [amount, setAmount] = useState('');
    const [installments, setInstallments] = useState('1');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [category, setCategory] = useState<Category>(Category.OTHER);
    const [payerId, setPayerId] = useState('me');

    // Participants selection (IDs). 'me' is current user.
    const [participantIds, setParticipantIds] = useState<string[]>(['me']);

    const [accountId, setAccountId] = useState(''); // Optional, mainly for tracking where money came from if 'me' paid.

    useEffect(() => {
        if (isOpen) {
            // Reset form on open
            setDescription('');
            setAmount('');
            setInstallments('1');
            setDate(new Date().toISOString().split('T')[0]);
            setCategory(Category.OTHER);
            setPayerId('me');
            setParticipantIds(['me']);
            setAccountId('');
        }
    }, [isOpen]);

    const handleToggleParticipant = (id: string) => {
        setParticipantIds(prev =>
            prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
        );
    };

    const handleConfirm = () => {
        if (!description || !amount || !date) {
            alert('Preencha todos os campos obrigatórios.');
            return;
        }

        if (participantIds.length < 2) {
            alert('Para importar uma despesa compartilhada é necessário selecionar pelo menos mais uma pessoa.');
            return;
        }

        const installmentValue = parseFloat(amount);
        const numInstallments = parseInt(installments);

        if (isNaN(installmentValue) || installmentValue <= 0) {
            alert('Valor inválido.');
            return;
        }
        if (isNaN(numInstallments) || numInstallments < 1) {
            alert('Número de parcelas inválido.');
            return;
        }

        // Generate Transactions
        const generatedTransactions: Omit<Transaction, 'id'>[] = [];
        const [yearStr, monthStr, dayStr] = date.split('-');
        const startYear = parseInt(yearStr);
        const startMonth = parseInt(monthStr) - 1; // 0-indexed
        const startDay = parseInt(dayStr);

        const seriesId = crypto.randomUUID(); // Unique ID for this installment series
        const totalAmount = installmentValue * numInstallments;

        for (let i = 0; i < numInstallments; i++) {
            const currentInstallmentAmount = installmentValue;

            // Robust Date Calculation (Credit Card Style)
            // Ensures we stick to the original day if possible, or clamp to end of month
            const currentMonthIndex = startMonth + i;
            const targetYear = startYear + Math.floor(currentMonthIndex / 12);
            const targetMonth = currentMonthIndex % 12;

            // Determine max days in target month
            // Date(year, month + 1, 0).getDate() gives last day of month
            const maxDaysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();
            const finalDay = Math.min(startDay, maxDaysInMonth);

            // Create date at noon UTC to avoid timezone rollback
            const utcDate = new Date(Date.UTC(targetYear, targetMonth, finalDay, 12, 0, 0));
            const dateStr = utcDate.toISOString().split('T')[0];

            // Build SharedWith
            // Logic: sharedWith includes everyone in participantIds EXCEPT 'me'.
            // Their share is (currentInstallmentAmount / participantIds.length).

            const sharePerPerson = round2dec(currentInstallmentAmount / participantIds.length);

            const sharedWith: TransactionSplit[] = participantIds
                .filter(pid => pid !== 'me')
                .map(pid => ({
                    memberId: pid,
                    assignedAmount: sharePerPerson,
                    percentage: round2dec((1 / participantIds.length) * 100)
                }));

            generatedTransactions.push({
                description: `${description} (${i + 1}/${numInstallments})`,
                amount: currentInstallmentAmount,
                type: TransactionType.EXPENSE,
                category: category,
                date: dateStr,
                accountId: accountId || undefined, // Allow undefined for pending shared transactions
                payerId: payerId === 'me' ? undefined : payerId,
                isShared: true,
                sharedWith: sharedWith,
                isInstallment: numInstallments > 1,
                currentInstallment: i + 1,
                totalInstallments: numInstallments,
                seriesId: numInstallments > 1 ? seriesId : undefined, // Link transactions
                originalAmount: totalAmount,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }

        onImport(generatedTransactions);
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}>
            <div className={`absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0'}`} onClick={onClose} />
            <div className={`bg-white dark:bg-slate-900 w-full sm:max-w-lg rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col transition-transform duration-300 ${isOpen ? 'translate-y-0 pointer-events-auto' : 'translate-y-full'}`}>
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
                    <h3 className="font-bold text-lg dark:text-white flex items-center gap-2"><Layers className="w-5 h-5 text-indigo-500" /> Importar Parcelado</h3>
                    <button onClick={onClose}><X className="w-6 h-6 text-slate-400" /></button>
                </div>

                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    {/* Description */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Descrição</label>
                        <input className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white" value={description} onChange={e => setDescription(e.target.value)} placeholder="Ex: Compra Geladeira" />
                    </div>

                    {/* Amount & Installments Row */}
                    <div className="flex gap-4">
                        <div className="flex-1">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Valor da Parcela</label>
                            <div className="relative">
                                <DollarSign className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                                <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 font-bold dark:text-white" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" />
                            </div>
                        </div>
                        <div className="w-1/3">
                            <label className="block text-xs font-bold text-slate-500 mb-1">Parcelas</label>
                            <input type="number" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white" value={installments} onChange={e => setInstallments(e.target.value)} placeholder="1" min="1" max="99" />
                        </div>
                    </div>

                    {/* Date */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Data 1ª Parcela</label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3.5 w-4 h-4 text-slate-400" />
                            <input type="date" className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-9 pr-4 py-3 font-bold dark:text-white" value={date} onChange={e => setDate(e.target.value)} />
                        </div>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Categoria</label>
                        <select className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 py-3 font-bold dark:text-white" value={category} onChange={e => setCategory(e.target.value as Category)}>
                            {Object.values(Category).map(c => <option key={c} value={c}>{c}</option>)}
                        </select>
                    </div>

                    {/* Who Paid */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Quem Pagou?</label>
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => setPayerId('me')}
                                className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${payerId === 'me' ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                            >
                                {currentUserName || 'Eu (Você)'}
                            </button>
                            {members.map(m => (
                                <button
                                    key={m.id}
                                    onClick={() => setPayerId(m.id)}
                                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-all ${payerId === m.id ? 'bg-indigo-100 border-indigo-200 text-indigo-700 dark:bg-indigo-900/30 dark:border-indigo-800 dark:text-indigo-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                                >
                                    {m.name}
                                </button>
                            ))}
                        </div>
                    </div>



                    {/* Shared With */}
                    <div>
                        <label className="block text-xs font-bold text-slate-500 mb-1">Compartilhado com (Participantes)</label>
                        <div className="grid grid-cols-2 gap-2">
                            {/* Dynamic Participant List */}
                            {(() => {
                                const displayList = payerId === 'me'
                                    ? members // If I paid, show everyone else
                                    : [
                                        { id: 'me', name: currentUserName || 'Eu (Você)' }, // If someone else paid, I am a participant
                                        ...members.filter(m => m.id !== payerId) // Everyone else except the payer
                                    ];

                                return displayList.map(m => (
                                    <button
                                        key={m.id}
                                        onClick={() => handleToggleParticipant(m.id)}
                                        className={`px-4 py-3 rounded-xl text-sm font-bold border flex items-center justify-between transition-all ${participantIds.includes(m.id) ? 'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400' : 'bg-transparent border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'}`}
                                    >
                                        <span>{m.name}</span>
                                        {participantIds.includes(m.id) && <Check className="w-4 h-4" />}
                                    </button>
                                ));
                            })()}
                        </div>
                    </div>
                    {participantIds.length > 0 && amount && (
                        <p className="text-xs text-right mt-1 text-slate-400">
                            {formatCurrency(parseFloat(amount) / participantIds.length)} por pessoa (Total: {participantIds.length})
                        </p>
                    )}
                </div>

                <div className="p-6 pt-0">
                    <Button onClick={handleConfirm} className="w-full h-12 text-lg">
                        Gerar {installments} Lançamentos
                    </Button>
                </div>
            </div>
        </div>
    );
};
