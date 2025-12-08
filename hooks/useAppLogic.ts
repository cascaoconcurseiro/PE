import { useEffect, useRef } from 'react';
import { convertToBRL } from '../services/currencyService';
import { checkDataConsistency } from '../services/financialLogic';
import { parseDate } from '../utils';
import { Account, Transaction, Asset, AccountType, TransactionType, Frequency, SyncStatus } from '../types';

interface UseAppLogicProps {
    accounts?: Account[];
    transactions?: Transaction[];
    assets?: Asset[];
    isMigrating: boolean;
    handlers: {
        handleAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
        handleUpdateTransaction: (t: Transaction) => Promise<void>;
        // Add snapshot handler if available, or generic create
        handleAddSnapshot: (s: any) => Promise<void>;
    };
}

export const useAppLogic = ({ accounts, transactions, assets, isMigrating, handlers }: UseAppLogicProps) => {
    const hasCheckedRecurrence = useRef(false);
    const hasCheckedReminders = useRef(false);
    const hasCheckedConsistency = useRef(false);
    const hasCreatedSnapshot = useRef(false);

    // Reset refs when user logs out (accounts become empty)
    useEffect(() => {
        if (!accounts || accounts.length === 0) {
            hasCheckedRecurrence.current = false;
            hasCheckedReminders.current = false;
            hasCheckedConsistency.current = false;
            hasCreatedSnapshot.current = false;
        }
    }, [accounts?.length]);

    // --- DATA CONSISTENCY CHECK ---
    useEffect(() => {
        if (isMigrating || !accounts || !transactions || hasCheckedConsistency.current) return;

        const issues = checkDataConsistency(accounts, transactions);

        if (issues.length > 0) {
            console.warn("Inconsistências encontradas nos dados:", issues);
        }

        hasCheckedConsistency.current = true;
    }, [isMigrating, accounts, transactions]);

    // --- SNAPSHOT ENGINE (Daily Balance History) ---
    useEffect(() => {
        const createSnapshot = async () => {
            if (!accounts || !assets || !transactions || hasCreatedSnapshot.current) return;

            // Simple check to avoid re-running today
            // In a real app, we would check the DB for today's snapshot.
            // Since we don't have 'snapshots' in props here easily without drilling, 
            // we rely on a simple session ref or we should pass snapshots prop.
            // For now, we'll assume if the app loaded, we run once per session.
            
            // FIX: Format date locally to avoid timezone issues
            const now = new Date();
            const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            
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

            // Create Snapshot via Handler
            // We check if a snapshot for 'today' already exists in the 'transactions' or handled logic? 
            // Actually, snapshots are a separate table.
            // To prevent duplicates on every reload, we should ideally check existing snapshots.
            // IMPORTANT: To avoid "Blinking" loop, we strictly guard this with a ref for this session.
            
            // NOTE: In a perfect world, we check `snapshots` prop. 
            // But to fix the immediate loop, running once per session (ref) is safer than a possibly buggy DB check loop.
            
            /* 
            await handlers.handleAddSnapshot({
                id: crypto.randomUUID(),
                date: today,
                totalBalance,
                totalInvested,
                totalDebt,
                netWorth
            });
            */
            // Commenting out Snapshot creation temporarily to stop the write-loop until we pass 'snapshots' prop correctly to check existence.
            
            hasCreatedSnapshot.current = true;
        };

        createSnapshot();
    }, [accounts, assets, transactions]);

    // --- RECURRING TRANSACTION GENERATOR ---
    // NOTE: Recurrence logic is now handled by recurrenceEngine.ts called from useDataStore
    // This duplicate logic has been removed to prevent double-generation of recurring transactions

    // --- NOTIFICATION ENGINE ---
    useEffect(() => {
        if (!('Notification' in window)) return;

        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        if (isMigrating || !transactions?.length || hasCheckedReminders.current) return;

        const checkReminders = () => {
            // FIX: Format date locally to avoid timezone issues
            const now = new Date();
            const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
            const reminders = transactions.filter(t =>
                t.enableNotification &&
                t.notificationDate === todayStr
            );

            if (reminders.length > 0 && Notification.permission === 'granted') {
                // ... existing notification logic
            }
            hasCheckedReminders.current = true;
        };

        const timer = setTimeout(checkReminders, 3000);
        return () => clearTimeout(timer);
    }, [isMigrating, transactions?.length]);
};