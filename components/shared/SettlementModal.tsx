import React, { useState } from 'react';
import { X, Calendar, Wallet, Check, ArrowRightLeft } from 'lucide-react';
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
    suggestedCurrency?: string;
    mode?: 'PAY' | 'CHARGE';
    fulfillRequestId?: string;
    onSuccess?: () => void;
    onAddTransaction: (t: any) => void;
}

export const SettlementModal: React.FC<SettlementModalProps> = ({
    isOpen, onClose, familyMembers, accounts, currentUserId, preSelectedMemberId, suggestedAmount, suggestedCurrency, mode = 'PAY', fulfillRequestId, onSuccess, onAddTransaction
}) => {
    const { addToast } = useToast();
    const [amount, setAmount] = useState<string>(suggestedAmount ? suggestedAmount.toString() : '');
    const [date, setDate] = useState<string>(new Date().toISOString().split('T')[0]);
    const [selectedMemberId, setSelectedMemberId] = useState<string>(preSelectedMemberId || '');
    const [sourceAccountId, setSourceAccountId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    const validAccounts = suggestedCurrency
        ? accounts.filter(a => (a.currency || 'BRL') === suggestedCurrency)
        : accounts;

    if (!isOpen) return null;

    const isCharge = mode === 'CHARGE';

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

        setIsLoading(true);
        try {
            // 1. Get Target User ID from Family Member
            const member = familyMembers.find(m => m.id === selectedMemberId);
            if (!member?.email) throw new Error("Membro sem email vinculado.");

            let requestId = fulfillRequestId;

            if (fulfillRequestId) {
                // UPDATE existing request (Paying a Charge)
                const { error } = await supabase
                    .from('settlement_requests')
                    .update({
                        status: 'COMPLETED',
                        responded_at: new Date().toISOString()
                    })
                    .eq('id', fulfillRequestId);

                if (error) throw error;

            } else {
                // CREATE new request
                // Resolve email to User ID (RPC check)
                const { data: targetUserId, error: userError } = await supabase.rpc('check_user_by_email', { email_to_check: member.email });
                if (userError || !targetUserId) throw new Error("Usuário não encontrado no sistema.");

                // 2. Determine Payer/Receiver based on Mode
                const payerId = isCharge ? targetUserId : currentUserId;
                const receiverId = isCharge ? currentUserId : targetUserId;
                const type = isCharge ? 'CHARGE' : 'PAYMENT';

                // 3. Create Settlement Request
                const { data: request, error: reqError } = await supabase
                    .from('settlement_requests')
                    .insert({
                        payer_id: payerId,
                        receiver_id: receiverId,
                        amount: parseFloat(amount),
                        date: date,
                        status: 'PENDING',
                        type: type,
                        note: isCharge ? `Cobrança de ${member.name}` : `Pagamento para ${member.name}`
                    })
                    .select()
                    .single();

                if (reqError) throw reqError;
                requestId = request.id;
            }

            // 4. (Optional) Create Expense Transaction for Payer immediately (ONLY IF PAYING)
            if (!isCharge && sourceAccountId) {
                onAddTransaction({
                    description: `Pagamento para ${member.name}`,
                    amount: parseFloat(amount),
                    date: date, // Keep user selected date
                    type: 'DESPESA',
                    category: 'Transferência',
                    accountId: sourceAccountId,
                    isSettled: true,
                    observation: `[SETTLEMENT:${requestId}] Pagamento de acerto de contas.`
                });
            } else {
                if (fulfillRequestId) {
                    addToast('Cobrança paga com sucesso!', 'success');
                } else {
                    addToast(isCharge ? 'Cobrança enviada!' : 'Solicitação enviada!', 'success');
                }
            }

            if (!sourceAccountId && !isCharge && !fulfillRequestId) addToast('Solicitação de pagamento enviada!', 'success');

            onSuccess?.();
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
                <div className={`p-4 border-b dark:border-slate-800 flex justify-between items-center rounded-t-2xl ${isCharge ? 'bg-indigo-50 dark:bg-indigo-900/20' : 'bg-emerald-50 dark:bg-emerald-900/20'}`}>
                    <h3 className={`font-bold flex items-center gap-2 ${isCharge ? 'text-indigo-900 dark:text-indigo-100' : 'text-emerald-900 dark:text-emerald-100'}`}>
                        {isCharge ? <ArrowRightLeft className="w-5 h-5" /> : <Wallet className="w-5 h-5" />}
                        {isCharge ? 'Enviar Cobrança' : 'Quitar Dívida / Pagar'}
                    </h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Quem */}
                    <div>
                        <label className="block text-sm font-medium mb-1 text-slate-700 dark:text-slate-300">
                            {isCharge ? 'Quem você está cobrando?' : 'Quem você está pagando?'}
                        </label>
                        <select
                            value={selectedMemberId}
                            onChange={e => setSelectedMemberId(e.target.value)}
                            className="w-full p-3 rounded-xl border bg-slate-50 dark:bg-slate-800 dark:border-slate-700"
                        >
                            <option value="">Selecione...</option>
                            {familyMembers.filter(m => m.email).map(m => (
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
                            {isCharge ? 'Data de Vencimento / Referência' : 'Data do Pagamento'}
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

                    {/* De onde sai o dinheiro (Show only if PAYING) */}
                    {!isCharge && (
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
                                {validAccounts.map(a => (
                                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, a.currency)})</option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div className="pt-4 flex gap-3">
                        <Button type="button" variant="ghost" onClick={onClose} className="flex-1">Cancelar</Button>
                        <Button type="submit" className={`flex-1 text-white ${isCharge ? 'bg-indigo-600 hover:bg-indigo-700' : 'bg-emerald-600 hover:bg-emerald-700'}`} disabled={isLoading}>
                            {isLoading ? 'Enviando...' : (isCharge ? 'Enviar Cobrança' : 'Confirmar Pagamento')}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
};
