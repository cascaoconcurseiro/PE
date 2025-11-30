import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../services/db';
import { Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, CustomCategory, SyncStatus, UserProfile, TransactionType, Snapshot, AuditLog } from '../types';
import { parseDate } from '../utils';
import { BackupSchema } from '../services/schemas';

export const useDataStore = () => {
    // --- LIVE QUERIES (All data comes from DB, no localStorage for core data) ---
    const user = useLiveQuery(() => db.userProfile.toCollection().first(), []);
    const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deleted).toArray(), []);
    const transactions = useLiveQuery(() => db.transactions.filter(t => !t.deleted).toArray(), []);
    const trips = useLiveQuery(() => db.trips.filter(t => !t.deleted).toArray(), []);
    const budgets = useLiveQuery(() => db.budgets.filter(b => !b.deleted).toArray(), []);
    const goals = useLiveQuery(() => db.goals.filter(g => !g.deleted).toArray(), []);
    const familyMembers = useLiveQuery(() => db.familyMembers.filter(f => !f.deleted).toArray(), []);
    const assets = useLiveQuery(() => db.assets.filter(a => !a.deleted).toArray(), []);
    const snapshots = useLiveQuery(() => db.snapshots.toArray(), []);
    const customCategories = useLiveQuery(() => db.customCategories.filter(c => !c.deleted).toArray(), []);

    // --- AUDIT HELPER ---
    const logAudit = async (entity: AuditLog['entity'], entityId: string, action: AuditLog['action'], changes: any) => {
        try {
            await db.auditLogs.add({
                id: crypto.randomUUID(),
                entity,
                entityId,
                action,
                changes: JSON.stringify(changes),
                createdAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        } catch (e) {
            console.error("Audit Log Error:", e);
        }
    };

    // --- HANDLERS ---

    const handleLogin = async (user: UserProfile) => {
        await db.userProfile.put(user);
    };

    const handleLogout = async () => {
        await db.userProfile.clear();
        window.location.reload();
    };

    const handleAddTransaction = async (newTx: Omit<Transaction, 'id'>) => {
        const newTransactionsList: Transaction[] = [];
        const now = new Date().toISOString();

        const totalInstallments = Number(newTx.totalInstallments);

        if (newTx.isInstallment && totalInstallments > 1) {
            const baseDate = parseDate(newTx.date);
            const seriesId = crypto.randomUUID();
            // Calculate base installment amount (floored to 2 decimals)
            const baseInstallmentValue = Math.floor((newTx.amount / totalInstallments) * 100) / 100;
            let accumulatedAmount = 0;

            for (let i = 0; i < totalInstallments; i++) {
                // FIX: Prevent month skipping for dates like Jan 31
                // Step 1: Create date at day 1 of base month
                const nextDate = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1);

                // Step 2: Add months safely
                nextDate.setMonth(nextDate.getMonth() + i);

                // Step 3: Set the day, capping at month's max days
                const targetDay = baseDate.getDate();
                const daysInTargetMonth = new Date(nextDate.getFullYear(), nextDate.getMonth() + 1, 0).getDate();
                nextDate.setDate(Math.min(targetDay, daysInTargetMonth));

                // Preserve time from baseDate
                nextDate.setHours(baseDate.getHours(), baseDate.getMinutes(), baseDate.getSeconds(), baseDate.getMilliseconds());

                // Calculate specific amount for this installment
                let currentAmount = baseInstallmentValue;

                // If it's the last installment, adjust the amount to match total exactly
                if (i === totalInstallments - 1) {
                    currentAmount = Number((newTx.amount - accumulatedAmount).toFixed(2));
                }

                accumulatedAmount += currentAmount;

                // Adjust shared amounts proportionally if needed (simplified for now, ideally should follow same logic)
                const currentSharedWith = newTx.sharedWith?.map(s => ({
                    ...s,
                    assignedAmount: Number(((s.assignedAmount / newTx.amount) * currentAmount).toFixed(2))
                }));

                newTransactionsList.push({
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

        await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
            await db.transactions.bulkAdd(newTransactionsList);
            if (newTransactionsList.length > 0) {
                await logAudit('TRANSACTION', newTransactionsList[0].id, 'CREATE', newTx);
            }
        });
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        const oldTx = await db.transactions.get(updatedTx.id);

        await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
            await db.transactions.put({
                ...updatedTx,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
            await logAudit('TRANSACTION', updatedTx.id, 'UPDATE', { from: oldTx, to: updatedTx });
        });
    };

    const handleDeleteTransaction = async (id: string) => {
        const tx = await db.transactions.get(id);
        if (tx) {
            let deleteAll = false;
            if (tx.seriesId || tx.isRecurring) {
                if (tx.seriesId) {
                    deleteAll = true;
                }
            }

            await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
                if (deleteAll && tx.seriesId) {
                    const related = await db.transactions.where('seriesId').equals(tx.seriesId).toArray();
                    const updates = related.map(t => ({
                        ...t,
                        deleted: true,
                        updatedAt: new Date().toISOString(),
                        syncStatus: SyncStatus.PENDING
                    }));
                    await db.transactions.bulkPut(updates as Transaction[]);
                    await logAudit('TRANSACTION', tx.seriesId, 'DELETE', { count: updates.length, type: 'SERIES' });
                } else {
                    await db.transactions.put({
                        ...tx,
                        deleted: true,
                        updatedAt: new Date().toISOString(),
                        syncStatus: SyncStatus.PENDING
                    });
                    await logAudit('TRANSACTION', id, 'DELETE', tx);
                }
            });
        }
    };

    const handleAnticipateInstallments = async (idsToAnticipate: string[], targetDate: string, targetAccountId?: string) => {
        await db.transaction('rw', [db.transactions, db.auditLogs], async () => {
            const txs = await db.transactions.bulkGet(idsToAnticipate);
            const updates = txs
                .filter((t): t is Transaction => !!t)
                .map(t => ({
                    ...t,
                    date: targetDate, // Move to target date (usually today)
                    accountId: targetAccountId || t.accountId, // Update account if provided
                    description: t.description.includes('(Antecipado)') ? t.description : `${t.description} (Antecipado)`,
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING
                }));

            if (updates.length > 0) {
                await db.transactions.bulkPut(updates);
                await logAudit('TRANSACTION', 'BATCH', 'UPDATE', { action: 'ANTICIPATE', count: updates.length, targetDate, targetAccountId });
            }
        });
    };

    const handleAddAccount = async (newAccount: Omit<Account, 'id'>) => {
        const now = new Date().toISOString();
        const accountId = (newAccount as any).id || crypto.randomUUID();
        const initialBalance = newAccount.initialBalance !== undefined ? newAccount.initialBalance : (newAccount.balance || 0);

        const account: Account = {
            ...newAccount,
            id: accountId,
            initialBalance: initialBalance,
            balance: initialBalance,
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        };

        await db.transaction('rw', [db.accounts, db.auditLogs], async () => {
            await db.accounts.put(account);
            await logAudit('ACCOUNT', accountId, 'CREATE', newAccount);
        });
    };

    const handleUpdateAccount = async (updatedAccount: Account) => {
        const old = await db.accounts.get(updatedAccount.id);
        await db.transaction('rw', [db.accounts, db.auditLogs], async () => {
            await db.accounts.put({
                ...updatedAccount,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
            await logAudit('ACCOUNT', updatedAccount.id, 'UPDATE', { from: old, to: updatedAccount });
        });
    };

    const handleDeleteAccount = async (id: string) => {
        const count = await db.transactions.where('accountId').equals(id).or('destinationAccountId').equals(id).count();
        if (count > 0) {
            alert('Não é possível excluir esta conta pois existem transações associadas a ela. Exclua as transações primeiro.');
            return;
        }
        const acc = await db.accounts.get(id);
        if (acc) {
            await db.transaction('rw', [db.accounts, db.auditLogs], async () => {
                await db.accounts.put({
                    ...acc,
                    deleted: true,
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING
                });
                await logAudit('ACCOUNT', id, 'DELETE', acc);
            });
        }
    };

    const handleAddTrip = async (newTrip: Trip) => {
        const now = new Date().toISOString();
        await db.transaction('rw', [db.trips, db.auditLogs], async () => {
            await db.trips.put({
                ...newTrip,
                createdAt: now,
                updatedAt: now,
                syncStatus: SyncStatus.PENDING
            });
            await logAudit('TRIP', newTrip.id, 'CREATE', newTrip);
        });
    };

    const handleUpdateTrip = async (updatedTrip: Trip) => {
        await db.transaction('rw', [db.trips, db.auditLogs], async () => {
            await db.trips.put({
                ...updatedTrip,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
            await logAudit('TRIP', updatedTrip.id, 'UPDATE', updatedTrip);
        });
    };

    const handleDeleteTrip = async (id: string) => {
        const trip = await db.trips.get(id);
        if (trip) {
            await db.transaction('rw', [db.trips, db.auditLogs], async () => {
                await db.trips.put({
                    ...trip,
                    deleted: true,
                    updatedAt: new Date().toISOString(),
                    syncStatus: SyncStatus.PENDING
                });
                await logAudit('TRIP', id, 'DELETE', trip);
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

    const handleAddCategory = async (name: string) => {
        const now = new Date().toISOString();
        await db.customCategories.add({
            id: crypto.randomUUID(),
            name,
            createdAt: now,
            updatedAt: now,
            syncStatus: SyncStatus.PENDING
        });
    };

    const handleDeleteCategory = async (id: string) => {
        const cat = await db.customCategories.get(id);
        if (cat) {
            await db.customCategories.put({
                ...cat,
                deleted: true,
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.PENDING
            });
        }
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
        await logAudit('BUDGET', 'new', 'CREATE', newBudget);
    };

    const handleUpdateBudget = async (updatedBudget: Budget) => {
        await db.budgets.put({
            ...updatedBudget,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
        await logAudit('BUDGET', updatedBudget.id, 'UPDATE', updatedBudget);
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
            await logAudit('BUDGET', id, 'DELETE', budget);
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
        await logAudit('GOAL', 'new', 'CREATE', newGoal);
    };

    const handleUpdateGoal = async (updatedGoal: Goal) => {
        await db.goals.put({
            ...updatedGoal,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
        await logAudit('GOAL', updatedGoal.id, 'UPDATE', updatedGoal);
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
            await logAudit('GOAL', id, 'DELETE', goal);
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

        await db.transaction('rw', [db.accounts, db.transactions, db.trips, db.budgets, db.goals, db.familyMembers, db.assets, db.snapshots, db.auditLogs, db.customCategories], async () => {
            if (validData.accounts) await db.accounts.bulkPut(validData.accounts as Account[]);
            if (validData.transactions) await db.transactions.bulkPut(validData.transactions as Transaction[]);
            if (validData.trips) await db.trips.bulkPut(validData.trips as unknown as Trip[]);
            if (validData.budgets) await db.budgets.bulkPut(validData.budgets as unknown as Budget[]);
            if (validData.goals) await db.goals.bulkPut(validData.goals as unknown as Goal[]);
            if (validData.familyMembers) await db.familyMembers.bulkPut(validData.familyMembers as unknown as FamilyMember[]);
            if (validData.assets) await db.assets.bulkPut(validData.assets as unknown as Asset[]);
            if (validData.snapshots) await db.snapshots.bulkPut(validData.snapshots as unknown as Snapshot[]);
            if (validData.customCategories) await db.customCategories.bulkPut(validData.customCategories as unknown as CustomCategory[]);

            await logAudit('ACCOUNT', 'SYSTEM', 'UPDATE', { action: 'IMPORT_DATA', timestamp: new Date().toISOString() });
        });

        alert('Dados restaurados com sucesso!');
    };

    const handleResetSystem = async () => {
        try {
            await db.transaction('rw', db.tables, async () => {
                // Clear all tables except userProfile (to keep login)
                const clearPromises = db.tables.map(table => {
                    if (table.name !== 'userProfile') {
                        return table.clear();
                    }
                    return Promise.resolve();
                });
                await Promise.all(clearPromises);

                // Log the reset (will be the only log)
                await logAudit('ACCOUNT', 'SYSTEM', 'DELETE', { action: 'RESET_SYSTEM', timestamp: new Date().toISOString() });
            });

            window.location.reload();
        } catch (error) {
            console.error("Failed to reset system:", error);
            alert("Erro ao resetar o sistema. Tente novamente.");
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
        customCategories: customCategories || [],
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