import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, CustomCategory, SyncStatus, UserProfile, AccountType, Category, TransactionType, Snapshot } from '../types';
import { parseDate } from '../utils';
import { BackupSchema } from '../services/schemas';

export const useDataStore = () => {
    // --- LIVE QUERIES ---
    const user = useLiveQuery(() => db.userProfile.toCollection().first(), []);
    const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deleted).toArray(), []);
    const transactions = useLiveQuery(() => db.transactions.filter(t => !t.deleted).toArray(), []);
    const trips = useLiveQuery(() => db.trips.filter(t => !t.deleted).toArray(), []);
    const budgets = useLiveQuery(() => db.budgets.filter(b => !b.deleted).toArray(), []);
    const goals = useLiveQuery(() => db.goals.filter(g => !g.deleted).toArray(), []);
    const familyMembers = useLiveQuery(() => db.familyMembers.filter(f => !f.deleted).toArray(), []);
    const assets = useLiveQuery(() => db.assets.filter(a => !a.deleted).toArray(), []);
    const snapshots = useLiveQuery(() => db.snapshots.toArray(), []);

    // Local Storage for non-critical data
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_categories') || '[]'); } catch { return []; }
    });

    // --- HANDLERS ---

    const handleLogin = async (user: UserProfile) => {
        await db.userProfile.add(user);
    };

    const handleLogout = async () => {
        await db.userProfile.clear();
        window.location.reload();
    };

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        const newTransactionsList: Transaction[] = [];
        const now = new Date().toISOString();

        if (newTx.isInstallment && newTx.totalInstallments && newTx.totalInstallments > 1) {
            const baseDate = parseDate(newTx.date);
            const seriesId = crypto.randomUUID();

            for (let i = 0; i < newTx.totalInstallments; i++) {
                const nextDate = new Date(baseDate);
                nextDate.setMonth(baseDate.getMonth() + i);

                if (baseDate.getDate() > 28) {
                    const daysInTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                    nextDate.setDate(Math.min(baseDate.getDate(), daysInTargetMonth));
                }

                newTransactionsList.push({
                    ...newTx,
                    id: crypto.randomUUID(),
                    seriesId: seriesId,
                    date: nextDate.toISOString().split('T')[0],
                    currentInstallment: (newTx.currentInstallment || 1) + i,
                    description: newTx.description,
                    createdAt: now,
                    updatedAt: now,
                    syncStatus: SyncStatus.PENDING
                });
            }
        } else {
            newTransactionsList.push({
                ...newTx,
                id: crypto.randomUUID(),
                createdAt: now,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING
            });
        }

        await db.transactions.bulkAdd(newTransactionsList);
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await db.transactions.put({
            ...updatedTx,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteTransaction = async (id: string) => {
        const tx = await db.transactions.get(id);
        if (tx) {
            await db.transactions.put({
                ...tx,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
    };

    const handleAnticipateInstallments = async (idsToAnticipate: string[], targetDate: string) => {
        await db.transaction('rw', db.transactions, async () => {
            const txs = await db.transactions.bulkGet(idsToAnticipate);
            const updates = txs.filter(t => t).map(t => ({
                ...t!,
                date: targetDate,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            }));
            await db.transactions.bulkPut(updates);
        });
    };

    const handleAddAccount = async (newAccount: Omit<Account, 'id'>) => {
        const now = new Date().toISOString();
        const account: Account = {
            ...newAccount,
            id: (newAccount as any).id || crypto.randomUUID(),
            initialBalance: newAccount.initialBalance !== undefined ? newAccount.initialBalance : (newAccount.balance || 0),
            balance: newAccount.balance || 0,
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        };
        await db.accounts.add(account);
    };

    const handleUpdateAccount = async (updatedAccount: Account) => {
        await db.accounts.put({
            ...updatedAccount,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteAccount = async (id: string) => {
        const count = await db.transactions.where('accountId').equals(id).or('destinationAccountId').equals(id).count();
        if (count > 0) {
            alert('Não é possível excluir esta conta pois existem transações associadas a ela. Exclua as transações primeiro.');
            return;
        }
        if (confirm('Tem certeza que deseja excluir esta conta?')) {
            const acc = await db.accounts.get(id);
            if (acc) {
                await db.accounts.put({
                    ...acc,
                    deleted: true,
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING
                });
            }
        }
    };

    const handleAddTrip = async (newTrip: Trip) => {
        const now = new Date().toISOString();
        await db.trips.put({
            ...newTrip,
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleUpdateTrip = async (updatedTrip: Trip) => {
        await db.trips.put({
            ...updatedTrip,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteTrip = async (id: string) => {
        const trip = await db.trips.get(id);
        if (trip) {
            await db.trips.put({
                ...trip,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
    };

    const handleAddMember = async (newMember: Omit<FamilyMember, 'id'>) => {
        const now = new Date().toISOString();
        await db.familyMembers.add({
            ...newMember,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteMember = async (id: string) => {
        const member = await db.familyMembers.get(id);
        if (member) {
            await db.familyMembers.put({
                ...member,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
    };

    const handleAddCategory = (name: string) => {
        const newCat: CustomCategory = {
            id: crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        };
        const updated = [...customCategories, newCat];
        setCustomCategories(updated);
        localStorage.setItem('pdm_categories', JSON.stringify(updated));
    };

    const handleDeleteCategory = (id: string) => {
        const updated = customCategories.filter(c => c.id !== id);
        setCustomCategories(updated);
        localStorage.setItem('pdm_categories', JSON.stringify(updated));
    };

    const handleAddBudget = async (newBudget: Omit<Budget, 'id'>) => {
        const now = new Date().toISOString();
        await db.budgets.add({
            ...newBudget,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleUpdateBudget = async (updatedBudget: Budget) => {
        await db.budgets.put({
            ...updatedBudget,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteBudget = async (id: string) => {
        const budget = await db.budgets.get(id);
        if (budget) {
            await db.budgets.put({
                ...budget,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
    };

    const handleAddGoal = async (newGoal: Omit<Goal, 'id'>) => {
        const now = new Date().toISOString();
        await db.goals.add({
            ...newGoal,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleUpdateGoal = async (updatedGoal: Goal) => {
        await db.goals.put({
            ...updatedGoal,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteGoal = async (id: string) => {
        const goal = await db.goals.get(id);
        if (goal) {
            await db.goals.put({
                ...goal,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
    };

    const handleAddAsset = async (asset: Omit<Asset, 'id'>) => {
        const now = new Date().toISOString();
        await db.assets.add({
            ...asset,
            id: crypto.randomUUID(),
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleUpdateAsset = async (asset: Asset) => {
        await db.assets.put({
            ...asset,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteAsset = async (id: string) => {
        const asset = await db.assets.get(id);
        if (asset) {
            await db.assets.put({
                ...asset,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
    };

    const handleImportData = async (data: any) => {
        // Validate Data Schema
        const result = BackupSchema.safeParse(data);
        if (!result.success) {
            console.error("Validation Error:", result.error);
            alert("O arquivo de backup contém dados inválidos ou corrompidos. A importação foi cancelada.");
            return;
        }

        const validData = result.data;

        await db.transaction('rw', [db.accounts, db.transactions, db.trips, db.budgets, db.goals, db.familyMembers, db.assets, db.snapshots], async () => {
            if (validData.accounts) await db.accounts.bulkPut(validData.accounts as Account[]);
            if (validData.transactions) await db.transactions.bulkPut(validData.transactions as Transaction[]);
            if (validData.trips) await db.trips.bulkPut(validData.trips as unknown as Trip[]);
            if (validData.budgets) await db.budgets.bulkPut(validData.budgets as unknown as Budget[]);
            if (validData.goals) await db.goals.bulkPut(validData.goals as unknown as Goal[]);
            if (validData.familyMembers) await db.familyMembers.bulkPut(validData.familyMembers as unknown as FamilyMember[]);
            if (validData.assets) await db.assets.bulkPut(validData.assets as unknown as Asset[]);
            if (validData.snapshots) await db.snapshots.bulkPut(validData.snapshots as unknown as Snapshot[]);
        });
        if (validData.customCategories) {
            setCustomCategories(validData.customCategories as unknown as CustomCategory[]);
            localStorage.setItem('pdm_categories', JSON.stringify(validData.customCategories));
        }
        alert('Dados restaurados com sucesso!');
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