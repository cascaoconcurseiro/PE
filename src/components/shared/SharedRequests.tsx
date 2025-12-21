import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../ui/Button';
import { Check, X, Bell, RefreshCw, AlertCircle } from 'lucide-react';
import { useToast } from '../ui/Toast';
import { Account, AccountType } from '../../types';
import { formatCurrency } from '../../utils';
import { sharedTransactionManager } from '../../services/SharedTransactionManager';

interface SharedRequest {
    id: string;
    original_transaction_id: string;
    requested_by_user_id: string;
    requested_to_user_id: string;
    amount: number;
    description: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

interface SharedRequestsProps {
    currentUserId: string;
    accounts?: Account[];
    onStatusChange: () => void;
}

export const SharedRequests: React.FC<SharedRequestsProps> = ({ 
    currentUserId, 
    accounts = [], 
    onStatusChange 
}) => {
    const [requests, setRequests] = useState<SharedRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isProcessing, setIsProcessing] = useState<string | null>(null);
    const [isBatchProcessing, setBatchProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const { addToast } = useToast();

    const fetchRequests = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);
            
            const requestsData = await sharedTransactionManager.getSharedRequests(currentUserId, true);
            setRequests(requestsData);
        } catch (error: any) {
            console.error('Error fetching shared requests:', error);
            setError('Erro ao carregar solicitações');
            addToast('Erro ao carregar solicitações pendentes', 'error');
        } finally {
            setIsLoading(false);
        }
    }, [currentUserId, addToast]);

    useEffect(() => {
        if (currentUserId) {
            fetchRequests();
        }
    }, [currentUserId, fetchRequests]);

    // Setup real-time updates
    useEffect(() => {
        const handleRealtimeUpdate = (data: any) => {
            if (data.type === 'shared_requests') {
                fetchRequests();
            }
        };

        const handleRequestResponded = (data: any) => {
            // Remove from local state immediately for better UX
            setRequests(prev => prev.filter(r => r.id !== data.requestId));
            onStatusChange();
        };

        sharedTransactionManager.on('realtimeUpdate', handleRealtimeUpdate);
        sharedTransactionManager.on('requestResponded', handleRequestResponded);

        return () => {
            sharedTransactionManager.off('realtimeUpdate', handleRealtimeUpdate);
            sharedTransactionManager.off('requestResponded', handleRequestResponded);
        };
    }, [fetchRequests, onStatusChange]);

    const handleRespond = async (request: SharedRequest, response: 'accept' | 'reject') => {
        try {
            setIsProcessing(request.id);
            setError(null);

            let accountId: string | undefined;

            if (response === 'accept') {
                // Find default account for the new expense
                const defaultAccount = accounts.find(a => 
                    a.type === AccountType.CHECKING || a.type === AccountType.CASH
                ) || accounts[0];
                
                if (!defaultAccount) {
                    addToast('Erro: Nenhuma conta encontrada para registrar a despesa', 'error');
                    return;
                }
                accountId = defaultAccount.id;
            }

            const result = await sharedTransactionManager.respondToSharedRequest(
                request.id, 
                response, 
                accountId
            );

            if (!result.success) {
                throw new Error(result.error || 'Erro desconhecido');
            }

            const message = response === 'accept' 
                ? 'Solicitação aceita e despesa criada!' 
                : 'Solicitação recusada';
            
            addToast(message, response === 'accept' ? 'success' : 'info');

            // Remove from local state immediately
            setRequests(prev => prev.filter(r => r.id !== request.id));
            onStatusChange();

        } catch (error: any) {
            console.error('Error responding to request:', error);
            setError(error.message || 'Erro ao responder solicitação');
            addToast(error.message || 'Erro ao responder solicitação', 'error');
        } finally {
            setIsProcessing(null);
        }
    };

    const handleAcceptAll = async () => {
        if (!window.confirm(`Aceitar todas as ${requests.length} solicitações pendentes?`)) {
            return;
        }

        try {
            setBatchProcessing(true);
            setError(null);

            const defaultAccount = accounts.find(a => 
                a.type === AccountType.CHECKING || a.type === AccountType.CASH
            ) || accounts[0];
            
            if (!defaultAccount) {
                addToast('Erro: Nenhuma conta encontrada para registrar as despesas', 'error');
                return;
            }

            const results = await Promise.allSettled(
                requests.map(request => 
                    sharedTransactionManager.respondToSharedRequest(
                        request.id, 
                        'accept', 
                        defaultAccount.id
                    )
                )
            );

            const failures = results.filter(r => r.status === 'rejected').length;
            const successes = results.length - failures;

            if (failures > 0) {
                addToast(
                    `${successes} solicitações aceitas, ${failures} falharam`, 
                    'warning'
                );
            } else {
                addToast('Todas as solicitações foram aceitas!', 'success');
            }

            setRequests([]);
            onStatusChange();

        } catch (error: any) {
            console.error('Error accepting all requests:', error);
            setError('Erro ao aceitar todas as solicitações');
            addToast('Erro ao aceitar todas as solicitações', 'error');
        } finally {
            setBatchProcessing(false);
        }
    };

    const handleRetry = () => {
        fetchRequests();
    };

    if (isLoading) {
        return (
            <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                    <RefreshCw className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-spin" />
                    <span className="text-amber-900 dark:text-amber-100 text-sm">
                        Carregando solicitações...
                    </span>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="mb-6 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700/50 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                    <span className="text-red-900 dark:text-red-100 text-sm flex-1">
                        {error}
                    </span>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRetry}
                        className="text-red-700 hover:bg-red-100"
                    >
                        <RefreshCw className="w-4 h-4 mr-1" />
                        Tentar Novamente
                    </Button>
                </div>
            </div>
        );
    }

    if (requests.length === 0) {
        return null; // Don't show if empty
    }

    return (
        <div className="mb-6 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700/50 rounded-2xl overflow-hidden animate-in slide-in-from-top-2">
            <div className="p-4 flex items-center gap-3 border-b border-amber-100 dark:border-amber-800/50">
                <Bell className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                <h3 className="font-bold text-amber-900 dark:text-amber-100 text-sm">
                    Solicitações de Compartilhamento ({requests.length})
                </h3>
                <div className="ml-auto flex gap-2">
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleRetry}
                        disabled={isLoading}
                        className="text-amber-700 hover:bg-amber-100 hover:text-amber-900 h-7 px-2 text-xs"
                    >
                        <RefreshCw className={`w-3 h-3 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </Button>
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={handleAcceptAll}
                        disabled={isBatchProcessing || requests.length === 0}
                        className="text-amber-700 hover:bg-amber-100 hover:text-amber-900 h-7 px-2 text-xs"
                    >
                        {isBatchProcessing ? (
                            <>
                                <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
                                Processando...
                            </>
                        ) : (
                            'Aceitar Tudo'
                        )}
                    </Button>
                </div>
            </div>
            <div className="divide-y divide-amber-100 dark:divide-amber-800/50">
                {requests.map(request => (
                    <div key={request.id} className="p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        <div className="flex-1">
                            <p className="text-sm font-bold text-slate-800 dark:text-white">
                                Solicitação de compartilhamento
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                {request.description} • <span className="font-bold">
                                    {formatCurrency(request.amount, 'BRL')}
                                </span>
                            </p>
                            <p className="text-[10px] text-slate-400 mt-1">
                                {new Date(request.created_at).toLocaleDateString('pt-BR')}
                            </p>
                        </div>
                        <div className="flex gap-2 w-full sm:w-auto">
                            <Button
                                size="sm"
                                variant="secondary"
                                disabled={isProcessing === request.id || isBatchProcessing}
                                className="flex-1 sm:flex-none border-red-200 hover:bg-red-50 text-red-600 disabled:opacity-50"
                                onClick={() => handleRespond(request, 'reject')}
                            >
                                <X className="w-4 h-4 mr-1" /> 
                                Recusar
                            </Button>
                            <Button
                                size="sm"
                                disabled={isProcessing === request.id || isBatchProcessing}
                                className="flex-1 sm:flex-none bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50"
                                onClick={() => handleRespond(request, 'accept')}
                            >
                                {isProcessing === request.id ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 mr-1 animate-spin" />
                                        Processando...
                                    </>
                                ) : (
                                    <>
                                        <Check className="w-4 h-4 mr-1" /> 
                                        Aceitar
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};
