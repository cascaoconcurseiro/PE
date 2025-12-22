import { useCallback } from 'react';
import { supabaseService } from '../core/services/supabaseService';
import { Account, Transaction, TransactionType } from '../types';
import { parseDate } from '../utils';

interface TransactionOperationsProps {
    accounts: Account[];
    transactions: Transaction[];
    setTransactions: React.Dispatch<React.SetStateAction<Transaction[]>>;
    performOperation: (
        operation: () => Promise<void>,
        successMessage?: string,
        options?: { backgroundRefresh?: boolean }
    ) => Promise<void>;
}

/**
 * Hook para operações de transação
 * Extraído do useDataStore para reduzir complexidade
 * Consolida validação, geração de parcelas e operações CRUD
 */
export const useTransactionOperations = ({
    accounts,
    transactions,
    setTransactions,
    performOperation
}: TransactionOperationsProps) => {

    // Validação de transação
    const validateTransaction = useCallback((tx: Partial<Transaction>) => {
        if (!tx.amount || tx.amount <= 0) throw new Error('Valor da transação inválido.');
        if (!tx.description?.trim()) throw new Error('Descrição obrigatória.');
        if (!tx.date) throw new Error('Data obrigatória.');

        if (tx.type === TransactionType.TRANSFER) {
            if (!tx.accountId) throw new Error('Conta de origem obrigatória para transferência.');
            if (!tx.destinationAccountId) throw new Error('Conta de destino obrigatória para transferência.');
            if (tx.accountId === tx.destinationAccountId) throw new Error('Origem e destino não podem ser iguais.');

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

    // Geração de parcelas
    const generateInstallments = useCallback((newTx: Omit<Transaction, 'id'> & { id?: string }): Transaction[] => {
        const now = new Date().toISOString();
        const totalInstallments = Number(newTx.totalInstallments);
        const txs: Transaction[] = [];

        if (newTx.isInstallment && totalInstallments > 1 && newTx.amount) {
            const baseDate = parseDate(newTx.date as string);
            const seriesId = crypto.randomUUID();
            const baseInstallmentValue = Math.floor(((newTx.amount as number) / totalInstallments) * 100) / 100;
            let accumulatedAmount = 0;
            let accumulatedSharedAmounts: { [memberId: string]: number } = {};

            if (newTx.sharedWith && Array.isArray(newTx.sharedWith)) {
                newTx.sharedWith.forEach((s: any) => { accumulatedSharedAmounts[s.memberId] = 0; });
            }

            for (let i = 0; i < totalInstallments; i++) {
                const targetMonth = baseDate.getMonth() + i;
                const targetYear = baseDate.getFullYear() + Math.floor(targetMonth / 12);
                const finalMonth = targetMonth % 12;
                const nextDate = new Date(targetYear, finalMonth, 1);
                const targetDay = baseDate.getDate();
                const daysInTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
                nextDate.setDate(Math.min(targetDay, daysInTargetMonth));

                const dateYear = nextDate.getFullYear();
                const dateMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
                const dateDay = String(nextDate.getDate()).padStart(2, '0');
                const formattedDate = `${dateYear}-${dateMonth}-${dateDay}`;

                let currentAmount = baseInstallmentValue;
                if (i === totalInstallments - 1) {
                    currentAmount = Number(((newTx.amount as number) - accumulatedAmount).toFixed(2));
                }
                accumulatedAmount += currentAmount;

                let currentSharedWith = undefined;
                if (newTx.sharedWith && Array.isArray(newTx.sharedWith)) {
                    currentSharedWith = newTx.sharedWith.map((s: any) => {
                        let assignedAmount = Number(((s.assignedAmount / (newTx.amount as number)) * currentAmount).toFixed(2));
                        if (i === totalInstallments - 1) {
                            assignedAmount = Number((s.assignedAmount - accumulatedSharedAmounts[s.memberId]).toFixed(2));
                        }
                        accumulatedSharedAmounts[s.memberId] += assignedAmount;
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
                    updatedAt: now,
                    type: newTx.type,
                    category: newTx.category
                } as Transaction);
            }
        } else {
            txs.push({
                ...newTx,
                id: newTx.id || crypto.randomUUID(),
                isSettled: false,
                createdAt: now,
                updatedAt: now,
                type: newTx.type,
                category: newTx.category,
                date: newTx.date,
                amount: newTx.amount,
                description: newTx.description
            } as Transaction);
        }
        return txs;
    }, []);

    // Adicionar transação
    const handleAddTransaction = useCallback(async (newTx: Omit<Transaction, 'id'> & { id?: string }) => {
        validateTransaction(newTx);

        await performOperation(async () => {
            const txsToCreate = generateInstallments(newTx);

            for (const tx of txsToCreate) {
                const newId = await supabaseService.createTransactionWithValidation(tx);
                
                if (newId && typeof newId === 'string') {
                    setTransactions(prev => prev.map(t =>
                        t.id === tx.id ? { ...t, id: newId } : t
                    ));
                }
            }
        }, 'Transação adicionada com sucesso!');
    }, [validateTransaction, generateInstallments, performOperation, setTransactions]);

    // Atualizar transação
    const handleUpdateTransaction = useCallback(async (updatedTx: Transaction) => {
        validateTransaction(updatedTx);

        await performOperation(async () => {
            const originalTx = transactions.find(t => t.id === updatedTx.id);
            
            // Verificar se precisa regenerar série
            if (updatedTx.seriesId && originalTx && updatedTx.totalInstallments !== originalTx.totalInstallments) {
                const seriesTxs = transactions.filter(t => t.seriesId === updatedTx.seriesId);
                const hasPaid = seriesTxs.some(t => t.isSettled || (t.sharedWith?.some(s => s.isSettled)));
                
                if (hasPaid) {
                    throw new Error('Não é possível alterar o número de parcelas de uma série com pagamentos já realizados.');
                }

                const isSharedSeries = seriesTxs.some(t => t.isShared || (t.sharedWith && t.sharedWith.length > 0));
                if (isSharedSeries) {
                    throw new Error('Por segurança, não é permitido alterar o número de parcelas de uma compra compartilhada. Exclua e crie novamente.');
                }

                // Regenerar série
                const firstOldTx = seriesTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                const baseDate = parseDate(firstOldTx ? firstOldTx.date : updatedTx.date);
                const totalInstallments = Number(updatedTx.totalInstallments);
                const baseInstallmentValue = Math.floor((updatedTx.amount / totalInstallments) * 100) / 100;
                let accumulatedAmount = 0;

                const newSeriesTxs: Partial<Transaction>[] = [];
                const now = new Date().toISOString();

                for (let i = 0; i < totalInstallments; i++) {
                    const targetMonth = baseDate.getMonth() + i;
                    const targetYear = baseDate.getFullYear() + Math.floor(targetMonth / 12);
                    const finalMonth = targetMonth % 12;
                    const nextDate = new Date(targetYear, finalMonth, 1);
                    const targetDay = baseDate.getDate();
                    const daysInTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
                    nextDate.setDate(Math.min(targetDay, daysInTargetMonth));

                    const dateYear = nextDate.getFullYear();
                    const dateMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
                    const dateDay = String(nextDate.getDate()).padStart(2, '0');
                    const formattedDate = `${dateYear}-${dateMonth}-${dateDay}`;

                    let currentAmount = baseInstallmentValue;
                    if (i === totalInstallments - 1) {
                        currentAmount = Number((updatedTx.amount - accumulatedAmount).toFixed(2));
                    }
                    accumulatedAmount += currentAmount;

                    newSeriesTxs.push({
                        ...updatedTx,
                        id: crypto.randomUUID(),
                        date: formattedDate,
                        amount: currentAmount,
                        description: `${updatedTx.description.replace(/\(\d+\/\d+\)/, '').trim()} (${i + 1}/${totalInstallments})`,
                        currentInstallment: i + 1,
                        totalInstallments: totalInstallments,
                        seriesId: crypto.randomUUID(),
                        isRecurring: false,
                        isSettled: false,
                        createdAt: now,
                        updatedAt: now,
                        isInstallment: true
                    });
                }

                await supabaseService.recreateTransactionSeries(updatedTx.seriesId, newSeriesTxs);
                return;
            }

            // Atualização padrão
            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
        }, 'Transação atualizada!');
    }, [validateTransaction, transactions, performOperation]);

    // Deletar transação
    const handleDeleteTransaction = useCallback(async (id: string, deleteScope: 'SINGLE' | 'SERIES' = 'SINGLE') => {
        const txToDelete = transactions.find(t => t.id === id);
        if (!txToDelete) return;

        // Atualização otimista
        if (deleteScope === 'SERIES' && txToDelete.seriesId) {
            setTransactions(prev => prev.filter(t => t.seriesId !== txToDelete.seriesId));
        } else {
            setTransactions(prev => prev.filter(t => t.id !== id));
        }

        await performOperation(async () => {
            if (deleteScope === 'SERIES') {
                if (txToDelete.seriesId) {
                    await supabaseService.deleteTransactionSeries(txToDelete.seriesId);
                } else {
                    await supabaseService.update('transactions', { ...txToDelete, deleted: true, updatedAt: new Date().toISOString() });
                }
            } else {
                await supabaseService.update('transactions', { ...txToDelete, deleted: true, updatedAt: new Date().toISOString() });
            }
        }, deleteScope === 'SERIES' ? 'Série excluída.' : 'Transação excluída.', { backgroundRefresh: true });
    }, [transactions, setTransactions, performOperation]);

    // Adicionar múltiplas transações
    const handleAddTransactions = useCallback(async (newTxs: (Omit<Transaction, 'id'> & { id?: string })[]) => {
        const txsToCreate = newTxs.map(tx => ({
            ...tx,
            id: tx.id || crypto.randomUUID(),
            isSettled: tx.isSettled ?? false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })) as Transaction[];

        setTransactions(prev => [...prev, ...txsToCreate]);

        await performOperation(async () => {
            for (const tx of txsToCreate) {
                const newId = await supabaseService.createTransactionWithValidation(tx);
                if (newId && typeof newId === 'string') {
                    setTransactions(prev => prev.map(t =>
                        t.id === tx.id ? { ...t, id: newId } : t
                    ));
                }
            }
        }, `${newTxs.length} transações adicionadas!`);
    }, [setTransactions, performOperation]);

    // Atualizar múltiplas transações
    const handleBatchUpdateTransactions = useCallback(async (txs: Transaction[]) => {
        if (txs.length === 0) return;
        await performOperation(async () => {
            const updates = txs.map(t => ({ ...t, updatedAt: new Date().toISOString() }));
            await supabaseService.bulkCreate('transactions', updates);
        }, `${txs.length} transações atualizadas!`, { backgroundRefresh: true });
    }, [performOperation]);

    // Antecipar parcelas
    const handleAnticipateInstallments = useCallback(async (ids: string[], targetDate: string, targetAccountId?: string) => {
        await performOperation(async () => {
            const txsToUpdate = transactions.filter(t => ids.includes(t.id));
            if (txsToUpdate.length === 0) throw new Error('Nenhuma parcela encontrada para antecipar');
            if (!targetDate || targetDate.trim() === '') throw new Error('Data de antecipação inválida');
            if (targetAccountId && !accounts.find(a => a.id === targetAccountId)) throw new Error('Conta de destino não encontrada');

            const updatedTxs = txsToUpdate.map(t => ({
                ...t,
                date: targetDate,
                accountId: targetAccountId || t.accountId,
                description: t.description.includes('(Antecipada)') ? t.description : `${t.description} (Antecipada)`,
                updatedAt: new Date().toISOString()
            }));

            await supabaseService.bulkCreate('transactions', updatedTxs);
        }, 'Parcelas antecipadas com sucesso!');
    }, [transactions, accounts, performOperation]);

    return {
        handleAddTransaction,
        handleUpdateTransaction,
        handleDeleteTransaction,
        handleAddTransactions,
        handleBatchUpdateTransactions,
        handleAnticipateInstallments
    };
};
