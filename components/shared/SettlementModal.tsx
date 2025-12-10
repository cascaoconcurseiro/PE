import React, { useState, useEffect } from 'react';
import { X, Calendar, Wallet, Check, ArrowRightLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Account, FamilyMember, TransactionType, InvoiceItem, Transaction } from '../../types';
import { formatCurrency } from '../../utils';

interface SettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    familyMembers: FamilyMember[];
    accounts: Account[];
    currentUserId: string;
    preSelectedMemberId?: string;
    suggestedAmount?: number;
    suggestedCurrency?: string;
    mode?: 'PAY' | 'CHARGE';
    pendingItems?: InvoiceItem[]; // New: Items available to be settled
    // Changed: Now returns the payment tx AND the list of IDs that were settled
    onSettle: (paymentTx: any, settledItemIds: { id: string, seriesId?: string, isSplit?: boolean, originalTxId: string }[]) => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
    isOpen, onClose, familyMembers, accounts, preSelectedMemberId, suggestedAmount, suggestedCurrency, mode = 'PAY', pendingItems = [], onSettle
}) => {
    const { addToast } = useToast();
    const [amount, setAmount] = useState<string>('');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>('');
    const [accountId, setAccountId] = useState<string>('');

    // Reset state when modal opens
    useEffect(() => {
        if (isOpen) {
            setAmount(suggestedAmount ? suggestedAmount.toString() : '');
            setSelectedMemberId(preSelectedMemberId || '');
            setAccountId(''); // Reset account
        }
    }, [isOpen, preSelectedMemberId, suggestedAmount]);

    const validAccounts = suggestedCurrency
        ? accounts.filter(a => (a.currency || 'BRL') === suggestedCurrency)
        : accounts;

    if (!isOpen) return null;

    const isCharge = mode === 'CHARGE'; // CHARGE = "Cobrar" (They owe me -> Income for me)
    // PAY = "Pagar" (I owe them -> Expense for me)

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const val = parseFloat(amount);
        if (!amount || val <= 0) {
            addToast('Valor inválido.', 'error');
            return;
        }
        if (!selectedMemberId) {
            addToast('Selecione o membro.', 'error');
            return;
        }
        if (!date) {
            addToast('Data é obrigatória.', 'error');
            return;
        }
        if (!accountId) {
            addToast('Selecione a conta para o registro.', 'error');
            return;
        }

        const member = familyMembers.find(m => m.id === selectedMemberId);
        const memberName = member?.name || 'Membro';

        // 1. Calculate which items are settled (FIFO)
        let remainingAmount = val;
        const settledItemIds: { id: string, seriesId?: string, isSplit?: boolean, originalTxId: string }[] = [];

        // Filter items for the specific member and sort by date (Oldest first)
        // Only consider items that match the user and are not paid
        const candidateItems = pendingItems
            .filter(i => i.memberId === selectedMemberId && !i.isPaid)
            .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

        for (const item of candidateItems) {
            if (remainingAmount <= 0.01) break;

            // Simple logic: If we have enough money, we pay off the item
            // We fully settle items as long as we have funds.
            // Note: This does not support "Partial Settlement" of a single transaction yet
            // because our data model treats 'isSettled' as boolean.
            // We will settle the item if we cover at least 99% of it or if we have enough remaining.
            // Actually, safe logic: Only mark as settled if we assume it's fully paid.
            // But user wants to "clean up" the logic. 
            // Better logic: Decrement remainingAmount. If result >= 0, mark item settled.

            if (remainingAmount >= (item.amount - 0.05)) { // Tolerance of 5 cents
                remainingAmount -= item.amount;
                settledItemIds.push({
                    id: item.id,
                    seriesId: item.seriesId,
                    isSplit: item.type === 'CREDIT', // Crude check: Credit = Split (They owe me), Debit = Main Layout?
                    // Actually we need to know if we are updating a split or the main tx.
                    // InvoiceItem.type is 'CREDIT' (Receivable) or 'DEBIT' (Payable)
                    // If CREDIT (They owe me), we update the split in the original Tx.
                    // If DEBIT (I owe them), usually I am the helper or it's a split I own. 
                    // Let's pass the Original ID and let Shared.tsx handle the specific field update.
                    originalTxId: item.originalTxId
                });
            }
        }

        const type = isCharge ? TransactionType.INCOME : TransactionType.EXPENSE;
        const description = isCharge
            ? `Recebimento de ${memberName}`
            : `Pagamento para ${memberName}`;

        const paymentTx: any = {
            description,
            amount: parseFloat(amount),
            date: date,
            type: type,
            category: 'Transferência',
            accountId: accountId,
            isSettled: true, // This payment record itself is "done"
            observation: `[ACERTO] ${isCharge ? 'Recebido de' : 'Pago a'} ${memberName}. Baixou ${settledItemIds.length} itens.`,
            // IMPORTANT: We do NOT mark this as "isShared" anymore. 
            // It is just the money movement verifying the settlement.
            isShared: false,
            payerId: 'me'
        };

        onSettle(paymentTx, settledItemIds);

        onClose();
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <div className={`p-4 border-b dark:border-slate-800 flex justify-between items-center rounded-t-2xl ${isCharge ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                    <h3 className={`font-bold flex items-center gap-2 ${isCharge ? 'text-indigo-900 dark:text-indigo-100' : 'text-emerald-900 dark:text-emerald-100'}`}>
                        {isCharge ? <ArrowRightLeft className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        {isCharge ? 'Confirmar Recebimento (Baixar Dívida)' : 'Registrar Pagamento Realizado'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Quem */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            {isCharge ? 'Quem te pagou?' : 'Quem você pagou?'}
                        </label>
                        <select
                            value={selectedMemberId}
                            onChange={e => setSelectedMemberId(e.target.value)}
                            className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Selecione...</option>
                            {familyMembers.map(m => (
                                <option key={m.id} value={m.id}>{m.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Quanto */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Valor (R$)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className={`w-full p-3 text-2xl font-bold bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl ${isCharge ? 'text-indigo-600' : 'text-emerald-600'}`}
                            placeholder="0,00"
                            autoFocus
                        />
                        {pendingItems.length > 0 && selectedMemberId && (
                            <div className="mt-2 text-xs text-slate-500">
                                <span>Itens pendentes para este membro: {pendingItems.filter(i => i.memberId === selectedMemberId && !i.isPaid).length}</span>
                            </div>
                        )}
                    </div>

                    {/* Quando */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            Data
                        </label>
                        <div className="relative">
                            <Calendar className="absolute left-3 top-3 w-5 h-5 text-slate-400" />
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full pl-10 p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                            />
                        </div>
                    </div>

                    {/* Conta */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            {isCharge ? 'Onde o dinheiro entrou?' : 'De onde o dinheiro saiu?'}
                        </label>
                        <select
                            value={accountId}
                            onChange={e => setAccountId(e.target.value)}
                            className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Selecione a conta...</option>
                            {validAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className={`flex-1 text-white ${isCharge ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`}>
                            {isCharge ? 'Confirmar' : 'Confirmar'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
