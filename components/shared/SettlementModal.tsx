import React, { useState, useEffect } from 'react';
import { X, Calendar, Wallet, Check, ArrowRightLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Toast';
import { Account, FamilyMember, TransactionType, Category } from '../../types';
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
    onAddTransaction: (t: any) => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
    isOpen, onClose, familyMembers, accounts, preSelectedMemberId, suggestedAmount, suggestedCurrency, mode = 'PAY', onAddTransaction
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

        if (!amount || parseFloat(amount) <= 0) {
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

        // Logic requested: 
        // "se a pessoa me deve é receita" (Charge -> Income)
        // "se caso eu devesse... despesa" (Pay -> Expense)

        const type = isCharge ? TransactionType.INCOME : TransactionType.EXPENSE;
        // Adjust category if needed, or generic 'Transfer'
        const description = isCharge
            ? `Recebimento de ${memberName}`
            : `Pagamento para ${memberName}`;

        onAddTransaction({
            description,
            amount: parseFloat(amount),
            date: date,
            type: type,
            category: 'Transferência',
            accountId: accountId,
            isSettled: true,
            observation: `[ACERTO] ${isCharge ? 'Recebido de' : 'Pago a'} ${memberName}`,
            // CRITICAL FIX: Add shared metadata so useSharedFinances detects this 
            // and adjusts the balance (Net = Credit - Debit).
            isShared: true,
            sharedWith: [{
                memberId: selectedMemberId, // Who is involved
                assignedAmount: parseFloat(amount), // 100% of the value affects the balance with them
                isSettled: true // It's paid
            }],
            payerId: isCharge ? selectedMemberId : 'me'
            // If I Charge (Income), Payer is THEM. 
            // If I Pay (Expense), Payer is ME.
        });

        addToast(isCharge ? 'Recebimento registrado!' : 'Pagamento registrado!', 'success');
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
                            {isCharge ? 'Confirmar que Recebi' : 'Confirmar que Paguei'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
