import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { db } from '../services/db'; // Keeping Dexie only for migration source
import { 
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, 
    CustomCategory, SyncStatus, UserProfile, Snapshot, AuditLog, TransactionType 
} from '../types';
import { parseDate } from '../utils';

export const useDataStore = () => {
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
    
    // Loading States
    const [isLoading, setIsLoading] = useState(true); // Full screen loader
    const [isRefetching, setIsRefetching] = useState(false); // Background loader
    const isInitialized = useRef(false);

    // --- FETCH DATA FROM SUPABASE ---
    const fetchData = useCallback(async (forceLoading = false) => {
        if (!isInitialized.current || forceLoading) {
            setIsLoading(true);
        } else {
            setIsRefetching(true);
        }

        try {
            const [
                accs, txs, trps, bdgts, gls, fam, assts, snaps, cats
            ] = await Promise.all([
                supabaseService.getAccounts(),
                supabaseService.getTransactions(),
                supabaseService.getTrips(),
                supabaseService.getBudgets(),
                supabaseService.getGoals(),
                supabaseService.getFamilyMembers(),
                supabaseService.getAssets(),
                supabaseService.getSnapshots(),
                supabaseService.getCustomCategories()
            ]);

            setAccounts(accs);
            setTransactions(txs);
            setTrips(trps);
            setBudgets(bdgts);
            setGoals(gls);
            setFamilyMembers(fam);
            setAssets(assts);
            setSnapshots(snaps);
            setCustomCategories(cats);
            
            isInitialized.current = true;
        } catch (error) {
            console.error("Error fetching data from Supabase:", error);
        } finally {
            setIsLoading(false);
            setIsRefetching(false);
        }
    }, []);

    // Initial Load
    useEffect(() => {
        fetchData(true);
    }, [fetchData]);

    // --- ACTIONS (Optimistic Updates + Cloud Save) ---

    const handleLogin = async (userProfile: UserProfile) => {
        setUser(userProfile);
        fetchData(true); // Reload data for this user with full loader
    };

    const handleLogout = async () => {
        setUser(null);
        setAccounts([]);
        setTransactions([]);
        isInitialized.current = false;
    };

    // Helper to refresh data after mutation
    const refresh = () => fetchData(false);

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        const now = new Date().toISOString();
        const totalInstallments = Number(newTx.totalInstallments);
        const txsToCreate: any[] = [];

        if (newTx.isInstallment && totalInstallments > 1) {
            const baseDate = parseDate(newTx.date);
            const seriesId = crypto.randomUUID();
            const baseInstallmentValue = Math.floor((newTx.amount / totalInstallments) * 100) / 100;
            let accumulatedAmount = 0;

            for (let i = 0; i < totalInstallments; i++) {
                const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);
                nextDate.setMonth(nextDate.getMonth() + i);
                const targetDay = baseDate.getDate();
                const daysInTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                nextDate.setDate(Math.min(targetDay, daysInTargetMonth));
                nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds());

                let currentAmount = baseInstallmentValue;
                if (i === totalInstallments - 1) {
                    currentAmount = Number((newTx.amount - accumulatedAmount).toFixed(2));
                }
                accumulatedAmount += currentAmount;

                const currentSharedWith = newTx.sharedWith?.map(s => ({
                    ...s,
                    assignedAmount: Number(((s.assignedAmount / newTx.amount) * currentAmount).toFixed(2))
                }));

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

        // Optimistic UI Update (Optional but good for feeling instant)
        // For now, we rely on fast background refresh
        await supabaseService.bulkCreate('transactions', txsToCreate);
        refresh();
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
        refresh();
    };

    const handleDeleteTransaction = async (id: string) => {
        await supabaseService.delete('transactions', id);
        refresh();
    };

    const handleAnticipateInstallments = async (ids: string[], targetDate: string, targetAccountId?: string) => {
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
         refresh();
    };

    // --- GENERIC HANDLERS ---
    const handleAddAccount = async (acc: any) => { 
        await supabaseService.create('accounts', { ...acc, id: crypto.randomUUID() }); 
        refresh(); 
    };
    const handleUpdateAccount = async (acc: any) => { await supabaseService.update('accounts', acc); refresh(); };
    const handleDeleteAccount = async (id: string) => { await supabaseService.delete('accounts', id); refresh(); };

    const handleAddTrip = async (trip: any) => { await supabaseService.create('trips', { ...trip, id: crypto.randomUUID() }); refresh(); };
    const handleUpdateTrip = async (trip: any) => { await supabaseService.update('trips', trip); refresh(); };
    const handleDeleteTrip = async (id: string) => { await supabaseService.delete('trips', id); refresh(); };

    const handleAddMember = async (m: any) => { await supabaseService.create('family_members', { ...m, id: crypto.randomUUID() }); refresh(); };
    const handleDeleteMember = async (id: string) => { await supabaseService.delete('family_members', id); refresh(); };

    const handleAddCategory = async (name: string) => { await supabaseService.create('custom_categories', { id: crypto.randomUUID(), name }); refresh(); };
    const handleDeleteCategory = async (id: string) => { await supabaseService.delete('custom_categories', id); refresh(); };

    const handleAddBudget = async (b: any) => { await supabaseService.create('budgets', { ...b, id: crypto.randomUUID() }); refresh(); };
    const handleUpdateBudget = async (b: any) => { await supabaseService.update('budgets', b); refresh(); };
    const handleDeleteBudget = async (id: string) => { await supabaseService.delete('budgets', id); refresh(); };

    const handleAddGoal = async (g: any) => { await supabaseService.create('goals', { ...g, id: crypto.randomUUID() }); refresh(); };
    const handleUpdateGoal = async (g: any) => { await supabaseService.update('goals', g); refresh(); };
    const handleDeleteGoal = async (id: string) => { await supabaseService.delete('goals', id); refresh(); };

    const handleAddAsset = async (a: any) => { await supabaseService.create('assets', { ...a, id: crypto.randomUUID() }); refresh(); };
    const handleUpdateAsset = async (a: any) => { await supabaseService.update('assets', a); refresh(); };
    const handleDeleteAsset = async (id: string) => { await supabaseService.delete('assets', id); refresh(); };

    // --- MIGRATION TOOL (Local -> Cloud) ---
    const handleImportData = async () => {
        if (!confirm("Isso irá pegar todos os dados locais deste navegador e enviar para a nuvem Supabase. Deseja continuar?")) return;
        
        setIsLoading(true);
        try {
            const localAccounts = await db.accounts.toArray();
            const localTxs = await db.transactions.toArray();
            const localTrips = await db.trips.toArray();
            const localFamily = await db.familyMembers.toArray();
            const localGoals = await db.goals.toArray();
            const localBudgets = await db.budgets.toArray();
            const localAssets = await db.assets.toArray();
            const localCats = await db.customCategories.toArray();
            const localSnaps = await db.snapshots.toArray();

            // Bulk Upload
            if (localAccounts.length) await supabaseService.bulkCreate('accounts', localAccounts);
            if (localTxs.length) await supabaseService.bulkCreate('transactions', localTxs);
            if (localTrips.length) await supabaseService.bulkCreate('trips', localTrips);
            if (localFamily.length) await supabaseService.bulkCreate('family_members', localFamily);
            if (localGoals.length) await supabaseService.bulkCreate('goals', localGoals);
            if (localBudgets.length) await supabaseService.bulkCreate('budgets', localBudgets);
            if (localAssets.length) await supabaseService.bulkCreate('assets', localAssets);
            if (localCats.length) await supabaseService.bulkCreate('custom_categories', localCats);
            if (localSnaps.length) await supabaseService.bulkCreate('snapshots', localSnaps);

            alert("Migração concluída com sucesso! Seus dados agora estão na nuvem.");
            refresh();
        } catch (e) {
            console.error(e);
            alert("Erro na migração. Verifique o console.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSystem = async () => {
        if (confirm("ATENÇÃO: Isso apagará os dados LOCAIS (cache) para corrigir conflitos. Seus dados na nuvem (Supabase) estarão seguros. Continuar?")) {
            await db.delete();
            window.location.reload();
        }
    };

    return {
        user,
        accounts,
        transactions,
        trips,
        budgets,
        goals,
        familyMembers,
        assets,
        snapshots,
        customCategories,
        isLoading,
        isRefetching,
        handlers: {
            handleLogin,
            handleLogout,
            handleAddTransaction,
            handleUpdateTransaction,
            handleDeleteTransaction,
            handleAnticipateInstallments,
            handleAddAccount,
            handleUpdateAccount,
            handleDeleteAccount,
            handleAddTrip,
            handleUpdateTrip,
            handleDeleteTrip,
            handleAddMember,
            handleDeleteMember,
            handleAddCategory,
            handleDeleteCategory,
            handleAddBudget,
            handleUpdateBudget,
            handleDeleteBudget,
            handleAddGoal,
            handleUpdateGoal,
            handleDeleteGoal,
            handleAddAsset,
            handleUpdateAsset,
            handleDeleteAsset,
            handleImportData, 
            handleResetSystem
        }
    };
};