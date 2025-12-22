import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { supabaseService } from '../core/services/supabaseService';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, SyncStatus, UserProfile, Snapshot, TransactionType, Category
} from '../types';
import { parseDate } from '../utils';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../integrations/supabase/client';
import { processRecurringTransactions } from '../core/engines/recurrenceEngine';
import { checkDataConsistency } from '../core/engines/financialLogic';
import { translateErrorMessage } from '../utils/errorMapping';
import { logger } from '../services/logger';



export const useDataStore = () => {
    const { addToast } = useToast();
    const [isOnline, setIsOnline] = useState(navigator.onLine);
    const [user, setUser] = useState<UserProfile | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>([]);

    // TIME-WINDOW SYNC STATE
    const loadedPeriods = useRef<Set<string>>(new Set());
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);

    const [isLoading, setIsLoading] = useState(true);
    const [dataInconsistencies, setDataInconsistencies] = useState<string[]>([]);
    const isInitialized = useRef(false);

    // Wrapper for async operations to handle errors
    const performOperation = async (operation: () => Promise<void>, successMessage?: string, options: { backgroundRefresh?: boolean } = {}) => {
        if (!isOnline) {
            addToast('Funcionalidade indisponível offline.', 'error');
            return;
        }

        try {
            await operation();
            if (successMessage) addToast(successMessage, 'success');

            if (options.backgroundRefresh) {
                // Fire and forget refresh to not block UI
                refresh();
            } else {
                await refresh();
            }
        } catch (error) {
            logger.error("Operation failed", error);
            const err = error as Error;
            const userFriendlyMessage = translateErrorMessage(err.message || 'Falha na operação');
            addToast(userFriendlyMessage, 'error');
        }
    };

    // Network Status Listener
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            addToast('Você está online.', 'success');
            refresh(); // Refresh when back online
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
    }, []);

    // Validation Logic
    const validateTransaction = (tx: Partial<Transaction>) => {
        if (!tx.amount || tx.amount <= 0) throw new Error('Valor da transação inválido.');
        if (!tx.description?.trim()) throw new Error('Descrição obrigatória.');
        if (!tx.date) throw new Error('Data obrigatória.');

        // STRICT Double Entry Check for Transfers
        if (tx.type === TransactionType.TRANSFER) {
            if (!tx.accountId) throw new Error('Conta de origem obrigatória para transferência.');
            if (!tx.destinationAccountId) throw new Error('Conta de destino obrigatória para transferência.');
            if (tx.accountId === tx.destinationAccountId) throw new Error('Origem e destino não podem ser iguais.');

            // Validate existence
            const sourceExists = accounts.find(a => a.id === tx.accountId);
            const destExists = accounts.find(a => a.id === tx.destinationAccountId);
            if (!sourceExists) throw new Error('Conta de origem não encontrada.');
            if (!destExists) throw new Error('Conta de destino não encontrada.');
        } else {
            // Expenses/Income must have at least one account (unless it's a shared pending request that implies external payment? 
            // - Assuming standard transactions here. Shared logic handles payerId scenarios differently, 
            // but usually eventually assigns an account or marks as debt.
            // Let's enforce accountId for normal Income/Expense unless it's strictly external.)
            // UPDATE: Shared Installments Import creates "Pending" items without account. We must allow this.
            if (!tx.accountId && (!tx.payerId || tx.payerId === 'me') && !tx.isShared) {
                throw new Error('Conta é obrigatória.');
            }
        }
    };

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'> & { id?: string }) => {
        validateTransaction(newTx);

        // Prepare logic (Generate Installments vs Single)
        // We separate calculation from execution to support offline queuing
        const generateTransactions = (): Transaction[] => {
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
                        id: crypto.randomUUID(), // Installments get new IDs
                        date: formattedDate,
                        amount: currentAmount,
                        description: `${newTx.description} (${i + 1}/${totalInstallments})`,
                        currentInstallment: i + 1,
                        totalInstallments: totalInstallments,
                        seriesId: seriesId,
                        sharedWith: currentSharedWith,
                        isRecurring: false,
                        isSettled: false, // Default isSettled
                        createdAt: now,
                        updatedAt: now,
                        type: newTx.type,
                        category: newTx.category
                    } as Transaction);
                }
            } else {
                txs.push({
                    ...newTx,
                    id: newTx.id || crypto.randomUUID(), // USE PROVIDED ID IF AVAILABLE
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
        };

        // Online execution using normal flow
        await performOperation(async () => {
            const txsToCreate = generateTransactions();

            // Sequential insert to ensure validation (Backend-Centric)
            // We iterate and call the validated RPC for each item.
            for (const tx of txsToCreate) {
                // Ensure ID is passed if generated (though RPC might generate one if disregarded, but we want to key it)
                // Actually the RPC returns the ID. If we provided one in the object, the RPC doesn't use it in my current SQL implementation!
                // CHECK MIGRATION: 20260123_rpc_enhanced.sql -> "INSERT INTO ... VALUES ..." -> It does NOT take p_id.
                // It returns a new UUID.

                // CRITICAL: The frontend generates Series ID and IDs for linking.
                // If RPC ignores my ID, I lose the ability to link series/installments properly IF the series_id relies on a specific ID.
                // SeriesID is a UUID generated by frontend: "const seriesId = crypto.randomUUID();"
                // That is passed as p_series_id. That works.
                // But the primary key ID of the transaction is generated by the DB "v_new_id UUID".

                // So, frontend-generated IDs for individual transactions are IGNORED.
                // This potentially breaks "optimistic updates" if the UI relies on that specific ID.
                // However, `useDataStore` usually refreshes data after operation.
                // AND: `handleAddTransaction` itself does NOT return the new ID to the caller.
                // The caller (TransactionForm) just waits for void promise.

                // So, ignoring the frontend ID is acceptable for creation.
                // But we must make sure `series_id` (which links them) is preserved.
                // `seriesId` is passed as `p_series_id`, so that is fine.

                const newId = await supabaseService.createTransactionWithValidation(tx);

                // ✅ FIX: SYNC ID.
                // We must update our local state's optimistic transaction to have the REAL ID.
                // Otherwise editing it immediately will fail or create dupes.
                // Since this is inside a loop (for Installments), we handle each.
                if (newId && typeof newId === 'string') {
                    setTransactions(prev => prev.map(t =>
                        t.id === tx.id ? { ...t, id: newId } : t // Replace temp ID with Real ID
                    ));
                }
            }
        }, 'Transação adicionada com sucesso!');
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        validateTransaction(updatedTx);

        await performOperation(async () => {
            // CHECK FOR SERIES REGENERATION (Change in Total Installments)
            const originalTx = transactions.find(t => t.id === updatedTx.id);
            if (updatedTx.seriesId && originalTx && updatedTx.totalInstallments !== originalTx.totalInstallments) {
                // 1. Validation: Check if any installment is settled
                const seriesTxs = transactions.filter(t => t.seriesId === updatedTx.seriesId);
                const hasPaid = seriesTxs.some(t => t.isSettled || (t.sharedWith?.some(s => s.isSettled)));
                if (hasPaid) {
                    throw new Error('Não é possível alterar o número de parcelas de uma série com pagamentos já realizados.');
                }

                // 1.5 Safety: Block resizing if Shared (too complex to regenerate splits on the fly without dedicated UI)
                const isSharedSeries = seriesTxs.some(t => t.isShared || (t.sharedWith && t.sharedWith.length > 0));
                if (isSharedSeries) {
                    throw new Error('Por segurança, não é permitido alterar o número de parcelas de uma compra compartilhada. Exclua e crie novamente.');
                }

                // 2. GENERATE NEW SERIES DATA (In Memory)
                // We need to regenerate the proper dates and installments
                const firstOldTx = seriesTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                const baseDate = parseDate(firstOldTx ? firstOldTx.date : updatedTx.date);
                const totalInstallments = Number(updatedTx.totalInstallments);
                const baseInstallmentValue = Math.floor((updatedTx.amount / totalInstallments) * 100) / 100;
                let accumulatedAmount = 0;

                const newSeriesTxs: Partial<Transaction>[] = [];
                const now = new Date().toISOString();

                for (let i = 0; i < totalInstallments; i++) {
                    // Date Calc Logic (Same as Add)
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

                    // Shared Logic omitted for brevity in regeneration for now if complex, 
                    // assuming simple split recalculation or carrying over sharedWith if needed?
                    // If simply resizing, we should probably clear complex splits or recalculate proportionally.
                    // For now, let's keep it simple: Use the updatedTx sharedWith logic if present.
                    // (Assuming basic uniform split logic for regeneration to avoid complexity overload in this snippet).
                    // If updatedTx has sharedWith, we apply it proportionally.

                    newSeriesTxs.push({
                        ...updatedTx, // Base props
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

                // 3. ATOMIC SWAP
                await supabaseService.recreateTransactionSeries(updatedTx.seriesId, newSeriesTxs);
                return;
            }

            // Standard Update
            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
        }, 'Transação atualizada!');
    };

    // --- FETCH DATA FROM SUPABASE (TIERED LOADING STRATEGY) ---
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
            // --- TIER 1: CRITICAL DATA (Dashboard Immediate Render) ---
            // ✅ REESTRUTURAÇÃO: Backend é fonte de verdade - usar balance do banco diretamente
            console.time("Tier1_Accounts");
            const accs = await supabaseService.getAccounts();
            if (signal.aborted) return;

            // Backend já calcula balance via trigger, usar diretamente
            // Se balance for null, usar initialBalance como fallback
            const initialAccountsState = accs.map(account => ({
                ...account,
                balance: account.balance ?? account.initialBalance ?? 0
            }));
            setAccounts(initialAccountsState);
            // Performance tracking removed


            // --- TIER 1.5: TRANSACTIONS (SMART WINDOW) ---
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

            const [allTxsArrays, unsettledShared] = await Promise.all([
                Promise.all(fetchPromises),
                supabaseService.getUnsettledSharedTransactions(windowsStart)
            ]);

            if (signal.aborted) return;

            setTransactions(prev => {
                const combined = [...allTxsArrays.flat(), ...unsettledShared];
                const unique = Array.from(new Map(combined.map(item => [item.id, item])).values());
                return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            // Performance tracking removed

            // --- TIER 2: METADATA & CONFIG (Lazy-load safe) ---
            // Performance tracking removed

            const [
                trps, bdgts, gls, fam, assts, snaps, cats
            ] = await Promise.all([
                supabaseService.getTrips(),
                supabaseService.getBudgets(),
                supabaseService.getGoals(),
                supabaseService.getFamilyMembers(),
                supabaseService.getAssets(),
                supabaseService.getSnapshots(),
                supabaseService.getCustomCategories()
            ]);

            if (signal.aborted) return;

            setTrips(trps);
            setBudgets(bdgts);
            setGoals(gls);
            setFamilyMembers(fam);
            setAssets(assts);
            setSnapshots(snaps);
            setCustomCategories(cats);

            // Performance tracking removed

            // ✅ REESTRUTURAÇÃO: Garantir que isLoading só vira false quando TUDO está pronto
            // Isso previne flicker - UI só renderiza quando todos os dados estão carregados
            if (!isInitialized.current) {
                setIsLoading(false);
                isInitialized.current = true;
            }

            // ✅ REESTRUTURAÇÃO: Consistency Check (Debounced) - não bloqueia renderização
            setTimeout(() => {
                if (signal.aborted) return;
                const allTxs = allTxsArrays.flat();
                const issues = checkDataConsistency(accs, allTxs);
                setDataInconsistencies(issues);
            }, 500);

            // ✅ REESTRUTURAÇÃO: Garantir que isLoading só vira false quando TUDO está carregado
            // Isso previne flicker - UI só renderiza quando dados estão prontos
            isInitialized.current = true;
            setIsLoading(false);
        } catch (error) {
            if (signal.aborted) return;
            logger.error("Error fetching data from Supabase", error);
            addToast("Erro ao carregar dados da nuvem.", 'error');
            setIsLoading(false);
        }
    }, [loadedPeriods]); // Depend on loadedPeriods? No, fetchData replaces init. But ensurePeriodLoaded uses it.

    // Initial Load
    useEffect(() => {
        fetchData();

        // --- REALTIME SUBSCRIPTIONS (OTIMIZADO) ---
        // ✅ REESTRUTURAÇÃO: Debounce para evitar múltiplos refreshes
        let refreshTimeout: number | null = null;
        const channel = supabase.channel('global_changes')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public' },
                (payload) => {
                    logger.debug('⚡ Realtime Change Detected:', { table: payload.table });
                    const relevantTables = ['transactions', 'accounts', 'trips', 'family_members', 'user_notifications'];
                    if (relevantTables.includes(payload.table)) {
                        if (refreshTimeout) clearTimeout(refreshTimeout);
                        refreshTimeout = setTimeout(() => {
                            logger.info(`🔄 Auto-refreshing data due to change in: ${payload.table}`);
                            fetchData(false);
                        }, 300);
                    }
                }
            )
            .subscribe();

        // --- FOCUS REVALIDATION ---
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

    // RECURRENCE ENGINE PROCESSING
    useEffect(() => {
        if (!transactions || transactions.length === 0 || !isInitialized.current) return;

        const { newTransactions, updatedTransactions } = processRecurringTransactions(transactions);

        if (newTransactions.length > 0) {
            console.log('🔄 Generating Recurring Transactions:', newTransactions.length);
            // Auto-Add found recurrences
            handlers.handleAddTransactions(newTransactions);
            // Type cast needed if handleAddTransactions expects specific Omit type vs recurrence result
        }

        if (updatedTransactions.length > 0) {
            console.log('🔄 Updating Recurrence Parents:', updatedTransactions.length);
            // We need to batch update these parents (lastGenerated field)
            handlers.handleBatchUpdateTransactions(updatedTransactions);
        }

        // Note: handleAddTransactions and handleBatchUpdateTransactions update local state optimistically, 
        // which triggers this effect again.
        // BUT processRecurringTransactions is deterministic. 
        // If 'lastGenerated' was updated in local state, it won't yield results again.
        // So loop terminates.
    }, [transactions]); // Depend on transactions safe? Yes, due to logic above.

    // --- ACTIONS ---

    const handleLogin = async (userProfile: UserProfile) => {
        setUser(userProfile);
        fetchData(true);
    };

    const handleLogout = async () => {
        setUser(null);
        setAccounts([]);
        setTransactions([]);
        isInitialized.current = false;
    };

    const refresh = () => fetchData(false);

    const handleDeleteTransaction = async (id: string, deleteScope: 'SINGLE' | 'SERIES' = 'SINGLE') => {
        const txToDelete = transactions.find(t => t.id === id);
        if (!txToDelete) return; // Should not happen

        // Optimistic Update for Series
        if (deleteScope === 'SERIES' && txToDelete.seriesId) {
            // Remove instantaneamente da UI todas da mesma série
            setTransactions(prev => prev.filter(t => t.seriesId !== txToDelete.seriesId));
        } else {
            // Remove instantaneamente da UI a única
            setTransactions(prev => prev.filter(t => t.id !== id));
        }

        await performOperation(async () => {
            if (deleteScope === 'SERIES') {
                if (txToDelete.seriesId) {
                    await supabaseService.deleteTransactionSeries(txToDelete.seriesId);
                } else {
                    // Fallback: If no seriesId, delete just this one (or handle cascade if we implement logic for it later)
                    await supabaseService.update('transactions', { ...txToDelete, deleted: true, updatedAt: new Date().toISOString() });
                }
            } else {
                await supabaseService.update('transactions', { ...txToDelete, deleted: true, updatedAt: new Date().toISOString() });
            }
        }, deleteScope === 'SERIES' ? 'Série excluída.' : 'Transação excluída.', { backgroundRefresh: true });
    };

    const handleAddTransactions = async (newTxs: (Omit<Transaction, 'id'> & { id?: string })[]) => {
        const txsToCreate = newTxs.map(tx => ({
            ...tx,
            id: tx.id || crypto.randomUUID(),
            isSettled: tx.isSettled ?? false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        })) as Transaction[];

        // Optimistic Update: Add immediately to UI
        setTransactions(prev => [...prev, ...txsToCreate]);

        await performOperation(async () => {
            // SEQUENTIAL RPC CALLS for Validation
            for (const tx of txsToCreate) {
                const newId = await supabaseService.createTransactionWithValidation(tx);
                // ✅ FIX: SYNC ID in Batch
                if (newId && typeof newId === 'string') {
                    setTransactions(prev => prev.map(t =>
                        t.id === tx.id ? { ...t, id: newId } : t
                    ));
                }
            }
        }, `${newTxs.length} transações adicionadas!`);
    };

    const handleBatchUpdateTransactions = async (txs: Transaction[]) => {
        if (txs.length === 0) return;
        await performOperation(async () => {
            const updates = txs.map(t => ({ ...t, updatedAt: new Date().toISOString() }));
            await supabaseService.bulkCreate('transactions', updates); // bulkCreate uses upsert
        }, `${txs.length} transações atualizadas!`, { backgroundRefresh: true });
    };

    const handleAnticipateInstallments = async (ids: string[], targetDate: string, targetAccountId?: string) => {
        await performOperation(async () => {
            const txsToUpdate = transactions.filter(t => ids.includes(t.id));
            if (txsToUpdate.length === 0) throw new Error('Nenhuma parcela encontrada para antecipar');
            if (!targetDate || targetDate.trim() === '') throw new Error('Data de antecipação inválida');
            if (targetAccountId && !accounts.find(a => a.id === targetAccountId)) throw new Error('Conta de destino não encontrada');

            const updatedTxs = txsToUpdate.map(t => ({
                ...t,
                date: targetDate,
                accountId: targetAccountId || t.accountId,
                description: t.description.includes('(Antecipado)') ? t.description : `${t.description} (Antecipado)`,
                updatedAt: new Date().toISOString()
            }));

            await supabaseService.bulkCreate('transactions', updatedTxs);
        }, 'Parcelas antecipadas!', { backgroundRefresh: true });
    };

    // --- GENERIC CRUD FACTORY ---
    const createCrudHandlers = <T extends { id: string }>(table: string, labels: { create: string, update: string, delete: string }) => {
        return {
            add: (item: Omit<T, 'id'>) => performOperation(async () => { await supabaseService.create(table, { id: crypto.randomUUID(), ...item }); }, labels.create),
            update: (item: T) => performOperation(async () => { await supabaseService.update(table, item); }, labels.update),
            delete: (id: string) => performOperation(async () => { await supabaseService.delete(table, id); }, labels.delete),
        };
    };

    // --- HANDLERS ---

    // Account Handlers
    const handleAddAccount = async (acc: Partial<Account> & { initialBalance?: number }) => performOperation(async () => {
        const accountId = crypto.randomUUID();
        const initialAmount = acc.initialBalance || 0;

        if (!acc.name || acc.name.trim() === '') throw new Error('Nome da conta é obrigatório');

        const accountToCreate = {
            ...acc,
            id: accountId,
            initialBalance: 0,
            balance: 0
        };

        await supabaseService.create('accounts', accountToCreate);

        if (Math.abs(initialAmount) > 0) {
            const now = new Date();
            const isPositive = initialAmount >= 0;
            const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

            await supabaseService.createTransactionWithValidation({
                amount: Math.abs(initialAmount),
                date: dateStr,
                description: 'Saldo Inicial',
                type: isPositive ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: Category.OPENING_BALANCE || Category.INCOME, // Use defined category
                accountId: accountId,
                isSettled: true,
                domain: 'PERSONAL' // Explicit domain
            });
        }
    }, 'Conta criada!');

    const handleUpdateAccount = async (acc: Account) => performOperation(async () => { await supabaseService.update('accounts', acc); }, 'Conta atualizada!');

    const handleDeleteAccount = async (id: string) => performOperation(async () => {
        await supabaseService.softDeleteAccount(id);
    }, 'Conta excluída com sucesso.');

    // PHASE 5: SMART HYDRATION (LAZY LOADING)
    const ensurePeriodLoaded = useCallback(async (date: Date) => {
        if (!isOnline) return;

        const periodKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (loadedPeriods.current.has(periodKey)) {
            // Already loaded, skip
            return;
        }

        logger.debug(`📥 Lazy Loading History for: ${periodKey}`);
        setIsLoadingHistory(true);

        try {
            // Calculate Range: Start to End of requested month
            const year = date.getFullYear();
            const month = date.getMonth();
            const start = new Date(year, month, 1);
            const end = new Date(year, month + 1, 0); // Last day of month

            const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-01`;
            const endStr = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;

            const newTxs = await supabaseService.getTransactionsByRange(startStr, endStr);

            setTransactions(prev => {
                const all = [...prev, ...newTxs];
                // Deduplicate by ID
                const unique = Array.from(new Map(all.map(item => [item.id, item])).values());
                return unique.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            // Mark as loaded
            loadedPeriods.current.add(periodKey);

        } catch (e) {
            logger.error("Failed to load history window", e);
            addToast('Erro ao carregar histórico antigo.', 'error');
        } finally {
            setIsLoadingHistory(false);
        }
    }, [isOnline]);

    // Generated Handlers
    const tripsHandler = createCrudHandlers<Trip>('trips', { create: 'Viagem criada!', update: 'Viagem atualizada!', delete: 'Viagem excluída.' });
    const membersHandler = createCrudHandlers<FamilyMember>('family_members', { create: 'Membro adicionado!', update: 'Membro atualizado!', delete: 'Membro removido.' });
    const categoriesHandler = createCrudHandlers<CustomCategory>('custom_categories', { create: 'Categoria adicionada!', update: 'Categoria atualizada!', delete: 'Categoria removida.' });
    const budgetsHandler = createCrudHandlers<Budget>('budgets', { create: 'Orçamento salvo!', update: 'Orçamento atualizado!', delete: 'Orçamento removido.' });
    const goalsHandler = createCrudHandlers<Goal>('goals', { create: 'Meta criada!', update: 'Meta atualizada!', delete: 'Meta excluída.' });
    const assetsHandler = createCrudHandlers<Asset>('assets', { create: 'Ativo adicionado!', update: 'Ativo atualizado!', delete: 'Ativo removido.' });
    const snapshotsHandler = createCrudHandlers<Snapshot>('snapshots', { create: 'Snapshot salvo!', update: 'Snapshot atualizado!', delete: 'Snapshot removido.' });

    const handleAddCategory = async (name: string) => categoriesHandler.add({ name });

    // CASCADING DELETE FOR TRIPS
    const handleDeleteTrip = async (id: string) => performOperation(async () => {
        await supabaseService.deleteTripCascade(id);
        // UI Update: Remove trip and related transactions from state optimistically
        setTrips(prev => prev.filter(t => t.id !== id));
        setTransactions(prev => prev.filter(t => t.tripId !== id)); // Remove transactions linked to this trip
    }, 'Viagem e despesas excluídas.');

    const handlers = useMemo(() => ({
        handleLogin, handleLogout,
        handleAddTransaction, handleAddTransactions, handleUpdateTransaction, handleBatchUpdateTransactions, handleDeleteTransaction, handleAnticipateInstallments,
        handleAddAccount, handleUpdateAccount, handleDeleteAccount,

        ensurePeriodLoaded,
        checkConsistency: () => {
            const issues = checkDataConsistency(accounts, transactions);
            setDataInconsistencies(issues);
        },

        handleAddTrip: tripsHandler.add, handleUpdateTrip: tripsHandler.update,
        handleDeleteTrip,

        handleAddMember: membersHandler.add, handleUpdateMember: membersHandler.update,
        handleDeleteMember: async (id: string, strategy: 'CASCADE' | 'UNLINK' = 'UNLINK') => performOperation(async () => {
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

            await supabaseService.delete('family_members', id);
            setFamilyMembers(prev => prev.filter(m => m.id !== id));
        }, 'Membro removido e vínculos processados.'),
        handleAddCategory, handleDeleteCategory: categoriesHandler.delete,
        handleAddBudget: budgetsHandler.add, handleUpdateBudget: budgetsHandler.update, handleDeleteBudget: budgetsHandler.delete,
        handleAddGoal: goalsHandler.add, handleUpdateGoal: goalsHandler.update, handleDeleteGoal: goalsHandler.delete,
        handleAddAsset: assetsHandler.add, handleUpdateAsset: assetsHandler.update, handleDeleteAsset: assetsHandler.delete,
        handleAddSnapshot: snapshotsHandler.add,

        handleFactoryReset: async (unlinkFamily: boolean = false) => performOperation(async () => {
            await supabaseService.performSmartReset(unlinkFamily);
            setAccounts([]);
            setTransactions([]);
            if (unlinkFamily) {
                setTrips([]);
                setFamilyMembers([]);
            }
            setBudgets([]);
            setGoals([]);
            setAssets([]);
            setSnapshots([]);
            setCustomCategories([]);
            // Não fazer window.location.reload() aqui - o FactoryResetService já faz
        }, 'Sistema restaurado para o padrão de fábrica.'),
    }), [
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories,
        loadedPeriods,
        // Dependencies for closures logic inside handlers
        ensurePeriodLoaded, checkDataConsistency, performOperation, tripsHandler, membersHandler, categoriesHandler, budgetsHandler, goalsHandler, assetsHandler, snapshotsHandler
    ]);

    return {
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories,
        isLoading, dataInconsistencies, isOnline,
        isLoadingHistory,
        ensurePeriodLoaded,
        handlers
    };
};