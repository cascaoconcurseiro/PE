/**
 * Hook para gerenciamento de membros da família
 * Extraído do useDataStore para melhor separação de responsabilidades
 */

import { useState, useCallback } from 'react';
import { FamilyMember, Transaction } from '../types';
import { supabaseService } from '../core/services/supabaseService';
import { logger } from '../services/logger';

interface UseFamilyStoreProps {
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
    isOnline: boolean;
}

export const useFamilyStore = ({ onSuccess, onError, isOnline }: UseFamilyStoreProps) => {
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchFamilyMembers = useCallback(async () => {
        try {
            const data = await supabaseService.getFamilyMembers();
            setFamilyMembers(data);
            return data;
        } catch (error) {
            logger.error('Erro ao carregar membros da família', error);
            throw error;
        }
    }, []);

    const addMember = useCallback(async (member: Omit<FamilyMember, 'id'>) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.create('family_members', { id: crypto.randomUUID(), ...member });
            await fetchFamilyMembers();
            onSuccess('Membro adicionado!');
        } catch (error) {
            logger.error('Erro ao adicionar membro', error);
            onError((error as Error).message || 'Erro ao adicionar membro');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, fetchFamilyMembers, onSuccess, onError]);

    const updateMember = useCallback(async (member: FamilyMember) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.update('family_members', member);
            setFamilyMembers(prev => prev.map(m => m.id === member.id ? member : m));
            onSuccess('Membro atualizado!');
        } catch (error) {
            logger.error('Erro ao atualizar membro', error);
            onError((error as Error).message || 'Erro ao atualizar membro');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const deleteMember = useCallback(async (
        id: string,
        transactions: Transaction[],
        setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>,
        strategy: 'CASCADE' | 'UNLINK' = 'UNLINK'
    ) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);

            // Processar transações onde o membro é pagador
            const payerTxs = transactions.filter(t => t.payerId === id);
            if (payerTxs.length > 0) {
                if (strategy === 'CASCADE') {
                    const idsToDelete = payerTxs.map(t => t.id);
                    await supabaseService.bulkDelete('transactions', idsToDelete);
                    setTransactions(prev => prev.filter(t => !idsToDelete.includes(t.id)));
                } else {
                    const updates = payerTxs.map(t => ({ ...t, payerId: 'me', updatedAt: new Date().toISOString() }));
                    await supabaseService.bulkCreate('transactions', updates);
                    setTransactions(prev => prev.map(t => t.payerId === id ? { ...t, payerId: 'me' } : t));
                }
            }

            // Processar transações compartilhadas com o membro
            const sharedTxs = transactions.filter(t => t.sharedWith?.some(s => s.memberId === id));
            if (sharedTxs.length > 0) {
                const updates = sharedTxs.map(t => {
                    const newShared = t.sharedWith?.filter(s => s.memberId !== id) || [];
                    return {
                        ...t,
                        sharedWith: newShared,
                        isShared: newShared.length > 0,
                        updatedAt: new Date().toISOString()
                    };
                });
                await supabaseService.bulkCreate('transactions', updates);
                setTransactions(prev => prev.map(t => {
                    const match = updates.find(u => u.id === t.id);
                    return match ? match : t;
                }));
            }

            // Deletar o membro
            await supabaseService.delete('family_members', id);
            setFamilyMembers(prev => prev.filter(m => m.id !== id));

            onSuccess('Membro removido e vínculos processados.');
        } catch (error) {
            logger.error('Erro ao remover membro', error);
            onError((error as Error).message || 'Erro ao remover membro');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    return {
        familyMembers,
        setFamilyMembers,
        isLoading,
        fetchFamilyMembers,
        addMember,
        updateMember,
        deleteMember
    };
};
