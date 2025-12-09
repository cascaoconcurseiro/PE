import React, { useState } from 'react';
import { X, Calendar, Wallet, Check } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '../ui/Toast';
import { Account, FamilyMember } from '../../types';
import { formatCurrency } from '../../utils';

interface SettlementModalProps {
    isOpen: boolean;
    onClose: () => void;
    familyMembers: FamilyMember[];
    accounts: Account[];
    currentUserId: string;
    preSelectedMemberId?: string;
    suggestedAmount?: number;
    onAddTransaction: (t: any) => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
    isOpen, onClose, familyMembers, accounts, currentUserId, preSelectedMemberId, suggestedAmount, onAddTransaction
}) => {
    const { addToast } = useToast();
    const [amount, setAmount] = useState<string>(suggestedAmount ? suggestedAmount.toString() : '');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>(preSelectedMemberId || '');
    const [sourceAccountId, setSourceAccountId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!amount || parseFloat(amount) <= 0) {
            addToast('Valor inválido.', 'error');
            return;
        }
        if (!selectedMemberId) {
            addToast('Selecione quem você está pagando.', 'error');
            return;
        }
        if (!date) {
            addToast('Data é obrigatória.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // 1. Get Receiver User ID from Family Member
            const member = familyMembers.find(m => m.id === selectedMemberId);
            if (!member?.email) throw new Error("Membro sem email vinculado.");

            // Resolve email to User ID (RPC check)
            const { data: receiverId, error: userError } = await supabase.rpc('check_user_by_email', { email_to_check: member.email });
            if (userError || !receiverId) throw new Error("Usuário não encontrado no sistema.");

            // 2. Create Settlement Request
            const { data: request, error: reqError } = await supabase
                .from('settlement_requests')
                .insert({
                    payer_id: currentUserId,
                    receiver_id: receiverId,
                    amount: parseFloat(amount),
                    date: date,
                    status: 'PENDING',
                    note: `Pagamento de ${member.name}`
                })
                .select()
                .single();

            if (reqError) throw reqError;

            // 3. (Optional) Create Expense Transaction for Payer immediately
            if (sourceAccountId) {
                onAddTransaction({
                    description: `Pagamento para ${member.name}`,
                    amount: parseFloat(amount),
                    date: date, // Keep user selected date
                    type: 'DESPESA',
                    category: 'Transferência',
                    accountId: sourceAccountId,
                    // destinationAccountId? If we tracked transfers properly, but 'Settlement' is effectively an expense for me until proven otherwise.
                    // Or I could use 'TRANSFER' type?
                    // Let's stick to DESPESA for simplicity unless 'Transfer' is better.
                    // With 'Transfer', I need destination. I don't know THEIR account.
                    // So it is an expense "Pagamento de Dívida".
                    isSettled: true,
                    observation: `[SETTLEMENT:${request.id}] Pagamento de acerto de contas.`
                });
            } else {
                addToast('Solicitação enviada!', 'success'); // Only toast if no tx created (onAddTransaction handles its own toast usually? No, performOperation does)
            }

            // If onAddTransaction handles success toast, we might double toast. 
            // onAddTransaction is async void.
            // Let's assume onAddTransaction handles "Transaction Saved". We just say "Request Sent".
            if (!sourceAccountId) addToast('Solicitação de pagamento enviada!', 'success');

            onClose();
        } catch (error: any) {
            console.error(error);
            addToast(`Erro: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b dark:border-slate-800 flex justify-between items-center bg-emerald-50 dark:bg-emerald-900/20 rounded-t-2xl">
                    <h3 className="font-bold text-emerald-900 dark:text-emerald-100 flex items-center gap-2">
                        <Wallet className="w-5 h-5" />
                        Quitar Dívida / Pagar
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Quem receberá */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Quem você está pagando?</label>
                        <select
                            value={selectedMemberId}
                            onChange={e => setSelectedMemberId(e.target.value)}
                            className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Selecione...</option>
                            {familyMembers.filter(m => m.email).map(m => ( // Only show members with email (linkable)
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
                            className="w-full p-3 text-2xl font-bold text-emerald-600 bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded-xl"
                            placeholder="0,00"
                            autoFocus
                        />
                    </div>

                    {/* Quando */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">Data do Pagamento</label>
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

                    {/* De onde sai o dinheiro (Opcional) */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            Conta de Origem (Opcional)
                            <span className="block text-xs font-normal text-slate-500">Se selecionado, cria uma saída no seu extrato agora.</span>
                        </label>
                        <select
                            value={sourceAccountId}
                            onChange={e => setSourceAccountId(e.target.value)}
                            className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Não registrar saída agora</option>
                            {accounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>
                            ))}
                        </select>
                    </div>

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white" disabled={isLoading}>
                            {isLoading ? 'Enviando...' : 'Confirmar Pagamento'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
