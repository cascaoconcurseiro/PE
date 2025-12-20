/**
 * Hook para gerenciamento de transações
 * Extraído do useDataStore para melhor separação de responsabilidades
 */

import { useState, useCallback, useRef } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { supabaseService } from '../core/services/supabaseService';
import { parseDate } from '../utils';
import { logger } from '../services/logger';
import { FinancialPrecision } from '../services/financialPrecision';

interface UseTransactionStoreProps {
    accounts: Account[];
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
    isOnline: boolean;
}

export const useTransactionStore = ({ accounts, onSuccess, onError, isOnline }: UseTransactionStoreProps) => {
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const loadedPeriods = useRef<Set<string>>(new Set());

    // Validação de transação
    const validateTransaction = useCallback((tx: Partial<Transaction>) => {
        if (!tx.amount || tx.amount <= 0) {
            throw new Error('Valor da transação inválido.');
        }
        if (!tx.description?.trim()) {
            throw new Error('Descrição obrigatória.');
        }
        if (!tx.date) {
            throw new Error('Data obrigatória.');
        }

        // ✅ Validar se a data é válida
        const txDate = new Date(tx.date);
        if (isNaN(txDate.getTime())) {
            throw new Error('Data inválida.');
        }

        // Validar se a data faz sentido (ex: 2024-02-30 seria inválida)
        const [year, month, day] = tx.date.split('-').map(Number);
        const reconstructedDate = new Date(year, month - 1, day);
        if (
            reconstructedDate.getFullYear() !== year ||
            reconstructedDate.getMonth() !== month - 1 ||
            reconstructedDate.getDate() !== day
        ) {
            throw new Error('Data inválida (dia não existe no mês).');
        }

        if (tx.type === TransactionType.TRANSFER) {
            if (!tx.accountId) {
                throw new Error('Conta de origem obrigatória para transferência.');
            }
            if (!tx.destinationAccountId) {
                throw new Error('Conta de destino obrigatória para transferência.');
            }
            if (tx.accountId === tx.destinationAccountId) {
                throw new Error('Origem e destino não podem ser iguais.');
            }

            const sourceExists = accounts.find(a => a.id === tx.accountId);
            const destExists = accounts.find(a => a.id === tx.destinationAccountId);
            if (!sourceExists) throw new Error('Conta de origem não encontrada.');
            if (!destExists) throw new Error('Conta de destino não encontrada.');
        } else {
            if (!tx.accountId && (!tx.payerId || tx.payerId === 'me') && !tx.isShared) {
                throw new Error('Conta é obrigatória.');
            }
        }
    }, [accounts]);

    // Gerar parcelas
    const generateInstallments = useCallback((newTx: Omit<Transaction, 'id'> & { id?: string }): Transaction[] => {
        const now = new Date().toISOString();
        const totalInstallments = Number(newTx.totalInstallments);
        const txs: Transaction[] = [];

        if (newTx.isInstallment && totalInstallments > 1 && (newTx as any).amount) {
            const baseDate = parseDate((newTx as any).date);
            const seriesId = crypto.randomUUID();

            // Usar FinancialPrecision para cálculos precisos
            const baseInstallmentValue = FinancialPrecision.divide((newTx as any).amount, totalInstallments);
            let accumulatedAmount = 0;
            const accumulatedSharedAmounts: { [memberId: string]: number } = {};

            if ((newTx as any).sharedWith) {
                (newTx as any).sharedWith.forEach((s: any) => { accumulatedSharedAmounts[s.memberId] = 0; });
            }

            for (let i = 0; i < totalInstallments; i++) {
                const targetMonth = baseDate.getMonth() + i;
                const targetYear = baseDate.getFullYear() + Math.floor(targetMonth / 12);
                const finalMonth = targetMonth % 12;
                const nextDate = new Date(targetYear, finalMonth, 1);
                const targetDay = baseDate.getDate();
                const daysInTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
                nextDate.setDate(Math.min(targetDay, daysInTargetMonth));

                const formattedDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}-${String(nextDate.getDate()).padStart(2, '0')}`;

                let currentAmount = baseInstallmentValue;
                if (i === totalInstallments - 1) {
                    // Última parcela: ajustar para garantir soma exata
                    currentAmount = FinancialPrecision.subtract((newTx as any).amount, accumulatedAmount);
                }
                accumulatedAmount = FinancialPrecision.sum([accumulatedAmount, currentAmount]);

                let currentSharedWith = undefined;
                if ((newTx as any).sharedWith) {
                    currentSharedWith = (newTx as any).sharedWith.map((s: any) => {
                        let assignedAmount = FinancialPrecision.multiply(
                            FinancialPrecision.divide(s.assignedAmount, (newTx as any).amount),
                            currentAmount
                        );
                        if (i === totalInstallments - 1) {
                            assignedAmount = FinancialPrecision.subtract(
                                s.assignedAmount,
                                accumulatedSharedAmounts[s.memberId]
                            );
                        }
                        accumulatedSharedAmounts[s.memberId] = FinancialPrecision.sum([
                            accumulatedSharedAmounts[s.memberId],
                            assignedAmount
                        ]);
                        return { ...s, assignedAmount };
                    });
                }

                txs.push({
                    ...newTx,
                    id: crypto.randomUUID(),
                    date: formattedDate,
                    amount: currentAmount,
                    description: `${newTx.description} (${i + 1}/${totalInstallments})`,
                    currentInstallment: i + 1,
                    totalInstallments: totalInstallments,
                    seriesId: seriesId,
                    sharedWith: currentSharedWith,
                    isRecurring: false,
                    isSettled: false,
                    createdAt: now,
                    updatedAt: now
                } as Transaction);
            }
        } else {
            txs.push({
                ...newTx,
                id: newTx.id || crypto.randomUUID(),
                isSettled: false,
                createdAt: now,
                updatedAt: now
            } as Transaction);
        }
        return txs;
    }, []);

    const addTransaction = useCallback(async (newTx: Omit<Transaction, 'id'> & { id?: string }) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            validateTransaction(newTx);
            setIsLoading(true);

            const txsToCreate = generateInstallments(newTx);

            // Optimistic update
            setTransactions(prev => {
                const newTxs = [...prev, ...txsToCreate];
                return newTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            // Persistir no backend
            for (const tx of txsToCreate) {
                await supabaseService.createTransactionWithValidation(tx);
            }

            onSuccess('Transação adicionada com sucesso!');
        } catch (error) {
            logger.error('Erro ao adicionar transação', error);
            onError((error as Error).message || 'Erro ao adicionar transação');
            // Reverter optimistic update em caso de erro - refresh será feito pelo caller
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, validateTransaction, generateInstallments, onSuccess, onError]);

    const updateTransaction = useCallback(async (updatedTx: Transaction) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            validateTransaction(updatedTx);
            setIsLoading(true);

            // Optimistic update
            const previousTx = transactions.find(t => t.id === updatedTx.id);
            setTransactions(prev => prev.map(t =>
                t.id === updatedTx.id ? { ...updatedTx, updatedAt: new Date().toISOString() } : t
            ));

            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
            onSuccess('Transação atualizada!');
        } catch (error) {
            logger.error('Erro ao atualizar transação', error);
            onError((error as Error).message || 'Erro ao atualizar transação');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, transactions, validateTransaction, onSuccess, onError]);

    const deleteTransaction = useCallback(async (id: string, deleteScope: 'SINGLE' | 'SERIES' = 'SINGLE') => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            const txToDelete = transactions.find(t => t.id === id);
            if (!txToDelete) return;

            // Optimistic update
            if (deleteScope === 'SERIES' && txToDelete.seriesId) {
                setTransactions(prev => prev.filter(t => t.seriesId !== txToDelete.seriesId));
            } else {
                setTransactions(prev => prev.filter(t => t.id !== id));
            }

            if (deleteScope === 'SERIES' && txToDelete.seriesId) {
                await supabaseService.deleteTransactionSeries(txToDelete.seriesId);
                onSuccess('Série excluída.');
            } else {
                await supabaseService.update('transactions', { ...txToDelete, deleted: true, updatedAt: new Date().toISOString() });
                onSuccess('Transação excluída.');
            }
        } catch (error) {
            logger.error('Erro ao excluir transação', error);
            onError((error as Error).message || 'Erro ao excluir transação');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, transactions, onSuccess, onError]);

    const addTransactions = useCallback(async (newTxs: (Omit<Transaction, 'id'> & { id?: string })[]) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            const txsToCreate = newTxs.map(tx => ({
                ...tx,
                id: tx.id || crypto.randomUUID(),
                isSettled: tx.isSettled ?? false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            })) as Transaction[];

            // Optimistic update
            setTransactions(prev => [...prev, ...txsToCreate]);

            for (const tx of txsToCreate) {
                await supabaseService.createTransactionWithValidation(tx);
            }

            onSuccess(`${newTxs.length} transações adicionadas!`);
        } catch (error) {
            logger.error('Erro ao adicionar transações', error);
            onError((error as Error).message || 'Erro ao adicionar transações');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const batchUpdateTransactions = useCallback(async (txs: Transaction[]) => {
        if (!isOnline || txs.length === 0) return;

        try {
            setIsLoading(true);

            // Optimistic update
            setTransactions(prev => {
                const updatedIds = new Set(txs.map(t => t.id));
                const unchanged = prev.filter(t => !updatedIds.has(t.id));
                return [...unchanged, ...txs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            const updates = txs.map(t => ({ ...t, updatedAt: new Date().toISOString() }));
            await supabaseService.bulkCreate('transactions', updates);

            onSuccess(`${txs.length} transações atualizadas!`);
        } catch (error) {
            logger.error('Erro ao atualizar transações em lote', error);
            onError((error as Error).message || 'Erro ao atualizar transações');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const fetchTransactionsByRange = useCallback(async (startDate: string, endDate: string) => {
        try {
            const txs = await supabaseService.getTransactionsByRange(startDate, endDate);
            return txs;
        } catch (error) {
            logger.error('Erro ao carregar transações', error);
            throw error;
        }
    }, []);

    const ensurePeriodLoaded = useCallback(async (date: Date) => {
        if (!isOnline) return;

        const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (loadedPeriods.current.has(periodKey)) {
            return;
        }

        loadedPeriods.current.add(periodKey);
        logger.debug(`📥 Lazy Loading History for: ${periodKey}`);

        try {
            const year = date.getFullYear();
            const month = date.getMonth();
            const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
            const endDay = new Date(year, month + 1, 0).getDate();
            const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;

            const newTxs = await supabaseService.getTransactionsByRange(startStr, endStr);

            if (newTxs.length > 0) {
                setTransactions(prev => {
                    const existingIds = new Set(prev.map(t => t.id));
                    const trulyNew = newTxs.filter(t => !existingIds.has(t.id));

                    if (trulyNew.length === 0) return prev;

                    const all = [...prev, ...trulyNew];
                    return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                });
            }
        } catch (e) {
            loadedPeriods.current.delete(periodKey);
            logger.error('Failed to load history window', e);
        }
    }, [isOnline]);

    return {
        transactions,
        setTransactions,
        isLoading,
        loadedPeriods,
        validateTransaction,
        addTransaction,
        updateTransaction,
        deleteTransaction,
        addTransactions,
        batchUpdateTransactions,
        fetchTransactionsByRange,
        ensurePeriodLoaded
    };
};
