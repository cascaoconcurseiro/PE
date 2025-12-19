/**
 * useDataStore - Hook principal de gerenciamento de dados
 * 
 * REFATORADO: Agora usa hooks modulares para melhor separação de responsabilidades
 * - useAccountStore: Gerenciamento de contas
 * - useTransactionStore: Gerenciamento de transações
 * - useTripStore: Gerenciamento de viagens
 * - useFamilyStore: Gerenciamento de membros da família
 * - useBudgetGoalStore: Gerenciamento de orçamentos e metas
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabaseService } from '../services/supabaseService';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, UserProfile, Snapshot
} from '../types';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../integrations/supabase/client';
import { checkDataConsistency } from '../services/financialLogic';
import { logger } from '../services/logger';

// Hooks modulares
import { useAccountStore } from './useAccountStore';
import { useTransactionStore } from './useTransactionStore';
import { useTripStore } from './useTripStore';
import { useFamilyStore } from './useFamilyStore';
import { useBudgetGoalStore } from './useBudgetGoalStore';

export const useDataStore = () => {
    const { addToast } = useToast();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

    const [isLoading, setIsLoading] = useState(true);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [dataInconsistencies, setDataInconsistencies] = useState<string[]>([]);
    const isInitialized = useRef(false);
    const dataReady = useRef(false);
    const fetchAbortController = useRef<AbortController | null>(null);

    // Callbacks para os hooks modulares
    const onSuccess = useCallback((message: string) => addToast(message, 'success'), [addToast]);
    const onError = useCallback((message: string) => addToast(message, 'error'), [addToast]);

    // ========== HOOKS MODULARES ==========
    const accountStore = useAccountStore({ onSuccess, onError, isOnline });
    const transactionStore = useTransactionStore({ 
        accounts: accountStore.accounts, 
        onSuccess, 
        onError, 
        isOnline 
    });
    const tripStore = useTripStore({ onSuccess, onError, isOnline });
    const familyStore = useFamilyStore({ onSuccess, onError, isOnline });
    const budgetGoalStore = useBudgetGoalStore({ onSuccess, onError, isOnline });

    // ========== NETWORK STATUS ==========
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            addToast('Você está online.', 'success');
            // Não fazer refresh automático ao voltar online para evitar loops
            // O usuário pode fazer refresh manual se necessário
        };
        const handleOffline = () => {
            setIsOnline(false);
            addToast('Você está offline. Funcionalidades limitadas.', 'warning');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [addToast]);

    // ========== FETCH DATA (TIERED LOADING) ==========
    const isFetchingRef = useRef(false);
    const fetchData = useCallback(async (forceLoading = false) => {
        // Prevenir chamadas simultâneas
        if (isFetchingRef.current) {
            return;
        }
        isFetchingRef.current = true;

        if (fetchAbortController.current) {
            fetchAbortController.current.abort();
        }
        fetchAbortController.current = new AbortController();
        const signal = fetchAbortController.current.signal;

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || signal.aborted) {
                setIsLoading(false);
                isFetchingRef.current = false;
                return;
            }

            if (!isInitialized.current || forceLoading) {
                setIsLoading(true);
            }

        try {
            // Calcular janela de tempo (3 meses)
            const today = new Date();
            const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
            const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
            const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
            const nextDate = new Date(today.getFullYear(), today.getMonth() + 1, 1);
            const nextPeriod = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, '0')}`;

            const startOfWindow = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
            const endOfWindow = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).toISOString().split('T')[0];

            // === FASE 1: DADOS CRÍTICOS ===
            const [accs, recentTxs, unsettledShared] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactionsByRange(startOfWindow, endOfWindow),
                supabaseService.getUnsettledSharedTransactions(startOfWindow)
            ]);

            if (signal.aborted) return;

            // Atualizar contas
            const accountsWithBalance = accs.map(account => ({
                ...account,
                balance: account.balance ?? account.initialBalance ?? 0
            }));
            accountStore.setAccounts(accountsWithBalance);

            // Atualizar transações
            const combined = [...recentTxs, ...unsettledShared];
            const uniqueTxs = Array.from(new Map(combined.map(item => [item.id, item])).values());
            
            transactionStore.setTransactions(prev => {
                if (!isInitialized.current || prev.length === 0) {
                    return uniqueTxs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                }
                
                const recentIds = new Set(uniqueTxs.map(t => t.id));
                const olderTxs = prev.filter(t => {
                    if (recentIds.has(t.id)) return false;
                    return t.date < startOfWindow;
                });
                
                const merged = [...olderTxs, ...uniqueTxs];
                const unique = Array.from(new Map(merged.map(item => [item.id, item])).values());
                return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            // Marcar períodos carregados
            transactionStore.loadedPeriods.current.add(currentPeriod);
            transactionStore.loadedPeriods.current.add(prevPeriod);
            transactionStore.loadedPeriods.current.add(nextPeriod);

            // Liberar tela
            dataReady.current = true;
            isInitialized.current = true;
            setIsLoading(false);

            // === FASE 2: DADOS SECUNDÁRIOS (background) ===
            Promise.all([
                supabaseService.getTrips(),
                supabaseService.getBudgets(),
                supabaseService.getGoals(),
                supabaseService.getFamilyMembers(),
                supabaseService.getAssets(),
                supabaseService.getSnapshots(),
                supabaseService.getCustomCategories()
            ]).then(([trps, bdgts, gls, fam, assts, snaps, cats]) => {
                if (signal.aborted) return;
                tripStore.setTrips(trps);
                budgetGoalStore.setBudgets(bdgts);
                budgetGoalStore.setGoals(gls);
                familyStore.setFamilyMembers(fam);
                setAssets(assts);
                setSnapshots(snaps);
                setCustomCategories(cats);
            }).catch(err => {
                logger.error("Error loading secondary data", err);
            });

            // Consistency Check (debounced)
            setTimeout(() => {
                if (signal.aborted) return;
                const issues = checkDataConsistency(accs, recentTxs);
                setDataInconsistencies(issues);
            }, 1000);
        } catch (error) {
            if (signal.aborted) return;
            logger.error("Error fetching data from Supabase", error);
            addToast("Erro ao carregar dados da nuvem.", 'error');
            setIsLoading(false);
        } finally {
            isFetchingRef.current = false;
        }
    }, [accountStore, transactionStore, tripStore, familyStore, budgetGoalStore, addToast]);

    // Initial Load - Executar apenas uma vez
    const hasInitializedRef = useRef(false);
    useEffect(() => {
        if (hasInitializedRef.current) return;
        hasInitializedRef.current = true;
        
        fetchData();
        return () => {
            if (fetchAbortController.current) {
                fetchAbortController.current.abort();
            }
        };
    }, []); // Dependências vazias para executar apenas uma vez

    // ========== ACTIONS ==========
    const refresh = () => fetchData(false);

    const handleLogin = async (userProfile: UserProfile) => {
        setUser(userProfile);
        fetchData(true);
    };

    const handleLogout = async () => {
        setUser(null);
        accountStore.setAccounts([]);
        transactionStore.setTransactions([]);
        isInitialized.current = false;
    };

    // ========== GENERIC CRUD (para entidades menores) ==========
    const performOperation = async (operation: () => Promise<void>, successMessage?: string) => {
        if (!isOnline) {
            addToast('Funcionalidade indisponível offline.', 'error');
            return;
        }
        try {
            await operation();
            if (successMessage) addToast(successMessage, 'success');
            await refresh();
        } catch (error) {
            logger.error("Operation failed", error);
            addToast((error as Error).message || 'Falha na operação', 'error');
        }
    };

    const createCrudHandlers = <T extends { id: string }>(table: string, labels: { create: string, update: string, delete: string }) => ({
        add: (item: Omit<T, 'id'>) => performOperation(async () => { 
            await supabaseService.create(table, { id: crypto.randomUUID(), ...item }); 
        }, labels.create),
        update: (item: T) => performOperation(async () => { 
            await supabaseService.update(table, item); 
        }, labels.update),
        delete: (id: string) => performOperation(async () => { 
            await supabaseService.delete(table, id); 
        }, labels.delete),
    });

    const categoriesHandler = createCrudHandlers<CustomCategory>('custom_categories', { 
        create: 'Categoria adicionada!', update: 'Categoria atualizada!', delete: 'Categoria removida.' 
    });
    const assetsHandler = createCrudHandlers<Asset>('assets', { 
        create: 'Ativo adicionado!', update: 'Ativo atualizado!', delete: 'Ativo removido.' 
    });
    const snapshotsHandler = createCrudHandlers<Snapshot>('snapshots', { 
        create: 'Snapshot salvo!', update: 'Snapshot atualizado!', delete: 'Snapshot removido.' 
    });

    // ========== HANDLERS MEMOIZADOS ==========
    const handlers = useMemo(() => ({
        // Auth
        handleLogin,
        handleLogout,

        // Transactions (do hook modular)
        handleAddTransaction: transactionStore.addTransaction,
        handleAddTransactions: transactionStore.addTransactions,
        handleUpdateTransaction: transactionStore.updateTransaction,
        handleBatchUpdateTransactions: transactionStore.batchUpdateTransactions,
        handleDeleteTransaction: transactionStore.deleteTransaction,
        handleAnticipateInstallments: async (ids: string[], targetDate: string, targetAccountId?: string) => {
            if (!isOnline) {
                addToast('Funcionalidade indisponível offline.', 'error');
                return;
            }
            try {
                const txsToUpdate = transactionStore.transactions.filter(t => ids.includes(t.id));
                if (txsToUpdate.length === 0) throw new Error('Nenhuma parcela encontrada para antecipar');
                if (!targetDate || targetDate.trim() === '') throw new Error('Data de antecipação inválida');
                if (targetAccountId && !accountStore.accounts.find(a => a.id === targetAccountId)) {
                    throw new Error('Conta de destino não encontrada');
                }

                const updatedTxs = txsToUpdate.map(t => ({
                    ...t,
                    date: targetDate,
                    accountId: targetAccountId || t.accountId,
                    description: t.description.includes('(Antecipado)') ? t.description : `${t.description} (Antecipado)`,
                    updatedAt: new Date().toISOString()
                }));

                await supabaseService.bulkCreate('transactions', updatedTxs);
                addToast('Parcelas antecipadas!', 'success');
                refresh();
            } catch (error) {
                addToast((error as Error).message, 'error');
            }
        },

        // Accounts (do hook modular)
        handleAddAccount: accountStore.addAccount,
        handleUpdateAccount: accountStore.updateAccount,
        handleDeleteAccount: accountStore.deleteAccount,

        // Trips (do hook modular)
        handleAddTrip: tripStore.addTrip,
        handleUpdateTrip: tripStore.updateTrip,
        handleDeleteTrip: async (id: string) => {
            await tripStore.deleteTrip(id, transactionStore.setTransactions);
        },

        // Family Members (do hook modular)
        handleAddMember: familyStore.addMember,
        handleUpdateMember: familyStore.updateMember,
        handleDeleteMember: async (id: string, strategy: 'CASCADE' | 'UNLINK' = 'UNLINK') => {
            await familyStore.deleteMember(
                id, 
                transactionStore.transactions, 
                transactionStore.setTransactions, 
                strategy
            );
        },

        // Budgets & Goals (do hook modular)
        handleAddBudget: budgetGoalStore.addBudget,
        handleUpdateBudget: budgetGoalStore.updateBudget,
        handleDeleteBudget: budgetGoalStore.deleteBudget,
        handleAddGoal: budgetGoalStore.addGoal,
        handleUpdateGoal: budgetGoalStore.updateGoal,
        handleDeleteGoal: budgetGoalStore.deleteGoal,

        // Categories, Assets, Snapshots
        handleAddCategory: async (name: string) => categoriesHandler.add({ name }),
        handleDeleteCategory: categoriesHandler.delete,
        handleAddAsset: assetsHandler.add,
        handleUpdateAsset: assetsHandler.update,
        handleDeleteAsset: assetsHandler.delete,
        handleAddSnapshot: snapshotsHandler.add,

        // Utilities
        ensurePeriodLoaded: transactionStore.ensurePeriodLoaded,
        checkConsistency: () => {
            const issues = checkDataConsistency(accountStore.accounts, transactionStore.transactions);
            setDataInconsistencies(issues);
        },

        // Factory Reset
        handleFactoryReset: async (unlinkFamily: boolean = false) => {
            if (!isOnline) {
                addToast('Funcionalidade indisponível offline.', 'error');
                return;
            }
            try {
                await supabaseService.performSmartReset(unlinkFamily);
                accountStore.setAccounts([]);
                transactionStore.setTransactions([]);
                if (unlinkFamily) {
                    tripStore.setTrips([]);
                    familyStore.setFamilyMembers([]);
                }
                budgetGoalStore.setBudgets([]);
                budgetGoalStore.setGoals([]);
                setAssets([]);
                setSnapshots([]);
                setCustomCategories([]);
                addToast('Sistema restaurado para o padrão de fábrica.', 'success');
                window.location.reload();
            } catch (error) {
                addToast((error as Error).message || 'Erro ao resetar sistema', 'error');
            }
        },
    }), [
        isOnline, addToast, refresh,
        accountStore, transactionStore, tripStore, familyStore, budgetGoalStore,
        categoriesHandler, assetsHandler, snapshotsHandler
    ]);

    return {
        // State
        user,
        accounts: accountStore.accounts,
        transactions: transactionStore.transactions,
        trips: tripStore.trips,
        budgets: budgetGoalStore.budgets,
        goals: budgetGoalStore.goals,
        familyMembers: familyStore.familyMembers,
        assets,
        snapshots,
        customCategories,
        
        // Loading states
        isLoading,
        isLoadingHistory,
        isOnline,
        dataInconsistencies,
        
        // Actions
        ensurePeriodLoaded: transactionStore.ensurePeriodLoaded,
        handlers
    };
};
