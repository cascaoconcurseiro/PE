/**
 * Hook para gerenciamento de contas
 * Extraído do useDataStore para melhor separação de responsabilidades
 */

import { useState, useCallback } from 'react';
import { Account, TransactionType, Category } from '../types';
import { supabaseService } from '../core/services/supabaseService';
import { logger } from '../services/logger';

interface UseAccountStoreProps {
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
    isOnline: boolean;
}

export const useAccountStore = ({ onSuccess, onError, isOnline }: UseAccountStoreProps) => {
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchAccounts = useCallback(async () => {
        try {
            const accs = await supabaseService.getAccounts();
            const accountsWithBalance = accs.map(account => ({
                ...account,
                balance: account.balance ?? account.initialBalance ?? 0
            }));
            setAccounts(accountsWithBalance);
            return accountsWithBalance;
        } catch (error) {
            logger.error('Erro ao carregar contas', error);
            throw error;
        }
    }, []);

    const addAccount = useCallback(async (acc: Partial<Account> & { initialBalance?: number }) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            const accountId = crypto.randomUUID();
            const initialAmount = acc.initialBalance || 0;

            if (!acc.name || acc.name.trim() === '') {
                throw new Error('Nome da conta é obrigatório');
            }

            const accountToCreate = {
                ...acc,
                id: accountId,
                initialBalance: 0,
                balance: 0
            };

            await supabaseService.create('accounts', accountToCreate);

            // Criar transação de saldo inicial se necessário
            if (Math.abs(initialAmount) > 0) {
                const now = new Date();
                const isPositive = initialAmount >= 0;
                const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

                await supabaseService.createTransactionWithValidation({
                    amount: Math.abs(initialAmount),
                    date: dateStr,
                    description: 'Saldo Inicial',
                    type: isPositive ? TransactionType.INCOME : TransactionType.EXPENSE,
                    category: Category.OPENING_BALANCE,
                    accountId: accountId,
                    isSettled: true,
                    domain: 'PERSONAL'
                });
            }

            // Atualizar estado local
            const newAccount: Account = {
                ...accountToCreate,
                balance: initialAmount,
                currency: acc.currency || 'BRL',
                type: acc.type!,
                name: acc.name!
            } as Account;

            setAccounts(prev => [...prev, newAccount]);
            onSuccess('Conta criada!');
        } catch (error) {
            logger.error('Erro ao criar conta', error);
            onError((error as Error).message || 'Erro ao criar conta');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const updateAccount = useCallback(async (acc: Account) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.update('accounts', acc);
            setAccounts(prev => prev.map(a => a.id === acc.id ? acc : a));
            onSuccess('Conta atualizada!');
        } catch (error) {
            logger.error('Erro ao atualizar conta', error);
            onError((error as Error).message || 'Erro ao atualizar conta');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    const deleteAccount = useCallback(async (id: string) => {
        if (!isOnline) {
            onError('Funcionalidade indisponível offline.');
            return;
        }

        try {
            setIsLoading(true);
            await supabaseService.softDeleteAccount(id);
            setAccounts(prev => prev.filter(a => a.id !== id));
            onSuccess('Conta excluída com sucesso.');
        } catch (error) {
            logger.error('Erro ao excluir conta', error);
            onError((error as Error).message || 'Erro ao excluir conta');
        } finally {
            setIsLoading(false);
        }
    }, [isOnline, onSuccess, onError]);

    return {
        accounts,
        setAccounts,
        isLoading,
        fetchAccounts,
        addAccount,
        updateAccount,
        deleteAccount
    };
};
