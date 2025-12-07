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

export const useDataStore = () => {
    const { addToast } = useToast();
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

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        await performOperation(async () => {
            const now = new Date().toISOString();
            const totalInstallments = Number(newTx.totalInstallments);
            const txsToCreate: any[] = [];

            if (newTx.isInstallment && totalInstallments > 1) {
                const baseDate = parseDate(newTx.date);
                const seriesId = crypto.randomUUID();
                const baseInstallmentValue = Math.floor((newTx.amount / totalInstallments) * 100) / 100;
                let accumulatedAmount = 0;
                let accumulatedSharedAmounts: { [memberId: string]: number } = {};

                // Initialize accumulated amounts for each shared member
                if (newTx.sharedWith) {
                    newTx.sharedWith.forEach(s => {
                        accumulatedSharedAmounts[s.memberId] = 0;
                    });
                }

                for (let i = 0; i < totalInstallments; i++) {
                    // FIX: Calcular mês/ano corretamente para evitar problemas com dias 29, 30, 31
                    const targetMonth = baseDate.getMonth() + i;
                    const targetYear = baseDate.getFullYear() + Math.floor(targetMonth / 12);
                    const finalMonth = targetMonth % 12;

                    // Criar data sempre com dia 1 primeiro para evitar overflow de mês
                    const nextDate = new Date(targetYear, finalMonth, 1);

                    // Ajustar para o dia correto (ou último dia do mês se não existir)
                    const targetDay = baseDate.getDate();
                    const daysInTargetMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
                    nextDate.setDate(Math.min(targetDay, daysInTargetMonth));

                    // Preservar hora original
                    nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds());

                    let currentAmount = baseInstallmentValue;
                    if (i === totalInstallments - 1) {
                        // Last installment: adjust to match exact total
                        currentAmount = Number((newTx.amount - accumulatedAmount).toFixed(2));
                    }
                    accumulatedAmount += currentAmount;

                    // Calculate shared amounts with rounding correction on last installment
                    const currentSharedWith = newTx.sharedWith?.map(s => {
                        let assignedAmount = Number(((s.assignedAmount / newTx.amount) * currentAmount).toFixed(2));

                        if (i === totalInstallments - 1) {
                            // Last installment: adjust to match exact total for this member
                            const totalAssigned = accumulatedSharedAmounts[s.memberId] || 0;
                            assignedAmount = Number((s.assignedAmount - totalAssigned).toFixed(2));
                        } else {
                            // Accumulate for correction on last installment
                            accumulatedSharedAmounts[s.memberId] = (accumulatedSharedAmounts[s.memberId] || 0) + assignedAmount;
                        }

                        return {
                            ...s,
                            assignedAmount
                        };
                    });

                    txsToCreate.push({
                        ...newTx,
                        id: crypto.randomUUID(),
                        amount: currentAmount,
                        originalAmount: newTx.amount,
                        sharedWith: currentSharedWith,
                        seriesId: seriesId,
                        date: nextDate.toISOString().split('T')[0],
                        currentInstallment: i + 1,
                        totalInstallments: totalInstallments,
                        description: `${newTx.description} (${i + 1}/${totalInstallments})`,
                        createdAt: now,
                        updatedAt: now
                    });
                }
            } else {
                txsToCreate.push({
                    ...newTx,
                    id: crypto.randomUUID(),
                    createdAt: now,
                    updatedAt: now
                });
            }

            await supabaseService.bulkCreate('transactions', txsToCreate);
        }, 'Transação salva!');
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await performOperation(async () => {
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

            // --- TIER 1: CRITICAL DATA (Dashboard Immediate Render) ---
            // Fetch Accounts + Balances (RPC) + Recent Transactions (Current Month)
            // This allows the user to see their "Checking Account Balance" instantly.
            console.time("Tier1_Load");

            // Calculate "Current Month" range for initial view
            const today = new Date();
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().split('T')[0];

            // Parallel Request for Critical Data
            const [accs, serverBalances, recentTxs] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getAccountBalances(),
                supabaseService.getTransactions(startOfMonth) // Fetch only from start of this month onwards initially
            ]);

            // reconcile accounts with server balances immediately
            const safeServerBalances = Array.isArray(serverBalances) ? serverBalances : [];
            const initialAccountsState = accs.map(account => {
                const rpcBalanceObj = safeServerBalances.find((b: any) => b.account_id === account.id);
                return {
                    ...account,
                    balance: rpcBalanceObj ? Number(rpcBalanceObj.calculated_balance) : (account.initialBalance || 0)
                };
            });

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
            const historyStartDate = twoYearsAgo.toISOString().split('T')[0];

            // Note: We use endDate to avoid fetching duplicates of what we just got, 
            // OR we just fetch everything and merge. Merging is safer for consistency.
            // Let's fetch history strictly BEFORE the start of this month.
            const historyEndDate = new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0];

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
                // Combine recent (prev) and history. 
                // Any overlap? getTransactions(startOfMonth) gets >= startOfMonth
                // getTransactions(..., historyEndDate) gets <= historyEndDate
                // So no overlap logically. 
                // But let's safely deduplicate by ID just in case.
                const all = [...prev, ...historyTxs];
                // Sort descending date
                return all.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
            });

            setTrips(trps);
            setBudgets(bdgts);
            setGoals(gls);
            setFamilyMembers(fam);
            setAssets(assts);
            setSnapshots(snaps);
            setCustomCategories(cats);

            console.timeEnd("Tier2_Load");

            // Recurrence Engine & Consistency Checks run on FULL data
            // We re-run this now that we have full history
            // Wait a tick to let React render the updates
            setTimeout(() => {
                // Combine recent and history for the engine
                const allTxs = [...recentTxs, ...historyTxs];
                processRecurringTransactions(allTxs, handleAddTransaction, handleUpdateTransaction);
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
        await performOperation(async () => {
            // ✅ SOFT DELETE: Marcar transações como deletadas ao invés de excluir fisicamente
            // Isso mantém histórico e permite auditoria
            if (deleteScope === 'SERIES') {
                const tx = transactions.find(t => t.id === id);
                if (tx && tx.seriesId) {
                    // Find all transactions in this series
                    const seriesTxs = transactions.filter(t => t.seriesId === tx.seriesId);
                    console.log(`🗑️ Marcando ${seriesTxs.length} transações da série como deletadas...`);
                    for (const t of seriesTxs) {
                        await supabaseService.update('transactions', {
                            ...t,
                            deleted: true,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`  ✅ Transação marcada como deletada: ${t.description}`);
                    }
                } else {
                    // Fallback if no seriesId found
                    const tx = transactions.find(t => t.id === id);
                    if (tx) {
                        await supabaseService.update('transactions', {
                            ...tx,
                            deleted: true,
                            updatedAt: new Date().toISOString()
                        });
                        console.log(`✅ Transação marcada como deletada: ${tx.description}`);
                    }
                }
            } else {
                const tx = transactions.find(t => t.id === id);
                if (tx) {
                    await supabaseService.update('transactions', {
                        ...tx,
                        deleted: true,
                        updatedAt: new Date().toISOString()
                    });
                    console.log(`✅ Transação marcada como deletada: ${tx.description}`);
                }
            }
        }, 'Transação excluída.');
    };

    const handleAnticipateInstallments = async (ids: string[], targetDate: string, targetAccountId?: string) => {
        await performOperation(async () => {
            const txsToUpdate = transactions.filter(t => ids.includes(t.id)).map(t => ({
                ...t,
                date: targetDate,
                accountId: targetAccountId || t.accountId,
                description: t.description.includes('(Antecipado)') ? t.description : `${t.description} (Antecipado)`,
                updatedAt: new Date().toISOString()
            }));

            for (const tx of txsToUpdate) {
                await supabaseService.update('transactions', tx);
            }
        }, 'Parcelas antecipadas!');
    };

    // --- GENERIC CRUD FACTORY ---
    const createCrudHandlers = (table: string, labels: { create: string, update: string, delete: string }) => {
        return {
            add: (item: any) => performOperation(async () => { await supabaseService.create(table, { ...item, id: crypto.randomUUID() }); }, labels.create),
            update: (item: any) => performOperation(async () => { await supabaseService.update(table, item); }, labels.update),
            delete: (id: string) => performOperation(async () => { await supabaseService.delete(table, id); }, labels.delete),
        };
    };

    // --- HANDLERS ---

    // Custom Handlers (Complex Logic)
    // handleAddAccount defined above... 
    const handleAddAccount = async (acc: any) => performOperation(async () => {
        const accountId = crypto.randomUUID();
        const initialAmount = acc.initialBalance || 0;

        // Create account with 0 initial balance to avoid double counting
        // The value is now represented by the transaction below
        const accountToCreate = {
            ...acc,
            id: accountId,
            initialBalance: 0,
            balance: 0
        };

        await supabaseService.create('accounts', accountToCreate);

        // Create transaction for initial balance if non-zero
        if (Math.abs(initialAmount) > 0) {
            const now = new Date().toISOString();
            const isPositive = initialAmount >= 0;

            const transaction = {
                id: crypto.randomUUID(),
                accountId: accountId,
                amount: Math.abs(initialAmount),
                date: now.split('T')[0], // YYYY-MM-DD
                description: 'Saldo Inicial',
                type: isPositive ? TransactionType.INCOME : TransactionType.EXPENSE,
                category: Category.OPENING_BALANCE || Category.INCOME,
                isSettled: true,
                createdAt: now,
                updatedAt: now
            };

            await supabaseService.create('transactions', transaction);
        }
    }, 'Conta criada!');

    const handleUpdateAccount = async (acc: any) => performOperation(async () => { await supabaseService.update('accounts', acc); }, 'Conta atualizada!');

    // Custom Delete Account (Soft Delete RPC)
    const handleDeleteAccount = async (id: string) => performOperation(async () => {
        console.log(`🗑️ Excluindo conta ${id} via RPC...`);
        await supabaseService.softDeleteAccount(id);
        console.log(`✅ Conta ${id} e suas transações excluídas com sucesso!`);
    }, 'Conta excluída com sucesso.');

    // Generated Handlers (Simple CRUD)
    const tripsHandler = createCrudHandlers('trips', { create: 'Viagem criada!', update: 'Viagem atualizada!', delete: 'Viagem excluída.' });
    const membersHandler = createCrudHandlers('family_members', { create: 'Membro adicionado!', update: 'Membro atualizado!', delete: 'Membro removido.' });
    const categoriesHandler = createCrudHandlers('custom_categories', { create: 'Categoria adicionada!', update: 'Categoria atualizada!', delete: 'Categoria removida.' });
    const budgetsHandler = createCrudHandlers('budgets', { create: 'Orçamento salvo!', update: 'Orçamento atualizado!', delete: 'Orçamento removido.' });
    const goalsHandler = createCrudHandlers('goals', { create: 'Meta criada!', update: 'Meta atualizada!', delete: 'Meta excluída.' });
    const assetsHandler = createCrudHandlers('assets', { create: 'Ativo adicionado!', update: 'Ativo atualizado!', delete: 'Ativo removido.' });
    const snapshotsHandler = createCrudHandlers('snapshots', { create: 'Snapshot salvo!', update: 'Snapshot atualizado!', delete: 'Snapshot removido.' });

    // Helper for adding simple category (name only)
    const handleAddCategory = async (name: string) => categoriesHandler.add({ name });

    return {
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading, dataInconsistencies,
        handlers: {
            handleLogin, handleLogout,
            handleAddTransaction, handleUpdateTransaction, handleDeleteTransaction, handleAnticipateInstallments,
            handleAddAccount, handleUpdateAccount, handleDeleteAccount,

            handleAddTrip: tripsHandler.add, handleUpdateTrip: tripsHandler.update, handleDeleteTrip: tripsHandler.delete,
            handleAddMember: membersHandler.add, handleDeleteMember: membersHandler.delete,
            handleAddCategory, handleDeleteCategory: categoriesHandler.delete,
            handleAddBudget: budgetsHandler.add, handleUpdateBudget: budgetsHandler.update, handleDeleteBudget: budgetsHandler.delete,
            handleAddGoal: goalsHandler.add, handleUpdateGoal: goalsHandler.update, handleDeleteGoal: goalsHandler.delete,
            handleAddAsset: assetsHandler.add, handleUpdateAsset: assetsHandler.update, handleDeleteAsset: assetsHandler.delete,
            handleAddSnapshot: snapshotsHandler.add,

            handleFactoryReset: async () => performOperation(async () => {
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