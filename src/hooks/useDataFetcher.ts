import { useCallback, useRef, useState, useEffect } from 'react';
import { supabaseService } from '../core/services/supabaseService';
import { supabase } from '../integrations/supabase/client';
import { checkDataConsistency } from '../core/engines/financialLogic';
import { logger } from '../services/logger';

interface DataFetcherProps {
    setDataState: React.Dispatch<React.SetStateAction<any>>;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setDataInconsistencies: React.Dispatch<React.SetStateAction<string[]>>;
    isInitialized: React.MutableRefObject<boolean>;
    addToast: (message: string, type: 'success' | 'error' | 'warning') => void;
}

/**
 * Hook para gerenciamento de busca de dados
 * Extraído do useDataStore para reduzir complexidade
 */
export const useDataFetcher = ({
    setDataState,
    setIsLoading,
    setDataInconsistencies,
    isInitialized,
    addToast
}: DataFetcherProps) => {
    const loadedPeriods = useRef<Set<string>>(new Set());
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const fetchAbortController = useRef<AbortController | null>(null);

    const fetchData = useCallback(async (forceLoading = false) => {
        // Abort previous request
        if (fetchAbortController.current) {
            fetchAbortController.current.abort();
        }
        fetchAbortController.current = new AbortController();
        const signal = fetchAbortController.current.signal;

        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session || signal.aborted) {
            setIsLoading(false);
            return;
        }

        if (!isInitialized.current || forceLoading) {
            setIsLoading(true);
        }

        try {
            // Fetch accounts first (critical data)
            const accs = await supabaseService.getAccounts();
            if (signal.aborted) return;

            const initialAccountsState = accs.map(account => ({
                ...account,
                balance: account.balance ?? account.initialBalance ?? 0
            }));

            // Smart transaction loading
            const today = new Date();
            const currentPeriod = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

            if (loadedPeriods.current.size === 0) {
                const prevDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const prevPeriod = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}`;
                loadedPeriods.current.add(currentPeriod);
                loadedPeriods.current.add(prevPeriod);
            }

            const periodsToFetch = Array.from(loadedPeriods.current);
            const fetchPromises = periodsToFetch.map(period => {
                const [year, month] = period.split('-').map(Number);
                const start = `${year}-${String(month).padStart(2, '0')}-01`;
                const end = new Date(year, month, 0).toISOString().split('T')[0];
                return supabaseService.getTransactionsByRange(start, end);
            });

            const oldestLoaded = periodsToFetch.sort()[0] || currentPeriod;
            const windowsStart = `${oldestLoaded}-01`;

            // Fetch all data in parallel
            const [
                allTxsArrays,
                unsettledShared,
                trips,
                budgets,
                goals,
                familyMembers,
                assets,
                snapshots,
                customCategories
            ] = await Promise.all([
                Promise.all(fetchPromises),
                supabaseService.getUnsettledSharedTransactions(windowsStart),
                supabaseService.getTrips(),
                supabaseService.getBudgets(),
                supabaseService.getGoals(),
                supabaseService.getFamilyMembers(),
                supabaseService.getAssets(),
                supabaseService.getSnapshots(),
                supabaseService.getCustomCategories()
            ]);

            if (signal.aborted) return;

            // Process transactions
            const combined = [...allTxsArrays.flat(), ...unsettledShared];
            const uniqueTransactions = Array.from(new Map(combined.map(item => [item.id, item])).values());
            const sortedTransactions = uniqueTransactions.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

            // Update all state at once
            setDataState({
                accounts: initialAccountsState,
                transactions: sortedTransactions,
                trips,
                budgets,
                goals,
                familyMembers,
                assets,
                snapshots,
                customCategories
            });

            // Mark as initialized
            if (!isInitialized.current) {
                setIsLoading(false);
                isInitialized.current = true;
            }

            // Consistency check (debounced)
            setTimeout(() => {
                if (signal.aborted) return;
                const allTxs = allTxsArrays.flat();
                const issues = checkDataConsistency(accs, allTxs);
                setDataInconsistencies(issues);
            }, 500);

            isInitialized.current = true;
            setIsLoading(false);
        } catch (error) {
            if (signal.aborted) return;
            logger.error("Error fetching data from Supabase", error);
            addToast("Erro ao carregar dados da nuvem.", 'error');
            setIsLoading(false);
        }
    }, [setDataState, setIsLoading, setDataInconsistencies, isInitialized, addToast]);

    const ensurePeriodLoaded = useCallback(async (date: Date) => {
        const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (loadedPeriods.current.has(periodKey)) {
            return;
        }

        logger.debug(`📥 Lazy Loading History for: ${periodKey}`);
        setIsLoadingHistory(true);

        try {
            const year = date.getFullYear();
            const month = date.getMonth();
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0);

            const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            const newTxs = await supabaseService.getTransactionsByRange(startStr, endStr);

            setDataState(prev => {
                const all = [...prev.transactions, ...newTxs];
                const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
                return {
                    ...prev,
                    transactions: unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                };
            });

            loadedPeriods.current.add(periodKey);
        } catch (e) {
            logger.error("Failed to load history window", e);
            addToast('Erro ao carregar histórico antigo.', 'error');
        } finally {
            setIsLoadingHistory(false);
        }
    }, [setDataState, addToast]);

    // Initial load and subscriptions
    useEffect(() => {
        fetchData();

        // Realtime subscriptions with debounce
        let refreshTimeout: number | null = null;
        const channel = supabase.channel('global_changes')
            .on('postgres_changes', { event: '*', schema: 'public' }, (payload) => {
                logger.debug('⚡ Realtime Change Detected:', { table: payload.table });
                const relevantTables = ['transactions', 'accounts', 'trips', 'family_members', 'user_notifications'];
                if (relevantTables.includes(payload.table)) {
                    if (refreshTimeout) clearTimeout(refreshTimeout);
                    refreshTimeout = setTimeout(() => {
                        logger.info(`🔄 Auto-refreshing data due to change in: ${payload.table}`);
                        fetchData(false);
                    }, 300);
                }
            })
            .subscribe();

        // Focus revalidation
        const onFocus = () => {
            console.debug('Window Focused - Revalidating Data');
            fetchData(false);
        };
        window.addEventListener('focus', onFocus);

        return () => {
            supabase.removeChannel(channel);
            window.removeEventListener('focus', onFocus);
            if (refreshTimeout) clearTimeout(refreshTimeout);
        };
    }, [fetchData]);

    return {
        fetchData,
        ensurePeriodLoaded,
        isLoadingHistory,
        loadedPeriods
    };
};