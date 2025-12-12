import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, SyncStatus, UserProfile, Snapshot, TransactionType, Category
} from '../types';
import { parseDate } from '../utils';
import { useToast } from '../components/ui/Toast';
import { supabase } from '../integrations/supabase/client';
import { processRecurringTransactions } from '../services/recurrenceEngine';
import { checkDataConsistency } from '../services/financialLogic';
import { CacheService } from '../services/cacheService';
import { SyncService } from '../services/syncService';

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

    const [isLoading, setIsLoading] = useState(true);
    const [dataInconsistencies, setDataInconsistencies] = useState<string[]>([]);
    const isInitialized = useRef(false);

    // --- ACTIONS DEFINED EARLY FOR USAGE IN FETCH ---
    // We need to define these before fetchData so we can pass them to recurrence engine,
    // BUT fetchData is called by these. Circular dependency?
    // Solution: Define internal handlers that don't call fetchData, or just let the cycle happen (it breaks naturally).
    // Actually, processRecurringTransactions calls onAdd/onUpdate.
    // If we pass the public handlers, they call refresh() -> fetchData().
    // This is safe as long as recurrence engine doesn't generate infinitely.

    // Wrapper for async operations to handle errors
    const performOperation = async (operation: () => Promise<void>, successMessage?: string) => {
        try {
            await operation();
            if (successMessage) addToast(successMessage, 'success');
            refresh();
        } catch (error: any) {
            console.error("Operation failed:", error);
            addToast(`Erro: ${error.message || 'Falha na operação'}`, 'error');
        }
    };

    // Network Status Listener & Sync
    useEffect(() => {
        const handleOnline = () => {
            setIsOnline(true);
            addToast('Você está online. Sincronizando...', 'success');
            SyncService.processQueue().then(({ success, failed }) => {
                if (success > 0) {
                    addToast(`${success} itens sincronizados!`, 'success');
                    // refresh(); // Refresh after sync to get latest data from DB
                }
                if (failed > 0) {
                    addToast(`${failed} itens falharam na sincronização.`, 'error');
                }
            });
        };
        const handleOffline = () => {
            setIsOnline(false);
            addToast('Você está offline. As alterações serão salvas localmente.', 'warning');
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

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        validateTransaction(newTx);

        // Prepare logic (Generate Installments vs Single)
        // We separate calculation from execution to support offline queuing
        const generateTransactions = (): any[] => {
            const now = new Date().toISOString();
            const totalInstallments = Number(newTx.totalInstallments);
            const txs: any[] = [];

            if (newTx.isInstallment && totalInstallments > 1) {
                const baseDate = parseDate(newTx.date);
                const seriesId = crypto.randomUUID();
                const baseInstallmentValue = Math.floor((newTx.amount / totalInstallments) * 100) / 100;
                let accumulatedAmount = 0;
                let accumulatedSharedAmounts: { [memberId: string]: number } = {};

                if (newTx.sharedWith) {
                    newTx.sharedWith.forEach(s => { accumulatedSharedAmounts[s.memberId] = 0; });
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
                        currentAmount = Number((newTx.amount - accumulatedAmount).toFixed(2));
                    }
                    accumulatedAmount += currentAmount;

                    const currentSharedWith = newTx.sharedWith?.map(s => {
                        let assignedAmount = Number(((s.assignedAmount / newTx.amount) * currentAmount).toFixed(2));
                        if (i === totalInstallments - 1) {
                            assignedAmount = Number((s.assignedAmount - accumulatedSharedAmounts[s.memberId]).toFixed(2));
                        }
                        accumulatedSharedAmounts[s.memberId] += assignedAmount;
                        return { ...s, assignedAmount };
                    });

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
                        status: 'COMPLETED',
                        created_at: now,
                        updatedAt: now
                    });
                }
            } else {
                txs.push({
                    ...newTx,
                    id: crypto.randomUUID(),
                    status: 'COMPLETED',
                    created_at: now,
                    updatedAt: now
                });
            }
            return txs;
        };

        if (!isOnline) {
            try {
                const txsToCreate = generateTransactions();
                // Queue and Optimistic Update
                txsToCreate.forEach(tx => {
                    SyncService.addToQueue({ type: 'ADD_TRANSACTION', payload: tx });
                });

                // Update Local State Optimistically
                setTransactions(prev => {
                    const updated = [...txsToCreate, ...prev];
                    return updated.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                });

                addToast('Transação salva offline. Será sincronizada quando houver conexão.', 'warning');
            } catch (e) {
                console.error("Offline Error", e);
                addToast('Erro ao salvar offline.', 'error');
            }
            return;
        }

        // Online execution using normal flow
        await performOperation(async () => {
            const txsToCreate = generateTransactions();
            for (const tx of txsToCreate) {
                await supabaseService.create('transactions', tx);
            }
        }, 'Transação adicionada com sucesso!');
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        validateTransaction(updatedTx);

        const originalTx = transactions.find(t => t.id === updatedTx.id);

        // Offline Check
        if (!isOnline) {
            // Block complex series regeneration offline
            if (updatedTx.seriesId && originalTx && updatedTx.totalInstallments !== originalTx.totalInstallments) {
                addToast('Edição de parcelamento requer internet.', 'error');
                return;
            }

            SyncService.addToQueue({ type: 'UPDATE_TRANSACTION', payload: updatedTx });
            setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()));
            addToast('Atualização salva offline.', 'warning');
            return;
        }

        await performOperation(async () => {
            // CHECK FOR SERIES REGENERATION (Change in Total Installments)
            // const originalTx = transactions.find(t => t.id === updatedTx.id); // Already found above
            if (updatedTx.seriesId && originalTx && updatedTx.totalInstallments !== originalTx.totalInstallments) {
                // 1. Validation: Check if any installment is settled
                const seriesTxs = transactions.filter(t => t.seriesId === updatedTx.seriesId);
                const hasPaid = seriesTxs.some(t => t.isSettled || (t.sharedWith?.some(s => s.isSettled)));
                // Check isSettled on transaction and on any shared splits
                if (hasPaid) {
                    throw new Error('Não é possível alterar o número de parcelas de uma série com pagamentos já realizados.');
                }

                // 2. Delete Old Series
                await supabaseService.deleteTransactionSeries(updatedTx.seriesId);

                // 3. Re-Create New Series
                // We use the UPDATED amount and UPDATED totalInstallments
                // We base the start date on the ORIGINAL start date (from the first installment of the old series)
                // OR we use the date of the transaction being edited as the anchor?
                // Ideally, we find the first installment of the old series to get the start date.
                const firstOldTx = seriesTxs.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())[0];
                const baseDateStr = firstOldTx ? firstOldTx.date : updatedTx.date;

                // Call handleAddTransaction logic (duplicated here for safety/closure access or extracted)
                // Since handleAddTransaction is complex, let's call it!
                // But we need to omit ID.
                const newSeriesTx: any = {
                    ...updatedTx,
                    date: baseDateStr, // Reset to start date
                    currentInstallment: 1, // Reset
                    seriesId: undefined, // Create new series ID
                    isInstallment: true
                };
                delete newSeriesTx.id;
                delete newSeriesTx.createdAt;
                delete newSeriesTx.updatedAt;

                await handleAddTransaction(newSeriesTx);
                return; // Stop here, we replaced it.
            }

            // Standard Update
            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
        }, 'Transação atualizada!');
    };

    // --- FETCH DATA FROM SUPABASE (TIERED LOADING STRATEGY) ---
    const fetchData = useCallback(async (forceLoading = false) => {
        // Check auth first
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
            setIsLoading(false);
            return;
        }

        if (!isInitialized.current || forceLoading) {
            setIsLoading(true);
        }

        try {
            const userId = session.user.id;

            // --- CACHE LAYER (Offline First) ---
            if (!isInitialized.current && !forceLoading) {
                const cachedData = CacheService.get<any>(`data_${userId}`);
                if (cachedData) {
                    console.log("Loading from cache...");
                    setAccounts(cachedData.accounts || []);
                    setTransactions(cachedData.transactions || []);
                    setTrips(cachedData.trips || []);
                    setBudgets(cachedData.budgets || []);
                    setGoals(cachedData.goals || []);
                    setFamilyMembers(cachedData.familyMembers || []);
                    setAssets(cachedData.assets || []);
                    setSnapshots(cachedData.snapshots || []);
                    setCustomCategories(cachedData.customCategories || []);
                    setIsLoading(false); // Immediate visual feedback
                }
            }

            // --- TIER 1: CRITICAL DATA (Dashboard Immediate Render) ---
            // Fetch Accounts + Balances (RPC) + Recent Transactions (Current Month)
            // This allows the user to see their "Checking Account Balance" instantly.
            console.time("Tier1_Load");

            // Calculate "Current Month" range for initial view
            const today = new Date();
            // FIX: Format dates locally to avoid timezone issues
            const startOfMonthDate = new Date(today.getFullYear(), today.getMonth(), 1);
            const startOfMonth = `${startOfMonthDate.getFullYear()}-${String(startOfMonthDate.getMonth() + 1).padStart(2, '0')}-01`;

            const endOfMonthDate = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            const endOfMonth = `${endOfMonthDate.getFullYear()}-${String(endOfMonthDate.getMonth() + 1).padStart(2, '0')}-${String(endOfMonthDate.getDate()).padStart(2, '0')}`;

            // Parallel Request for Critical Data
            // NOTE: RPC get_account_totals removed - using balance engine instead
            const [accs, recentTxs] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactions(startOfMonth) // Fetch only from start of this month onwards initially
            ]);

            // Use stored balance from DB (will be recalculated by balance engine later)
            const initialAccountsState = accs.map(account => ({
                ...account,
                balance: account.balance ?? account.initialBalance ?? 0
            }));

            // Update State IMMEDIATE (First Paint)
            setAccounts(initialAccountsState);
            setTransactions(recentTxs);
            setIsLoading(false); // Unblock UI!
            console.timeEnd("Tier1_Load");


            // --- TIER 2: BACKGROUND DATA (History & Heavy Items) ---
            // Fetch older transactions, trips, goals, etc.
            console.time("Tier2_Load");

            // We fetch transactions from the last 24 months (2 years) EXCLUDING what we already fetched
            // Actually, simplest is to fetch everything older than startOfMonth
            const twoYearsAgo = new Date();
            twoYearsAgo.setMonth(twoYearsAgo.getMonth() - 24);
            // FIX: Format date locally to avoid timezone issues
            const historyStartDate = `${twoYearsAgo.getFullYear()}-${String(twoYearsAgo.getMonth() + 1).padStart(2, '0')}-${String(twoYearsAgo.getDate()).padStart(2, '0')}`;

            // Note: We use endDate to avoid fetching duplicates of what we just got, 
            // OR we just fetch everything and merge. Merging is safer for consistency.
            // Let's fetch history strictly BEFORE the start of this month.
            const historyEndDateObj = new Date(today.getFullYear(), today.getMonth(), 0);
            const historyEndDate = `${historyEndDateObj.getFullYear()}-${String(historyEndDateObj.getMonth() + 1).padStart(2, '0')}-${String(historyEndDateObj.getDate()).padStart(2, '0')}`;

            const [
                historyTxs,
                trps, bdgts, gls, fam, assts, snaps, cats
            ] = await Promise.all([
                supabaseService.getTransactions(historyStartDate, historyEndDate),
                supabaseService.getTrips(),
                supabaseService.getBudgets(),
                supabaseService.getGoals(),
                supabaseService.getFamilyMembers(),
                supabaseService.getAssets(),
                supabaseService.getSnapshots(),
                supabaseService.getCustomCategories()
            ]);

            // MERGE & UPDATE
            setTransactions(prev => {
                const all = [...prev, ...historyTxs];
                return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            setTrips(trps);
            setBudgets(bdgts);
            setGoals(gls);
            setFamilyMembers(fam);
            setAssets(assts);
            setSnapshots(snaps);
            setCustomCategories(cats);

            // SAVE TO CACHE (Full Dataset)
            CacheService.set(`data_${userId}`, {
                accounts: accs,
                // Combine recent and history for full cache
                transactions: [...recentTxs, ...historyTxs].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
                trips: trps,
                budgets: bdgts,
                goals: gls,
                familyMembers: fam,
                assets: assts,
                snapshots: snaps,
                customCategories: cats
            });

            console.timeEnd("Tier2_Load");

            // Recurrence Engine & Consistency Checks run on FULL data (including DELETED to prevent regeneration)
            // Retrieve deleted transactions for logic check
            const deletedTxs = await supabaseService.getTransactions(undefined, undefined, true);
            // Note: getTransactions(undefined, undefined, true) returns ALL (active + deleted) if logic above is correct?
            // Wait, my change to getTransactions was: if (!includeDeleted) eq('deleted', false).
            // So incldeusDeleted=true means NO filter on deleted, so it returns BOTH.
            // So deletedTxs contains EVERYTHING. Ideal for the engine.

            setTimeout(() => {
                // Use the fresh full list from DB (active + deleted) for the engine
                // to ensure we don't recreate things that were deleted.
                processRecurringTransactions(deletedTxs, handleAddTransaction, handleUpdateTransaction);

                // Run Consistency Check (Active only)
                // We can filter deletedTxs for active ones or use the state 'transactions' (but we need to wait for state update?)
                // Actually 'historyTxs' + 'recentTxs' are the active ones we have in scope.
                const activeTxs = [...recentTxs, ...historyTxs];
                const issues = checkDataConsistency(accs, activeTxs);
                setDataInconsistencies(issues);
            }, 100);

            isInitialized.current = true;
        } catch (error) {
            console.error("Error fetching data from Supabase:", error);
            addToast("Erro ao carregar dados da nuvem.", 'error');
            setIsLoading(false); // Ensure we don't hang if error
        }
    }, []);

    // Initial Load
    useEffect(() => {
        fetchData();
    }, [fetchData]);

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

        if (!isOnline) {
            if (deleteScope === 'SERIES') {
                addToast('Exclusão em série requer internet.', 'error');
                return;
            }

            SyncService.addToQueue({ type: 'DELETE_TRANSACTION', payload: id });
            setTransactions(prev => prev.filter(t => t.id !== id));
            addToast('Exclusão salva offline.', 'warning');
            return;
        }

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
        }, deleteScope === 'SERIES' ? 'Série excluída.' : 'Transação excluída.');
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

            for (const tx of updatedTxs) {
                await supabaseService.update('transactions', tx);
            }
        }, 'Parcelas antecipadas!');
    };

    // --- GENERIC CRUD FACTORY ---
    const createCrudHandlers = (table: string, labels: { create: string, update: string, delete: string }) => {
        return {
            add: (item: any) => performOperation(async () => { await supabaseService.create(table, { id: crypto.randomUUID(), ...item }); }, labels.create),
            update: (item: any) => performOperation(async () => { await supabaseService.update(table, item); }, labels.update),
            delete: (id: string) => performOperation(async () => { await supabaseService.delete(table, id); }, labels.delete),
        };
    };

    // --- HANDLERS ---

    // Account Handlers
    const handleAddAccount = async (acc: any) => performOperation(async () => {
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

            const transaction = {
                id: crypto.randomUUID(),
                accountId: accountId,
                amount: Math.abs(initialAmount),
                date: dateStr,
                description: 'Saldo Inicial',
                type: isPositive ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: Category.OPENING_BALANCE || Category.INCOME,
                isSettled: true,
                createdAt: now.toISOString(),
                updatedAt: now.toISOString()
            };

            await supabaseService.create('transactions', transaction);
        }
    }, 'Conta criada!');

    const handleUpdateAccount = async (acc: any) => performOperation(async () => { await supabaseService.update('accounts', acc); }, 'Conta atualizada!');

    const handleDeleteAccount = async (id: string) => performOperation(async () => {
        await supabaseService.softDeleteAccount(id);
    }, 'Conta excluída com sucesso.');

    // Generated Handlers
    const tripsHandler = createCrudHandlers('trips', { create: 'Viagem criada!', update: 'Viagem atualizada!', delete: 'Viagem excluída.' });
    const membersHandler = createCrudHandlers('family_members', { create: 'Membro adicionado!', update: 'Membro atualizado!', delete: 'Membro removido.' });
    const categoriesHandler = createCrudHandlers('custom_categories', { create: 'Categoria adicionada!', update: 'Categoria atualizada!', delete: 'Categoria removida.' });
    const budgetsHandler = createCrudHandlers('budgets', { create: 'Orçamento salvo!', update: 'Orçamento atualizado!', delete: 'Orçamento removido.' });
    const goalsHandler = createCrudHandlers('goals', { create: 'Meta criada!', update: 'Meta atualizada!', delete: 'Meta excluída.' });
    const assetsHandler = createCrudHandlers('assets', { create: 'Ativo adicionado!', update: 'Ativo atualizado!', delete: 'Ativo removido.' });
    const snapshotsHandler = createCrudHandlers('snapshots', { create: 'Snapshot salvo!', update: 'Snapshot atualizado!', delete: 'Snapshot removido.' });

    const handleAddCategory = async (name: string) => categoriesHandler.add({ name });

    return {
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading, dataInconsistencies, isOnline,
        handlers: {
            handleLogin, handleLogout,
            handleAddTransaction, handleUpdateTransaction, handleDeleteTransaction, handleAnticipateInstallments,
            handleAddAccount, handleUpdateAccount, handleDeleteAccount,

            handleAddTrip: tripsHandler.add, handleUpdateTrip: tripsHandler.update, handleDeleteTrip: tripsHandler.delete,
            handleAddMember: membersHandler.add, handleUpdateMember: membersHandler.update, handleDeleteMember: membersHandler.delete,
            handleAddCategory, handleDeleteCategory: categoriesHandler.delete,
            handleAddBudget: budgetsHandler.add, handleUpdateBudget: budgetsHandler.update, handleDeleteBudget: budgetsHandler.delete,
            handleAddGoal: goalsHandler.add, handleUpdateGoal: goalsHandler.update, handleDeleteGoal: goalsHandler.delete,
            handleAddAsset: assetsHandler.add, handleUpdateAsset: assetsHandler.update, handleDeleteAsset: assetsHandler.delete,
            handleAddSnapshot: snapshotsHandler.add,

            handleFactoryReset: async () => performOperation(async () => {


                // 2. Local Wipe
                await supabaseService.dangerouslyWipeAllData();
                setAccounts([]);
                setTransactions([]);
                setTrips([]);
                setBudgets([]);
                setGoals([]);
                setFamilyMembers([]);
                setAssets([]);
                setSnapshots([]);
                setCustomCategories([]);
            }, 'Sistema restaurado para o padrão de fábrica.')
        }
    };
};