import React, { useState, useEffect } from 'react';
import { supabase } from '../../integrations/supabase/client';
import { Button } from '../ui/Button';
import { Check, X, Bell, AlertTriangle } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Transaction } from '../../types';
import { formatCurrency } from '../../utils';

interface SharedRequest {
    id: string;
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
    onStatusChange: () => void; // Reload data
}

export const SharedRequests: React.FC<SharedRequestsProps> = ({ currentUserId, onStatusChange }) => {
    const [requests, setRequests] = useState<SharedRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const { addToast } = useToast();

    const fetchRequests = async () => {
        try {
            const { data, error } = await supabase
                .from('shared_transaction_requests')
                .select(`
                    id,
                    transaction_id,
                    requester_id,
                    status,
                    created_at,
                    transaction:transactions(*)
                `)
                .eq('invited_user_id', currentUserId)
                .eq('status', 'PENDING');

            if (error) throw error;

            // Fetch requester profiles manually since we might not have a direct relation setup for it in Types
            // or just rely on IDs if simple. Let's try to get emails.
            const userIds = Array.from(new Set(data?.map(r => r.requester_id) || []));
            let userProfiles: Record<string, any> = {};

            if (userIds.length > 0) {
                const { data: profiles } = await supabase
                    .from('user_profiles')
                    .select('id, name, email')
                    .in('id', userIds);

                profiles?.forEach(p => {
                    userProfiles[p.id] = p;
                });
            }

            const formattedRequests = data?.map(r => ({
                ...r,
                transaction: Array.isArray(r.transaction) ? r.transaction[0] : r.transaction,
                requester_name: userProfiles[r.requester_id]?.name || 'Usuário',
                requester_email: userProfiles[r.requester_id]?.email
            })) as unknown as SharedRequest[];

            setRequests(formattedRequests || []);
        } catch (error) {
            console.error("Error fetching requests:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (currentUserId) fetchRequests();
    }, [currentUserId]);

    const handleRespond = async (requestId: string, status: 'ACCEPTED' | 'REJECTED') => {
        try {
            const { error } = await supabase
                .from('shared_transaction_requests')
                .update({ status, responded_at: new Date().toISOString() })
                .eq('id', requestId);

            if (error) throw error;

            addToast(status === 'ACCEPTED' ? "Solicitação aceita!" : "Solicitação recusada.", status === 'ACCEPTED' ? 'success' : 'info');

            // Optimization: Remove from local state immediately
            setRequests(prev => prev.filter(r => r.id !== requestId));
            onStatusChange();

        } catch (error) {
            console.error("Error responding:", error);
            addToast("Erro ao responder solicitação.", "error");
        }
    };

    if (isLoading) return null; // Or skeleton
    if (requests.length === 0) return null; // Don't show if empty

    return (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
            <div className="p-4 flex items-center gap-3 border-b border-amber-100 dark:border-amber-800/50">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-amber-900 dark:text-amber-100 text-sm">Solicitações de Compartilhamento ({requests.length})</h3>
            </div>
            <div className="divide-y divide-amber-100 dark:divide-amber-800/50">
                {requests.map(req => (
                    <div key={req.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div>
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                                {req.requester_name} deseja compartilhar uma despesa
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {req.transaction?.description} • <span className="font-bold">{req.transaction ? formatCurrency(req.transaction.amount, req.transaction.currency || 'BRL') : '???'}</span>
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
                                onClick={() => handleRespond(req.id, 'REJECTED')}
                            >
                                <X className="w-4 h-4 mr-1" /> Recusar
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white"
                                onClick={() => handleRespond(req.id, 'ACCEPTED')}
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
