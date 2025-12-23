import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabaseService } from '../core/services/supabaseService';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, UserProfile, Snapshot, TransactionType, Category
} from '../types';
import { parseDate } from '../utils';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../integrations/supabase/client';
import { processRecurringTransactions } from '../core/engines/recurrenceEngine';
import { checkDataConsistency } from '../core/engines/financialLogic';
import { translateErrorMessage } from '../utils/errorMapping';
import { logger } from '../services/logger';

// Hooks auxiliares extraídos
import { useNetworkStatus } from './useNetworkStatus';
import { useDataFetcher } from './useDataFetcher';
import { useTransactionOperations } from './useTransactionOperations';
import { useCrudOperations } from './useCrudOperations';

/**
 * Hook principal de gerenciamento de dados - versão refatorada
 * Reduzido de 821 linhas para ~500 linhas através de:
 * - Extração de hooks especializados
 * - Consolidação de operações CRUD
 * - Simplificação de lógica repetitiva
 * - Uso de abstrações genéricas
 */
export const useDataStore = () => {
    const { addToast } = useToast();
    
    // Estados principais consolidados
    const [user, setUser] = useState<UserProfile | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [dataInconsistencies, setDataInconsistencies] = useState<string[]>([]);
    const isInitialized = useRef(false);

    // Estados de dados usando padrão consolidado
    const [dataState, setDataState] = useState({
        accounts: [] as Account[],
        transactions: [] as Transaction[],
        trips: [] as Trip[],
        budgets: [] as Budget[],
        goals: [] as Goal[],
        familyMembers: [] as FamilyMember[],
        assets: [] as Asset[],
        snapshots: [] as Snapshot[],
        customCategories: [] as CustomCategory[]
    });

    // Hooks auxiliares
    const { isOnline } = useNetworkStatus();
    const { 
        fetchData, 
        ensurePeriodLoaded, 
        isLoadingHistory,
        loadedPeriods 
    } = useDataFetcher({
        setDataState,
        setIsLoading,
        setDataInconsistencies,
        isInitialized,
        addToast
    });

    // Wrapper genérico para operações
    const performOperation = useCallback(async (
        operation: () => Promise<void>, 
        successMessage?: string, 
        options: { backgroundRefresh?: boolean } = {}
    ) => {
        if (!isOnline) {
            addToast('Funcionalidade indisponível offline.', 'error');
            return;
        }

        try {
            await operation();
            if (successMessage) addToast(successMessage, 'success');

            if (options.backgroundRefresh) {
                fetchData(false);
            } else {
                await fetchData(false);
            }
        } catch (error) {
            logger.error("Operation failed", error);
            const err = error as Error;
            const userFriendlyMessage = translateErrorMessage(err.message || 'Falha na operação');
            addToast(userFriendlyMessage, 'error');
        }
    }, [isOnline, addToast, fetchData]);

    // Operações de transação usando hook especializado
    const transactionOps = useTransactionOperations({
        accounts: dataState.accounts,
        transactions: dataState.transactions,
        setTransactions: (updater) => setDataState(prev => ({
            ...prev,
            transactions: typeof updater === 'function' ? updater(prev.transactions) : updater
        })),
        performOperation
    });

    // Operações CRUD genéricas
    const crudOps = useCrudOperations({
        performOperation,
        setDataState
    });

    // Processamento de recorrências
    useEffect(() => {
        if (!dataState.transactions.length || !isInitialized.current) return;

        const { newTransactions, updatedTransactions } = processRecurringTransactions(dataState.transactions);

        if (newTransactions.length > 0) {
            console.log('🔄 Generating Recurring Transactions:', newTransactions.length);
            transactionOps.handleAddTransactions(newTransactions);
        }

        if (updatedTransactions.length > 0) {
            console.log('🔄 Updating Recurrence Parents:', updatedTransactions.length);
            transactionOps.handleBatchUpdateTransactions(updatedTransactions);
        }
    }, [dataState.transactions, transactionOps]);

    // Handlers de autenticação
    const handleLogin = useCallback(async (userProfile: UserProfile) => {
        setUser(userProfile);
        fetchData(true);
    }, [fetchData]);

    const handleLogout = useCallback(async () => {
        setUser(null);
        setDataState({
            accounts: [],
            transactions: [],
            trips: [],
            budgets: [],
            goals: [],
            familyMembers: [],
            assets: [],
            snapshots: [],
            customCategories: []
        });
        isInitialized.current = false;
    }, []);

    // Handler de conta com lógica de saldo inicial
    const handleAddAccount = useCallback(async (acc: Partial<Account> & { initialBalance?: number }) => {
        await performOperation(async () => {
            const accountId = crypto.randomUUID();
            const initialAmount = acc.initialBalance || 0;

            if (!acc.name?.trim()) throw new Error('Nome da conta é obrigatório');

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
                    category: Category.OPENING_BALANCE || Category.INCOME,
                    accountId: accountId,
                    isSettled: true,
                    domain: 'PERSONAL'
                });
            }
        }, 'Conta criada!');
    }, [performOperation]);

    // Handler de delete de viagem com cascata
    const handleDeleteTrip = useCallback(async (id: string) => {
        await performOperation(async () => {
            await supabaseService.deleteTripCascade(id);
            // Atualização otimista
            setDataState(prev => ({
                ...prev,
                trips: prev.trips.filter(t => t.id !== id),
                transactions: prev.transactions.filter(t => t.tripId !== id)
            }));
        }, 'Viagem e despesas excluídas.');
    }, [performOperation]);

    // Handler de delete de membro com estratégias
    const handleDeleteMember = useCallback(async (id: string, strategy: 'CASCADE' | 'UNLINK' = 'UNLINK') => {
        await performOperation(async () => {
            const payerTxs = dataState.transactions.filter(t => t.payerId === id);
            const sharedTxs = dataState.transactions.filter(t => t.sharedWith?.some(s => s.memberId === id));

            // Processar transações do pagador
            if (payerTxs.length > 0) {
                if (strategy === 'CASCADE') {
                    const idsToDelete = payerTxs.map(t => t.id);
                    await supabaseService.bulkDelete('transactions', idsToDelete);
                } else {
                    const updates = payerTxs.map(t => ({ ...t, payerId: 'me', updatedAt: new Date().toISOString() }));
                    await supabaseService.bulkCreate('transactions', updates);
                }
            }

            // Processar transações compartilhadas
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
            }

            await supabaseService.delete('family_members', id);
        }, 'Membro removido e vínculos processados.');
    }, [performOperation, dataState.transactions]);

    // Factory reset
    const handleFactoryReset = useCallback(async (unlinkFamily: boolean = false) => {
        await performOperation(async () => {
            await supabaseService.performSmartReset(unlinkFamily);
            setDataState(prev => ({
                ...prev,
                accounts: [],
                transactions: [],
                trips: unlinkFamily ? [] : prev.trips,
                familyMembers: unlinkFamily ? [] : prev.familyMembers,
                budgets: [],
                goals: [],
                assets: [],
                snapshots: [],
                customCategories: []
            }));
        }, 'Sistema restaurado para o padrão de fábrica.');
    }, [performOperation]);

    // Consolidação de handlers usando memoização
    const handlers = useMemo(() => ({
        // Autenticação
        handleLogin,
        handleLogout,

        // Transações
        ...transactionOps,

        // Contas
        handleAddAccount,
        handleUpdateAccount: (acc: Account) => crudOps.update('accounts', acc, 'Conta atualizada!'),
        handleDeleteAccount: (id: string) => performOperation(
            () => supabaseService.softDeleteAccount(id), 
            'Conta excluída com sucesso.'
        ),

        // Viagens
        handleAddTrip: (trip: Omit<Trip, 'id'>) => crudOps.create('trips', trip, 'Viagem criada!'),
        handleUpdateTrip: (trip: Trip) => crudOps.update('trips', trip, 'Viagem atualizada!'),
        handleDeleteTrip,

        // Membros da família
        handleAddMember: (member: Omit<FamilyMember, 'id'>) => crudOps.create('family_members', member, 'Membro adicionado!'),
        handleUpdateMember: (member: FamilyMember) => crudOps.update('family_members', member, 'Membro atualizado!'),
        handleDeleteMember,

        // Categorias
        handleAddCategory: (name: string) => crudOps.create('custom_categories', { name }, 'Categoria adicionada!'),
        handleDeleteCategory: (id: string) => crudOps.delete('custom_categories', id, 'Categoria removida.'),

        // Orçamentos
        handleAddBudget: (budget: Omit<Budget, 'id'>) => crudOps.create('budgets', budget, 'Orçamento salvo!'),
        handleUpdateBudget: (budget: Budget) => crudOps.update('budgets', budget, 'Orçamento atualizado!'),
        handleDeleteBudget: (id: string) => crudOps.delete('budgets', id, 'Orçamento removido.'),

        // Metas
        handleAddGoal: (goal: Omit<Goal, 'id'>) => crudOps.create('goals', goal, 'Meta criada!'),
        handleUpdateGoal: (goal: Goal) => crudOps.update('goals', goal, 'Meta atualizada!'),
        handleDeleteGoal: (id: string) => crudOps.delete('goals', id, 'Meta excluída.'),

        // Ativos
        handleAddAsset: (asset: Omit<Asset, 'id'>) => crudOps.create('assets', asset, 'Ativo adicionado!'),
        handleUpdateAsset: (asset: Asset) => crudOps.update('assets', asset, 'Ativo atualizado!'),
        handleDeleteAsset: (id: string) => crudOps.delete('assets', id, 'Ativo removido.'),

        // Snapshots
        handleAddSnapshot: (snapshot: Omit<Snapshot, 'id'>) => crudOps.create('snapshots', snapshot, 'Snapshot salvo!'),

        // Utilitários
        ensurePeriodLoaded,
        checkConsistency: () => {
            const issues = checkDataConsistency(dataState.accounts, dataState.transactions);
            setDataInconsistencies(issues);
        },
        handleFactoryReset
    }), [
        handleLogin,
        handleLogout,
        transactionOps,
        handleAddAccount,
        crudOps,
        performOperation,
        handleDeleteTrip,
        handleDeleteMember,
        ensurePeriodLoaded,
        dataState.accounts,
        dataState.transactions,
        handleFactoryReset
    ]);

    return {
        // Estados
        user,
        ...dataState,
        isLoading,
        dataInconsistencies,
        isOnline,
        isLoadingHistory,

        // Utilitários
        ensurePeriodLoaded,
        handlers
    };
};