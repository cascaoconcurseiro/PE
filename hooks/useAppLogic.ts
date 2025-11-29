import { useEffect, useRef } from 'react';
import { db } from '../services/db';
import { convertToBRL } from '../services/currencyService';
import { processRecurringTransactions } from '../services/recurrenceEngine';
import { checkDataConsistency } from '../services/financialLogic';
import { parseDate } from '../utils';
import { Account, Transaction, Asset, AccountType, TransactionType, Frequency, SyncStatus } from '../types';

interface UseAppLogicProps {
    accounts?: Account[];
    transactions?: Transaction[];
    assets?: Asset[];
    isMigrating: boolean;
}

export const useAppLogic = ({ accounts, transactions, assets, isMigrating }: UseAppLogicProps) => {
    const hasCheckedRecurrence = useRef(false);
    const hasCheckedReminders = useRef(false);
    const hasCheckedConsistency = useRef(false);

    // --- DATA CONSISTENCY CHECK ---
    useEffect(() => {
        if (isMigrating || !accounts || !transactions || hasCheckedConsistency.current) return;

        const issues = checkDataConsistency(accounts, transactions);
        
        if (issues.length > 0) {
            console.warn("Inconsistências encontradas nos dados:", issues);
            // In a real app, we might want to auto-fix or alert user. 
            // For now, logging allows developers to debug.
        }
        
        hasCheckedConsistency.current = true;
    }, [isMigrating, accounts, transactions]);

    // --- SNAPSHOT ENGINE ---
    useEffect(() => {
        const createSnapshot = async () => {
            if (!accounts || !assets || !transactions) return;

            const today = new Date().toISOString().split('T')[0];
            const existingSnapshot = await db.snapshots.where('date').equals(today).first();

            if (!existingSnapshot) {
                // 1. Total Balance (Banking)
                const totalBalance = accounts.filter(a => a.type !== AccountType.CREDIT_CARD).reduce((acc, curr) => acc + curr.balance, 0);

                // 2. Total Debt (Credit Cards Committed)
                const totalDebt = accounts.filter(a => a.type === AccountType.CREDIT_CARD).reduce((acc, account) => {
                    const allAccountTxs = transactions.filter(t => t.accountId === account.id);
                    const debt = allAccountTxs.reduce((sum, t) => {
                        if (t.isRefund) return sum + t.amount;
                        if (t.type === TransactionType.EXPENSE || (t.type === TransactionType.TRANSFER && !t.destinationAccountId)) return sum - t.amount;
                        if (t.type === TransactionType.INCOME) return sum + t.amount;
                        if (t.type === TransactionType.TRANSFER && t.destinationAccountId) return sum - t.amount;
                        return sum;
                    }, 0);
                    return acc + Math.abs(debt + (account.initialBalance || 0));
                }, 0);

                // 3. Total Invested (Converted to BRL)
                let totalInvested = 0;
                if (assets) {
                    assets.forEach(asset => {
                        totalInvested += convertToBRL(asset.quantity * asset.currentPrice, asset.currency);
                    });
                }

                const netWorth = totalBalance + totalInvested - totalDebt;

                await db.snapshots.add({
                    id: crypto.randomUUID(),
                    date: today,
                    totalBalance,
                    totalInvested,
                    totalDebt,
                    netWorth
                });
                console.log("Daily snapshot created for", today);
            }
        };

        createSnapshot();
    }, [accounts, assets, transactions]);

    // --- RECURRING TRANSACTION GENERATOR ---
    useEffect(() => {
        if (isMigrating || !transactions?.length || hasCheckedRecurrence.current) return;

        const runRecurringEngine = async () => {
            const now = new Date();
            const newTxList: Transaction[] = [];
            const updates: Transaction[] = [];

            transactions.forEach(t => {
                if (t.isRecurring) {
                    let lastGen = parseDate(t.lastGenerated || t.date);

                    // Helper to calculate next date
                    const getNextDate = (base: Date): Date => {
                        const next = new Date(base);
                        switch (t.frequency) {
                            case Frequency.WEEKLY: next.setDate(next.getDate() + 7); break;
                            case Frequency.YEARLY: next.setFullYear(next.getFullYear() + 1); break;
                            case Frequency.MONTHLY:
                            default:
                                next.setMonth(next.getMonth() + 1);
                                if (t.recurrenceDay) {
                                    const year = next.getFullYear();
                                    const month = next.getMonth();
                                    const daysInMonth = new Date(year, month + 1, 0).getDate();
                                    next.setDate(Math.min(t.recurrenceDay, daysInMonth));
                                }
                                break;
                        }
                        return next;
                    };

                    let nextDue = getNextDate(lastGen);
                    let hasUpdates = false;
                    let latestGenDate = lastGen;

                    // Catch up loop: generate ALL missing transactions up to today
                    while (now >= nextDue) {
                        const newTx: Transaction = {
                            ...t,
                            id: crypto.randomUUID(),
                            date: nextDue.toISOString().split('T')[0],
                            description: `${t.description.replace(' (Recorrente)', '')} (Recorrente)`,
                            lastGenerated: nextDue.toISOString(),
                            createdAt: new Date().toISOString(),
                            updatedAt: new Date().toISOString(),
                            syncStatus: SyncStatus.PENDING
                        };
                        newTxList.push(newTx);

                        latestGenDate = nextDue;
                        nextDue = getNextDate(nextDue);
                        hasUpdates = true;
                    }

                    if (hasUpdates) {
                        updates.push({
                            ...t,
                            lastGenerated: latestGenDate.toISOString(),
                            updatedAt: new Date().toISOString(),
                            syncStatus: SyncStatus.PENDING
                        });
                    }
                }
            });

            if (newTxList.length > 0) {
                await db.transaction('rw', db.transactions, async () => {
                    await db.transactions.bulkAdd(newTxList);
                    await db.transactions.bulkPut(updates);
                });
            }
            hasCheckedRecurrence.current = true;
        };

        const timer = setTimeout(runRecurringEngine, 1000);
        return () => clearTimeout(timer);
    }, [isMigrating, transactions?.length]);

    // --- NOTIFICATION ENGINE ---
    useEffect(() => {
        if (!('Notification' in window)) return;

        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        if (isMigrating || !transactions?.length || hasCheckedReminders.current) return;

        const checkReminders = () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const reminders = transactions.filter(t =>
                t.enableNotification &&
                t.notificationDate === todayStr
            );

            if (reminders.length > 0) {
                if (Notification.permission === 'granted') {
                    if (reminders.length > 3) {
                        new Notification("Lembretes do Dia", {
                            body: `Você tem ${reminders.length} contas vencendo hoje. Total: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(reminders.reduce((acc, t) => acc + t.amount, 0))}`,
                        });
                    } else {
                        reminders.forEach(r => {
                            new Notification(`Lembrete: ${r.description}`, {
                                body: `Valor: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.amount)}`,
                            });
                        });
                    }
                }
            }
            hasCheckedReminders.current = true;
        };

        const timer = setTimeout(checkReminders, 3000);
        return () => clearTimeout(timer);
    }, [isMigrating, transactions]);
};