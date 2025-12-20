import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '../ui/Button';
import { Check, X, Bell } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Transaction, Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils';

interface SharedRequest {
    id: string;
    assigned_amount?: number;
    transaction: Transaction; // Joined data
    transaction_id: string;
    requester_id: string;
    requester_email?: string; // We might need to fetch profile
    requester_name?: string;
    status: 'PENDING' | 'ACCEPTED' | 'REJECTED';
    created_at: string;
}

interface SharedRequestsProps {
    currentUserId: string;
    accounts?: Account[];
    onStatusChange: () => void; // Reload data
}

export const SharedRequests: React.FC<SharedRequestsProps> = ({ currentUserId, accounts = [], onStatusChange }) => {
    const [requests, setRequests] = useState<SharedRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    const fetchRequests = async () => {
        try {
            // UPDATE RPC TO V3 (Fixes ambiguous 400 error)
            const { data, error } = await supabase.rpc('get_shared_requests_v3');

            if (error) {
                const logger = (await import('../../utils/logger')).logger;
                logger.error('Error fetching shared requests', error);
                // toast.error("Erro ao carregar solicitações pendentes.");
            } else if (data) {
                // Map db headers to expected format if needed
                const formatted = data.map((item: any) => ({
                    id: item.id,
                    transaction_id: item.transaction_id,
                    requester_id: item.requester_id,
                    status: item.status,
                    created_at: item.created_at,
                    assigned_amount: item.assigned_amount,
                    // Flatten nested TX logic if it was object, but RPC returns flat columns now
                    transaction: {
                        id: item.transaction_id, // Add id to transaction object
                        description: item.tx_description,
                        amount: item.tx_amount,
                        currency: item.tx_currency,
                        date: item.tx_date,
                        category: item.tx_category,
                        observation: item.tx_observation,
                        tripId: item.tx_trip_id
                    } as Transaction,
                    requester_name: item.requester_name, // Directly assign requester_name
                    requester_email: item.requester_email // Directly assign requester_email
                }));
                setRequests(formatted);
            }
        } catch (e) {
            console.error("Fetch shared requests exception:", e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUserId) fetchRequests();
    }, [currentUserId]);

    const handleRespond = async (request: SharedRequest, status: 'ACCEPTED' | 'REJECTED') => {
        try {
            let accountId = undefined;

            if (status === 'ACCEPTED') {
                // Find default account (Liquid) to link the new expense
                const defaultAccount = accounts.find(a => a.type === AccountType.CHECKING || a.type === AccountType.CASH) || accounts[0];
                if (!defaultAccount) {
                    addToast("Erro: Nenhuma conta encontrada para registrar a despesa.", "error");
                    return;
                }
                accountId = defaultAccount.id;
            }

            // Call Atomic RPC
            const { data, error } = await supabase.rpc('respond_to_shared_request', {
                p_request_id: request.id,
                p_status: status,
                p_account_id: accountId
            });

            if (error) throw error;
            if (!data.success) throw new Error(data.message);

            addToast(status === 'ACCEPTED' ? "Solicitação aceita e despesa criada!" : "Solicitação recusada.", status === 'ACCEPTED' ? 'success' : 'info');

            // Optimization: Remove from local state immediately
            setRequests(prev => prev.filter(r => r.id !== request.id));
            onStatusChange();

        } catch (error: any) {
            console.error("Error responding:", error);
            addToast(error.message || "Erro ao responder solicitação.", "error");
        }
    };

    // ... render ...
    // Note: Updated map to pass full object to handleRespond:
    // onClick={() => handleRespond(req, 'ACCEPTED')}


    if (isLoading) return null; // Or skeleton
    if (requests.length === 0) return null; // Don't show if empty

    return (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
            <div className="p-4 flex items-center gap-3 border-b border-amber-100 dark:border-amber-800/50">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-amber-900 dark:text-amber-100 text-sm">Solicitações de Compartilhamento ({requests.length})</h3>
                <div className="ml-auto">
                    <Button
                        size="sm"
                        variant="ghost"
                        className="text-amber-700 hover:bg-amber-100 hover:text-amber-900 h-7 px-2 text-xs"
                        onClick={async () => {
                            if (!window.confirm("Aceitar todas as solicitações pendentes?")) return;

                            try {
                                const defaultAccount = accounts.find(a => a.type === AccountType.CHECKING || a.type === AccountType.CASH) || accounts[0];
                                if (!defaultAccount) {
                                    addToast("Erro: Nenhuma conta encontrada para registrar as despesas.", "error");
                                    return;
                                }

                                const updates = requests.map(r =>
                                    supabase.rpc('respond_to_shared_request', {
                                        p_request_id: r.id,
                                        p_status: 'ACCEPTED',
                                        p_account_id: defaultAccount.id
                                    })
                                );

                                const results = await Promise.all(updates);
                                const failures = results.filter(r => r.error);

                                if (failures.length > 0) {
                                    console.error('Some requests failed:', failures);
                                    addToast(`${failures.length} solicitações falharam. Verifique o console.`, 'warning');
                                } else {
                                    addToast("Todas as solicitações foram aceitas!", 'success');
                                }

                                setRequests([]);
                                onStatusChange();
                            } catch (e) {
                                console.error(e);
                                addToast("Erro ao aceitar tudo.", 'error');
                            }
                        }}
                    >
                        Aceitar Tudo
                    </Button>
                </div>
            </div>
            <div className="divide-y divide-amber-100 dark:divide-amber-800/50">
                {requests.map(req => (
                    <div key={req.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                                {req.requester_name} deseja compartilhar uma despesa
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {req.transaction?.description} • <span className="font-bold">{req.transaction ? formatCurrency(req.assigned_amount || req.transaction.amount, req.transaction.currency || 'BRL') : '???'}</span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(req.transaction?.date).toLocaleDateString()}
                            </p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                size="sm"
                                variant="secondary"
                                className="flex-1 sm:flex-none border-red-200 hover:bg-red-50 text-red-600"
                                onClick={() => handleRespond(req, 'REJECTED')}
                            >
                                <X className="w-4 h-4 mr-1" /> Recusar
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleRespond(req, 'ACCEPTED')}
                            >
                                <Check className="w-4 h-4 mr-1" /> Aceitar
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
