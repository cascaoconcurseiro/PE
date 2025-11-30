import { useState, useEffect, useCallback, useRef } from 'react';
import { supabaseService } from '../services/supabaseService';
import { db } from '../services/db'; // Keeping Dexie only for migration source
import { 
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, 
    CustomCategory, SyncStatus, UserProfile, Snapshot
} from '../types';
import { parseDate } from '../utils';
import { useToast } from '../components/ui/Toast';

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
    const isInitialized = useRef(false);

    // --- FETCH DATA FROM SUPABASE ---
    const fetchData = useCallback(async (forceLoading = false) => {
        if (!isInitialized.current || forceLoading) {
            setIsLoading(true);
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
            // Silent error on fetch to avoid spamming, or maybe a single toast
        } finally {
            setIsLoading(false);
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

            await supabaseService.bulkCreate('transactions', txsToCreate);
        }, 'Transação salva com sucesso!');
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await performOperation(async () => {
            await supabaseService.update('transactions', { ...updatedTx, updatedAt: new Date().toISOString() });
        }, 'Transação atualizada!');
    };

    const handleDeleteTransaction = async (id: string) => {
        await performOperation(async () => {
            await supabaseService.delete('transactions', id);
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
        }, 'Parcelas antecipadas com sucesso!');
    };

    // --- GENERIC HANDLERS ---
    const handleAddAccount = async (acc: any) => performOperation(async () => { await supabaseService.create('accounts', { ...acc, id: crypto.randomUUID() }); }, 'Conta criada!');
    const handleUpdateAccount = async (acc: any) => performOperation(async () => { await supabaseService.update('accounts', acc); }, 'Conta atualizada!');
    const handleDeleteAccount = async (id: string) => performOperation(async () => { await supabaseService.delete('accounts', id); }, 'Conta excluída.');

    const handleAddTrip = async (trip: any) => performOperation(async () => { await supabaseService.create('trips', { ...trip, id: crypto.randomUUID() }); }, 'Viagem criada!');
    const handleUpdateTrip = async (trip: any) => performOperation(async () => { await supabaseService.update('trips', trip); }, 'Viagem atualizada!');
    const handleDeleteTrip = async (id: string) => performOperation(async () => { await supabaseService.delete('trips', id); }, 'Viagem excluída.');

    const handleAddMember = async (m: any) => performOperation(async () => { await supabaseService.create('family_members', { ...m, id: crypto.randomUUID() }); }, 'Membro adicionado!');
    const handleDeleteMember = async (id: string) => performOperation(async () => { await supabaseService.delete('family_members', id); }, 'Membro removido.');

    const handleAddCategory = async (name: string) => performOperation(async () => { await supabaseService.create('custom_categories', { id: crypto.randomUUID(), name }); }, 'Categoria adicionada!');
    const handleDeleteCategory = async (id: string) => performOperation(async () => { await supabaseService.delete('custom_categories', id); }, 'Categoria removida.');

    const handleAddBudget = async (b: any) => performOperation(async () => { await supabaseService.create('budgets', { ...b, id: crypto.randomUUID() }); }, 'Orçamento salvo!');
    const handleUpdateBudget = async (b: any) => performOperation(async () => { await supabaseService.update('budgets', b); }, 'Orçamento atualizado!');
    const handleDeleteBudget = async (id: string) => performOperation(async () => { await supabaseService.delete('budgets', id); }, 'Orçamento removido.');

    const handleAddGoal = async (g: any) => performOperation(async () => { await supabaseService.create('goals', { ...g, id: crypto.randomUUID() }); }, 'Meta criada!');
    const handleUpdateGoal = async (g: any) => performOperation(async () => { await supabaseService.update('goals', g); }, 'Meta atualizada!');
    const handleDeleteGoal = async (id: string) => performOperation(async () => { await supabaseService.delete('goals', id); }, 'Meta excluída.');

    const handleAddAsset = async (a: any) => performOperation(async () => { await supabaseService.create('assets', { ...a, id: crypto.randomUUID() }); }, 'Ativo adicionado!');
    const handleUpdateAsset = async (a: any) => performOperation(async () => { await supabaseService.update('assets', a); }, 'Ativo atualizado!');
    const handleDeleteAsset = async (id: string) => performOperation(async () => { await supabaseService.delete('assets', id); }, 'Ativo removido.');

    const handleAddSnapshot = async (s: any) => performOperation(async () => { await supabaseService.create('snapshots', { ...s, id: crypto.randomUUID() }); });

    // --- MIGRATION TOOL ---
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

            if (localAccounts.length) await supabaseService.bulkCreate('accounts', localAccounts);
            if (localTxs.length) await supabaseService.bulkCreate('transactions', localTxs);
            if (localTrips.length) await supabaseService.bulkCreate('trips', localTrips);
            if (localFamily.length) await supabaseService.bulkCreate('family_members', localFamily);
            if (localGoals.length) await supabaseService.bulkCreate('goals', localGoals);
            if (localBudgets.length) await supabaseService.bulkCreate('budgets', localBudgets);
            if (localAssets.length) await supabaseService.bulkCreate('assets', localAssets);
            if (localCats.length) await supabaseService.bulkCreate('custom_categories', localCats);
            if (localSnaps.length) await supabaseService.bulkCreate('snapshots', localSnaps);

            addToast("Migração concluída com sucesso!", 'success');
            refresh();
        } catch (e: any) {
            console.error(e);
            addToast(`Erro na migração: ${e.message}`, 'error');
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetSystem = async () => {
        if (confirm("Isso apagará os dados LOCAIS (Dexie). Continuar?")) {
            await db.delete();
            window.location.reload();
        }
    };

    return {
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading,
        handlers: {
            handleLogin, handleLogout,
            handleAddTransaction, handleUpdateTransaction, handleDeleteTransaction, handleAnticipateInstallments,
            handleAddAccount, handleUpdateAccount, handleDeleteAccount,
            handleAddTrip, handleUpdateTrip, handleDeleteTrip,
            handleAddMember, handleDeleteMember,
            handleAddCategory, handleDeleteCategory,
            handleAddBudget, handleUpdateBudget, handleDeleteBudget,
            handleAddGoal, handleUpdateGoal, handleDeleteGoal,
            handleAddAsset, handleUpdateAsset, handleDeleteAsset,
            handleAddSnapshot, // Exposed
            handleImportData, handleResetSystem
        }
    };
};