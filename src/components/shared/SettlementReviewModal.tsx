import React, { useState } from 'react';
import { Check, X, ArrowDownLeft } from 'lucide-react';
import { Button } from '../ui/Button';
import { supabase } from '../../integrations/supabase/client';
import { useToast } from '../ui/Toast';
import { Account, TransactionType, Category } from '../../types';
import { formatCurrency } from '../../utils';

interface SettlementReviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    request: import('../../types/settlement').SettlementRequest;
    accounts: Account[];
    currentUserId: string;
    onSuccess: () => void;
    onAddTransaction: (t: import('../../types').Transaction) => void;
}

export const SettlementReviewModal: React.FC<SettlementReviewModalProps> = ({
    isOpen, onClose, request, accounts, currentUserId, onSuccess, onAddTransaction
}) => {
    const { addToast } = useToast();
    const [destinationAccountId, setDestinationAccountId] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    // Filter accounts to match request currency
    // Since we added currency column to settlement_requests, it should be in request object.
    // Fallback to BRL if missing (legacy requests)
    const requestCurrency = request?.currency || 'BRL';
    const validAccounts = accounts.filter(a => (a.currency || 'BRL') === requestCurrency);

    if (!isOpen || !request) return null;

    const handleConfirm = async () => {
        if (!destinationAccountId) {
            addToast('Selecione uma conta para receber o valor.', 'error');
            return;
        }

        setIsLoading(true);
        try {
            // 1. Create Income Transaction via Store (Updates UI)
            await onAddTransaction({
                id: crypto.randomUUID(),
                description: `Pagamento recebido de ${(request as any).payer_name || 'Usuário'}`,
                amount: request.amount,
                date: (request as any).date || new Date().toISOString().split('T')[0],
                type: TransactionType.INCOME,
                category: Category.INCOME,
                accountId: destinationAccountId,
                isSettled: true, // It is money in hand
                observation: `[SETTLEMENT:${request.id}] Recebimento confirmado.`
            });

            // 2. Update Request Status
            const { error: reqError } = await supabase
                .from('settlement_requests')
                .update({ status: 'COMPLETED', responded_at: new Date().toISOString() })
                .eq('id', request.id);

            if (reqError) throw reqError;

            addToast('Recebimento confirmado!', 'success');
            onSuccess();
            onClose();

        } catch (error: any) {
            console.error(error);
            addToast(`Erro: ${error.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleReject = async () => {
        if (!window.confirm("Tem certeza que deseja recusar este pagamento?")) return;
        setIsLoading(true);
        try {
            await supabase
                .from('settlement_requests')
                .update({ status: 'REJECTED', responded_at: new Date().toISOString() })
                .eq('id', request.id);

            addToast('Pagamento recusado.', 'info');
            onSuccess();
            onClose();
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md shadow-2xl border dark:border-slate-800 animate-in zoom-in-95 duration-200">
                <div className="p-6 text-center">
                    <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-600 dark:text-emerald-400">
                        <ArrowDownLeft className="w-8 h-8" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                        Recebimento de Valor
                    </h3>
                    <p className="text-slate-600 dark:text-slate-400 mb-6">
                        <span className="font-bold text-slate-900 dark:text-white">{(request as any).payer_name}</span> diz que pagou <span className="font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(request.amount, (request as any).currency || 'BRL')}</span> em {new Date((request as any).date || (request as any).createdAt || Date.now()).toLocaleDateString()}.
                    </p>

                    <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 mb-6 text-left border border-slate-100 dark:border-slate-700">
                        <label className="block text-sm font-medium mb-2 text-slate-700 dark:text-slate-300">
                            Onde você quer depositar esse dinheiro?
                        </label>
                        <select
                            value={destinationAccountId}
                            onChange={e => setDestinationAccountId(e.target.value)}
                            className="w-full p-3 rounded-lg border bg-white dark:bg-slate-900 dark:border-slate-700 font-medium"
                        >
                            <option value="">Selecione a conta...</option>
                            {validAccounts.map(a => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            onClick={handleReject}
                            className="flex-1 border-red-200 text-red-600 hover:bg-red-50"
                            disabled={isLoading}
                        >
                            <X className="w-4 h-4 mr-2" /> Recusar
                        </Button>
                        <Button
                            className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
                            onClick={handleConfirm}
                            disabled={isLoading}
                        >
                            <Check className="w-4 h-4 mr-2" /> Confirmar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
};
