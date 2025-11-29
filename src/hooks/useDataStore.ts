import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../integrations/supabase/client';
import { Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, CustomCategory, UserProfile, SyncStatus } from '../types';
import { parseDate } from '../utils';

export const useDataStore = () => {
    // --- STATE ---
    const [user, setUser] = useState<UserProfile | null>(null);
    const [accounts, setAccounts] = useState<Account[]>([]);
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [trips, setTrips] = useState<Trip[]>([]);
    const [budgets, setBudgets] = useState<Budget[]>([]);
    const [goals, setGoals] = useState<Goal[]>([]);
    const [familyMembers, setFamilyMembers] = useState<FamilyMember[]>([]);
    const [assets, setAssets] = useState<Asset[]>([]);
    const [snapshots, setSnapshots] = useState<any[]>([]); // Snapshots not fully migrated yet
    const [isLoading, setIsLoading] = useState(true);

    const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_categories') || '[]'); } catch { return []; }
    });

    // --- FETCH DATA ---
    const fetchData = useCallback(async () => {
        if (!user) return;
        setIsLoading(true);

        const [accRes, txRes, tripRes, budgetRes, goalRes, famRes, assetRes] = await Promise.all([
            supabase.from('accounts').select('*'),
            supabase.from('transactions').select('*'),
            supabase.from('trips').select('*'),
            supabase.from('budgets').select('*'),
            supabase.from('goals').select('*'),
            supabase.from('family_members').select('*'),
            supabase.from('assets').select('*')
        ]);

        if (accRes.data) setAccounts(accRes.data as any);
        if (txRes.data) setTransactions(txRes.data as any);
        if (tripRes.data) setTrips(tripRes.data as any);
        if (budgetRes.data) setBudgets(budgetRes.data as any);
        if (goalRes.data) setGoals(goalRes.data as any);
        if (famRes.data) setFamilyMembers(famRes.data as any);
        if (assetRes.data) setAssets(assetRes.data as any);
        
        setIsLoading(false);
    }, [user]);

    // Initial Fetch on User Change
    useEffect(() => {
        if (user) {
            fetchData();
        } else {
            // Reset data on logout
            setAccounts([]);
            setTransactions([]);
            setTrips([]);
            // ... reset others
        }
    }, [user, fetchData]);

    // --- HANDLERS (SUPABASE IMPLEMENTATION) ---

    const handleLogin = async (loggedInUser: UserProfile) => {
        setUser(loggedInUser);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        setUser(null);
        window.location.reload();
    };

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        if (!user) return;
        
        const now = new Date().toISOString();
        const txToInsert = {
            ...newTx,
            user_id: user.id,
            account_id: newTx.accountId, // Map camelCase to snake_case for DB
            destination_account_id: newTx.destinationAccountId,
            trip_id: newTx.tripId,
            is_recurring: newTx.isRecurring,
            recurrence_day: newTx.recurrenceDay,
            last_generated: newTx.lastGenerated,
            is_installment: newTx.isInstallment,
            current_installment: newTx.currentInstallment,
            total_installments: newTx.totalInstallments,
            series_id: newTx.seriesId,
            enable_notification: newTx.enableNotification,
            notification_date: newTx.notificationDate,
            is_shared: newTx.isShared,
            shared_with: newTx.sharedWith,
            payer_id: newTx.payerId,
            related_member_id: newTx.relatedMemberId,
            is_refund: newTx.isRefund,
            is_settled: newTx.isSettled,
            settled_at: newTx.settledAt,
            created_at: now,
            updated_at: now
        };

        // Handle Installments Generation Logic if needed (simplified for now: user handles one by one or we improve backend logic)
        // For now, let's just insert the single transaction provided
        
        const { data, error } = await supabase.from('transactions').insert(txToInsert).select().single();
        
        if (!error && data) {
            setTransactions(prev => [...prev, { ...newTx, id: data.id } as Transaction]);
            // Optimistic update or refetch? Let's refetch for consistency for now
            fetchData(); 
        } else {
            console.error("Error adding transaction:", error);
            alert("Erro ao salvar transação. Verifique a conexão.");
        }
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        if (!user) return;
        
        const txToUpdate = {
            amount: updatedTx.amount,
            description: updatedTx.description,
            date: updatedTx.date,
            category: updatedTx.category,
            account_id: updatedTx.accountId,
            destination_account_id: updatedTx.destinationAccountId,
            trip_id: updatedTx.tripId,
            is_shared: updatedTx.isShared,
            shared_with: updatedTx.sharedWith,
            is_settled: updatedTx.isSettled,
            settled_at: updatedTx.settledAt,
            updated_at: new Date().toISOString()
        };

        const { error } = await supabase.from('transactions').update(txToUpdate).eq('id', updatedTx.id);
        
        if (!error) {
            setTransactions(prev => prev.map(t => t.id === updatedTx.id ? updatedTx : t));
        } else {
            console.error("Error updating:", error);
        }
    };

    const handleDeleteTransaction = async (id: string) => {
        const { error } = await supabase.from('transactions').delete().eq('id', id);
        if (!error) {
            setTransactions(prev => prev.filter(t => t.id !== id));
        }
    };

    const handleAddAccount = async (newAccount: Omit<Account, 'id'>) => {
        if (!user) return;
        const accToInsert = {
            user_id: user.id,
            name: newAccount.name,
            type: newAccount.type,
            initial_balance: newAccount.initialBalance,
            balance: newAccount.balance, // Note: Balance logic usually calculated on fly, but storing snapshot is fine
            currency: newAccount.currency,
            credit_limit: newAccount.limit,
            closing_day: newAccount.closingDay,
            due_day: newAccount.dueDay
        };

        const { data, error } = await supabase.from('accounts').insert(accToInsert).select().single();
        if (!error && data) {
            fetchData();
        }
    };

    const handleUpdateAccount = async (updatedAccount: Account) => {
        // Implement update logic mapping fields
        const { error } = await supabase.from('accounts').update({ 
            name: updatedAccount.name, 
            balance: updatedAccount.balance 
        }).eq('id', updatedAccount.id);
        if(!error) fetchData();
    };

    const handleDeleteAccount = async (id: string) => {
        const { error } = await supabase.from('accounts').delete().eq('id', id);
        if(!error) setAccounts(prev => prev.filter(a => a.id !== id));
    };

    // ... Other handlers (Simplified mapping for brevity, fully implement as needed)
    const handleAddTrip = async (trip: Trip) => {
        if(!user) return;
        await supabase.from('trips').insert({ 
            user_id: user.id, 
            name: trip.name, 
            start_date: trip.startDate,
            end_date: trip.endDate,
            budget: trip.budget,
            currency: trip.currency
        });
        fetchData();
    };
    
    const handleUpdateTrip = async (trip: Trip) => { /* Update Logic */ };
    const handleDeleteTrip = async (id: string) => { 
        await supabase.from('trips').delete().eq('id', id);
        fetchData();
    };

    const handleAddMember = async (member: Omit<FamilyMember, 'id'>) => {
        if(!user) return;
        await supabase.from('family_members').insert({ user_id: user.id, name: member.name, role: member.role });
        fetchData();
    };
    const handleDeleteMember = async (id: string) => {
        await supabase.from('family_members').delete().eq('id', id);
        fetchData();
    };

    const handleAddCategory = (name: string) => {
        const newCat: CustomCategory = { id: crypto.randomUUID(), name };
        setCustomCategories([...customCategories, newCat]);
        localStorage.setItem('pdm_categories', JSON.stringify([...customCategories, newCat]));
    };
    const handleDeleteCategory = (id: string) => {
        const updated = customCategories.filter(c => c.id !== id);
        setCustomCategories(updated);
        localStorage.setItem('pdm_categories', JSON.stringify(updated));
    };

    // Stubs for others
    const handleAddBudget = async (b: any) => { if(user) await supabase.from('budgets').insert({...b, user_id: user.id, category_id: b.categoryId}); fetchData(); };
    const handleUpdateBudget = async () => {};
    const handleDeleteBudget = async (id: string) => { await supabase.from('budgets').delete().eq('id', id); fetchData(); };
    
    const handleAddGoal = async (g: any) => { if(user) await supabase.from('goals').insert({...g, user_id: user.id, target_amount: g.targetAmount, current_amount: g.currentAmount}); fetchData(); };
    const handleUpdateGoal = async () => {};
    const handleDeleteGoal = async (id: string) => { await supabase.from('goals').delete().eq('id', id); fetchData(); };
    
    const handleAddAsset = async (a: any) => { if(user) await supabase.from('assets').insert({...a, user_id: user.id, average_price: a.averagePrice, current_price: a.currentPrice, account_id: a.accountId}); fetchData(); };
    const handleUpdateAsset = async () => {};
    const handleDeleteAsset = async (id: string) => { await supabase.from('assets').delete().eq('id', id); fetchData(); };

    const handleImportData = () => { alert("Importação via JSON não suportada na versão Nuvem."); };
    const handleAnticipateInstallments = () => {}; 

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
            handleImportData
        }
    };
};