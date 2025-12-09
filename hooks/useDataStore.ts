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

                    // Formatar data manualmente para evitar problemas de timezone
                    // Não usar toISOString() que converte para UTC e pode mudar o dia
                    const dateYear = nextDate.getFullYear();
                    const dateMonth = String(nextDate.getMonth() + 1).padStart(2, '0');
                    const dateDay = String(nextDate.getDate()).padStart(2, '0');
                    const formattedDate = `${dateYear}-${dateMonth}-${dateDay}`;

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
                        date: formattedDate, // Usar data formatada localmente, não toISOString()
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

            // AUTOMATIC SHARING INVITATION LOGIC
            const currentUser = (await supabase.auth.getUser()).data.user;
            if (currentUser && newTx.sharedWith && newTx.sharedWith.length > 0) {
                // We need to process this for each created transaction (e.g. if installments)
                // However, usually we want one request per transaction ID.
                // For installments, do we send 12 requests? The user said "todas transações".
                // But typically for installments, the series is shared?
                // Providing 12 popups is bad UX.
                // But the system stores requests per transaction_id.
                // Optimally: Create request for each, but maybe UI groups them?
                // Current UI: SharedRequests lists items.
                // If I buy an iPhone in 12x, the other person gets 12 requests?
                // User requirement: "Lançamento de despesa... Criar uma SOLICITAÇÃO".
                // Implies one action. But data model is per-tx.
                // Let's create for ALL to be consistent with "retroactive" logic which shares all.
                // The receiver can "Accept All" later if we build it, or we accept the Series.
                // For now, generate for all created IDs.

                for (const tx of txsToCreate) {
                    for (const share of (tx.sharedWith || [])) {
                        const member = familyMembers.find(m => m.id === share.memberId);
                        if (member?.email) {
                            try {
                                // Check if user exists
                                const { data: inviteeId, error: checkError } = await supabase.rpc('check_user_by_email', { email_to_check: member.email.trim() });

                                if (checkError) {
                                    console.error("Error checking user for share:", checkError);
                                    addToast(`Erro ao buscar usuário para partilha: ${member.name}`, 'error');
                                    continue;
                                }

                                if (inviteeId) {
                                    // ARCHITECT REFACTOR (AUTO-SHARE):
                                    // We simply create the request. 
                                    // The Database Trigger 'force_auto_accept_linked_members' will:
                                    // 1. Check if user is linked in family_members.
                                    // 2. If linked, force status to 'ACCEPTED'.
                                    // 3. Trigger 'on_shared_request_accepted' creates the mirror transaction.

                                    // We send 'PENDING' by default. The DB upgrades it if applicable.
                                    const { error: insertError } = await supabase.from('shared_transaction_requests').insert({
                                        transaction_id: tx.id,
                                        requester_id: currentUser.id,
                                        invited_email: member.email.trim(),
                                        invited_user_id: inviteeId,
                                        status: 'PENDING', // DB will auto-accept if linked
                                        assigned_amount: share.assignedAmount
                                    });

                                    if (insertError) {
                                        console.error("Failed to create shared request:", insertError);
                                        addToast(`Falha ao compartilhar com ${member.name}`, 'error');
                                    } else {
                                        // addToast(`Despesa compartilhada com ${member.name}!`, 'success');
                                    }
                                } else {
                                    console.warn(`User with email ${member.email} not found.`);
                                    addToast(`Usuário não encontrado para o email: ${member.email}`, 'warning');
                                }
                            } catch (err) {
                                console.error("Unexpected error in sharing logic:", err);
                            }
                        } else {
                            // Member has no email, so we can't share digitally.
                            // Ideally we might warn, but this happens for "Kids" or manual members often.
                        }
                    }
                }
            }
        }, 'Transação salva!');
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await performOperation(async () => {
            // 1. Update Local
            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });

            // 2. Sync Metadata to Linked Copies (RPC)
            try {
                // Call the Manual Migration RPC
                const { error } = await supabase.rpc('sync_shared_transaction', {
                    original_id: updatedTx.id,
                    new_amount: updatedTx.amount, // Note: This updates Total. Frontend should maybe handle splits? For now, sync metadata.
                    new_description: updatedTx.description,
                    new_date: updatedTx.date,
                    new_type: updatedTx.type,
                    new_category: updatedTx.category,
                    new_currency: updatedTx.currency || 'BRL'
                });

                if (error) {
                    console.warn("Sync RPC failed (Remote update skipped):", error.message);
                }
            } catch (e) {
                console.error("Sync error:", e);
            }
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
            // 1. Local Delete (Soft)
            if (deleteScope === 'SERIES') {
                const tx = transactions.find(t => t.id === id);
                if (tx && tx.seriesId) {
                    const seriesTxs = transactions.filter(t => t.seriesId === tx.seriesId);
                    for (const t of seriesTxs) {
                        await supabaseService.update('transactions', { ...t, deleted: true, updatedAt: new Date().toISOString() });
                        // Delete copies for series? RPC only handles one ID. 
                        // Loop RPC calls.
                        supabase.rpc('sync_delete_transaction', { original_id: t.id });
                    }
                } else {
                    const tx = transactions.find(t => t.id === id);
                    if (tx) {
                        await supabaseService.update('transactions', { ...tx, deleted: true, updatedAt: new Date().toISOString() });
                        supabase.rpc('sync_delete_transaction', { original_id: tx.id });
                    }
                }
            } else {
                const tx = transactions.find(t => t.id === id);
                if (tx) {
                    await supabaseService.update('transactions', { ...tx, deleted: true, updatedAt: new Date().toISOString() });
                    supabase.rpc('sync_delete_transaction', { original_id: tx.id });
                }
            }
        }, 'Transação excluída.');
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
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading, dataInconsistencies,
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
                // 1. BROADCAST DELETE: Clean up copies I sent to others
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    try {
                        const { data: requests } = await supabase
                            .from('shared_transaction_requests')
                            .select('transaction_id')
                            .eq('requester_id', user.id);

                        if (requests && requests.length > 0) {
                            // Delete copies in other users' accounts
                            const cleanupPromises = requests.map(r =>
                                supabase.from('transactions')
                                    .delete()
                                    .ilike('observation', `%[SYNC:${r.transaction_id}]%`)
                            );
                            await Promise.all(cleanupPromises);
                        }
                    } catch (e) {
                        console.error("Failed to cleanup shared copies:", e);
                        // Continue to wipe anyway
                    }
                }

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