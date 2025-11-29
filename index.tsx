import React, { useState, useEffect, useMemo, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { LayoutDashboard, Receipt, Plane, Wallet, Target, ChevronLeft, ChevronRight, Calendar, Plus, CreditCard, MoreHorizontal, UserCircle, LogOut, Eye, EyeOff, Users, Home, Menu, X, Sparkles, Settings as SettingsIcon, Database, PiggyBank, AlertTriangle, Copy, Check, ExternalLink, List, PieChart, FileText, Trophy, TrendingUp, Bell, BellRing, Moon, Sun } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, migrateFromLocalStorage } from './services/db';
import { Dashboard } from './components/Dashboard';
import { Accounts } from './components/Accounts';
import { Auth } from './components/Auth';
import { Transactions } from './components/Transactions';
import { Budgets } from './components/Budgets';
import { Goals } from './components/Goals';
import { Trips } from './components/Trips';
import { Shared } from './components/Shared';
import { Family } from './components/Family';
import { Settings } from './components/Settings';
import { Investments } from './components/Investments';
import { Account, Transaction, Trip, Budget, Goal, FamilyMember, CustomCategory, UserProfile, View, TransactionType, Category, Asset, Frequency, SyncStatus, Snapshot, AccountType } from './types';
import { convertToBRL } from './services/currencyService';
import { calculateBalances } from './services/balanceEngine';
import { Button } from './components/ui/Button';
import { parseDate } from './utils';
import { processRecurringTransactions } from './services/recurrenceEngine';
import { ThemeProvider, useTheme } from './components/ui/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { DashboardSkeleton } from './components/ui/Skeleton';

// --- ERROR COMPONENT ---
const ErrorFallback = ({ error }: { error: Error | any }) => (
    <div className="min-h-screen flex items-center justify-center bg-red-50 p-6 font-sans">
        <div className="max-w-lg w-full bg-white p-8 rounded-3xl shadow-2xl border border-red-100 text-center">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle className="w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Ops! O sistema travou.</h2>
            <p className="text-slate-600 mb-6">Ocorreu um erro crítico durante a inicialização.</p>

            <div className="bg-slate-100 p-4 rounded-xl text-left overflow-auto max-h-40 mb-6 border border-slate-200">
                <p className="text-xs font-bold text-slate-600 uppercase mb-1">Detalhes do Erro:</p>
                <code className="text-sm text-red-700 font-mono break-all">
                    {error?.message || error?.toString() || "Erro desconhecido"}
                </code>
            </div>

            <Button onClick={() => window.location.reload()} className="w-full h-12 text-base">
                Tentar Novamente
            </Button>
        </div>
    </div>
);

const App = () => {


    // --- MIGRATION & INIT ---
    const [isMigrating, setIsMigrating] = useState(true);

    useEffect(() => {
        const init = async () => {
            await migrateFromLocalStorage();

            // Auto-creation removed to support Auth flow

            setIsMigrating(false);
        };
        init();
    }, []);

    const { theme, toggleTheme } = useTheme();

    // --- DATA QUERIES (LIVE) ---
    // Pass 'undefined' as default to detect loading state
    const user = useLiveQuery(() => db.userProfile.toCollection().first(), []);
    const accounts = useLiveQuery(() => db.accounts.filter(a => !a.deleted).toArray(), []);
    const transactions = useLiveQuery(() => db.transactions.filter(t => !t.deleted).toArray(), []);
    const trips = useLiveQuery(() => db.trips.filter(t => !t.deleted).toArray(), []);
    const budgets = useLiveQuery(() => db.budgets.filter(b => !b.deleted).toArray(), []);
    const goals = useLiveQuery(() => db.goals.filter(g => !g.deleted).toArray(), []);
    const familyMembers = useLiveQuery(() => db.familyMembers.filter(f => !f.deleted).toArray(), []);
    // Custom categories are stored in localStorage for now as they are simple strings/objects, 
    // or we can migrate them to DB. The previous code used 'pdm_categories'.
    // Let's keep them in localStorage for simplicity or add a table if needed.
    // Actually, let's just use localStorage for settings-like things to avoid over-engineering right now.
    const [customCategories, setCustomCategories] = useState<CustomCategory[]>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_categories') || '[]'); } catch { return []; }
    });
    const assets = useLiveQuery(() => db.assets.filter(a => !a.deleted).toArray(), []);
    const snapshots = useLiveQuery(() => db.snapshots.toArray(), []);

    // --- SNAPSHOT LOGIC ---
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
        createSnapshot();
    }, [accounts, assets, transactions]);

    // --- RECURRENCE ENGINE ---
    useEffect(() => {
        if (!transactions) return;

        processRecurringTransactions(
            transactions,
            (newTx) => {
                db.transactions.add({ ...newTx, id: crypto.randomUUID() });
                console.log("Generated recurring transaction:", newTx.description);
            },
            (updatedTx) => {
                db.transactions.put(updatedTx);
                console.log("Updated parent transaction:", updatedTx.description);
            }
        );
    }, [transactions]);

    // --- APP STATE ---
    const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    // --- NOTIFICATIONS LOGIC ---
    const activeNotifications = useMemo(() => {
        const today = new Date().toISOString().split('T')[0];
        return transactions.filter(t => t.enableNotification && t.notificationDate && t.notificationDate <= today);
    }, [transactions]);

    const handleDismissNotification = (id: string) => {
        const tx = transactions.find(t => t.id === id);
        if (tx) {
            db.transactions.put({ ...tx, enableNotification: false });
        }
    };
    const [editTxId, setEditTxId] = useState<string | null>(null);
    const [showValues, setShowValues] = useState<boolean>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_privacy') || 'true'); } catch { return true; }
    });
    const [currentDate, setCurrentDate] = useState(new Date());

    // --- PERSISTENCE SIDE EFFECTS ---
    useEffect(() => { localStorage.setItem('pdm_categories', JSON.stringify(customCategories)); }, [customCategories]);
    useEffect(() => { localStorage.setItem('pdm_privacy', JSON.stringify(showValues)); }, [showValues]);

    // --- CORE ENGINE: CALCULATED ACCOUNTS ---
    const calculatedAccounts = useMemo(() => {
        const cutOffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return calculateBalances(accounts, transactions, cutOffDate);
    }, [accounts, transactions, currentDate]);

    // --- RECURRING TRANSACTION ENGINE ---
    const hasCheckedRecurrence = useRef(false);
    useEffect(() => {
        if (isMigrating || !transactions.length || hasCheckedRecurrence.current) return;

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
                // alert(`${newTxList.length} transações recorrentes geradas.`); // Optional: remove alert to be less intrusive
            }
            hasCheckedRecurrence.current = true;
        };

        const timer = setTimeout(runRecurringEngine, 1000);
        return () => clearTimeout(timer);
    }, [isMigrating, transactions.length]);

    // --- NOTIFICATION ENGINE ---
    const hasCheckedReminders = useRef(false);
    useEffect(() => {
        if (!('Notification' in window)) return;

        if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            Notification.requestPermission();
        }

        if (isMigrating || !transactions.length || hasCheckedReminders.current) return;

        const checkReminders = () => {
            const todayStr = new Date().toISOString().split('T')[0];
            const reminders = transactions.filter(t =>
                t.enableNotification &&
                t.notificationDate === todayStr
            );

            if (reminders.length > 0) {
                if (Notification.permission === 'granted') {
                    // Group to avoid spamming if many
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
                } else {
                    // Fallback alert
                    // alert(`Lembrete: Você tem ${reminders.length} conta(s) para pagar hoje!`);
                }
            }
            hasCheckedReminders.current = true;
        };

        const timer = setTimeout(checkReminders, 3000);
        return () => clearTimeout(timer);
    }, [isMigrating, transactions]);

    // --- HANDLERS ---

    const handleLogin = async (user: UserProfile) => {
        await db.userProfile.add(user);
    };

    const handleLogout = async () => {
        await db.userProfile.clear();
        window.location.reload();
    };

    const togglePrivacy = () => setShowValues(!showValues);

    const handleRequestEdit = (id: string) => {
        setIsTxModalOpen(true);
        setEditTxId(id);
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
                    syncStatus: SyncStatus.PENDING // using 'as any' or import SyncStatus if possible, but string is fine for now if enum matches
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
        setIsTxModalOpen(false);
    };

    const handleUpdateTransaction = async (updatedTx: Transaction) => {
        await db.transactions.put({
            ...updatedTx,
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        });
        setIsTxModalOpen(false);
    };

    const handleDeleteTransaction = async (id: string) => {
        // Soft delete for sync
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
        alert(`${idsToAnticipate.length} parcelas antecipadas com sucesso!`);
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
    }

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
    }

    const handleAddCategory = (name: string) => {
        const newCat: CustomCategory = {
            id: crypto.randomUUID(),
            name,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            syncStatus: SyncStatus.PENDING
        };
        setCustomCategories([...customCategories, newCat]);
    };

    const handleDeleteCategory = (id: string) => {
        setCustomCategories(customCategories.filter(c => c.id !== id));
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
        await db.transaction('rw', [db.accounts, db.transactions, db.trips, db.budgets, db.goals, db.familyMembers, db.assets, db.snapshots], async () => {
            if (data.accounts) await db.accounts.bulkPut(data.accounts);
            if (data.transactions) await db.transactions.bulkPut(data.transactions);
            if (data.trips) await db.trips.bulkPut(data.trips);
            if (data.budgets) await db.budgets.bulkPut(data.budgets);
            if (data.goals) await db.goals.bulkPut(data.goals);
            if (data.familyMembers) await db.familyMembers.bulkPut(data.familyMembers);
            if (data.assets) await db.assets.bulkPut(data.assets);
            if (data.snapshots) await db.snapshots.bulkPut(data.snapshots);
        });
        if (data.customCategories) setCustomCategories(data.customCategories);
        alert('Dados restaurados com sucesso!');
    };

    const changeMonth = (direction: 'prev' | 'next') => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        setCurrentDate(newDate);
    };

    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.value) {
            const [year, month] = e.target.value.split('-');
            setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
        }
    };

    const getMonthInputValue = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    };

    // --- RENDER ---

    if (isMigrating) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center animate-bounce mb-4">
                    <PiggyBank className="w-10 h-10" />
                </div>
                <p className="text-slate-600 font-medium animate-pulse">
                    Atualizando banco de dados...
                </p>
            </div>
        );
    }

    if (!user) {
        return <Auth onLogin={handleLogin} />;
    }

    // Check if critical data is loading
    if (!accounts || !transactions) {
        return (
            <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
                <aside className="hidden md:flex flex-col w-72 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-20 shrink-0 p-6 space-y-6">
                    <div className="h-8 w-32 bg-slate-200 dark:bg-slate-800 rounded animate-pulse" />
                    <div className="space-y-4">
                        {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-10 w-full bg-slate-100 dark:bg-slate-800 rounded-xl animate-pulse" />)}
                    </div>
                </aside>
                <div className="flex-1 p-8">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeView) {
            case View.DASHBOARD:
                return <Dashboard accounts={calculatedAccounts} transactions={transactions} currentDate={currentDate} showValues={showValues} onEditRequest={handleRequestEdit} />;
            case View.ACCOUNTS:
                return <Accounts accounts={calculatedAccounts} transactions={transactions} onAddAccount={handleAddAccount} onUpdateAccount={handleUpdateAccount} onDeleteAccount={handleDeleteAccount} onAddTransaction={handleAddTransaction} showValues={showValues} />;
            case View.TRANSACTIONS:
                return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handleAddTransaction} onUpdateTransaction={handleUpdateTransaction} onDeleteTransaction={handleDeleteTransaction} onAnticipate={handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} />;
            case View.BUDGETS:
                return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handleAddBudget} onUpdateBudget={handleUpdateBudget} onDeleteBudget={handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS:
                return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handleAddGoal} onUpdateGoal={handleUpdateGoal} onDeleteGoal={handleDeleteGoal} onAddTransaction={handleAddTransaction} />;
            case View.TRIPS:
                return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handleAddTransaction} onAddTrip={handleAddTrip} onUpdateTrip={handleUpdateTrip} onDeleteTrip={handleDeleteTrip} />;
            case View.SHARED:
                return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} onAddTransaction={handleAddTransaction} onNavigateToTrips={() => setActiveView(View.TRIPS)} />;
            case View.FAMILY:
                return <Family members={familyMembers} onAddMember={handleAddMember} onDeleteMember={handleDeleteMember} />;
            case View.INVESTMENTS:
                return <Investments
                    accounts={calculatedAccounts}
                    transactions={transactions}
                    assets={assets}
                    onAddAsset={handleAddAsset}
                    onUpdateAsset={handleUpdateAsset}
                    onDeleteAsset={handleDeleteAsset}
                    onAddTransaction={handleAddTransaction}
                    onAddAccount={handleAddAccount}
                    currentDate={currentDate}
                    showValues={showValues}
                />;
            case View.SETTINGS:
                return <Settings
                    onImport={handleImportData}
                    customCategories={customCategories}
                    onAddCategory={handleAddCategory}
                    onDeleteCategory={handleDeleteCategory}
                    accounts={accounts}
                    transactions={transactions}
                    trips={trips}
                    budgets={budgets}
                    goals={goals}
                    familyMembers={familyMembers}
                    assets={assets}
                    snapshots={snapshots}
                    onUpdateAccount={handleUpdateAccount}
                    onDeleteAccount={handleDeleteAccount}
                    onUpdateTrip={handleUpdateTrip}
                    onDeleteTrip={handleDeleteTrip}
                />;
            default:
                return <Dashboard accounts={calculatedAccounts} transactions={transactions} currentDate={currentDate} showValues={showValues} />;
        }
    };

    const NavItem = ({ view, icon: Icon, label, activeColor }: { view: View, icon: any, label: string, activeColor: string }) => {
        const isActive = activeView === view;
        return (
            <button
                onClick={() => setActiveView(view)}
                className={`flex flex-col items-center justify-center w-full h-full active:scale-90 transition-all duration-200 relative group`}
            >
                <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? `${activeColor.replace('text-', 'bg-')}/10` : 'bg-transparent'}`}>
                    <Icon
                        className={`w-6 h-6 transition-colors duration-300 ${isActive ? activeColor : 'text-slate-400 group-hover:text-slate-600'}`}
                        strokeWidth={isActive ? 2.5 : 2}
                    />
                </div>
                <span className={`text-[10px] font-bold mt-1 transition-colors duration-300 ${isActive ? activeColor : 'text-slate-400 group-hover:text-slate-600'}`}>
                    {label}
                </span>
            </button>
        );
    };

    const SidebarItem = ({ view, icon: Icon, label, activeBg, activeText }: { view: View, icon: any, label: string, activeBg: string, activeText: string }) => {
        const isActive = activeView === view;
        return (
            <button
                onClick={() => { setActiveView(view); setIsMenuOpen(false); }}
                className={`w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-4 text-sm font-semibold transition-all duration-200 ${isActive ? `${activeBg} ${activeText} shadow-sm` : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'}`}
            >
                <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-white/50' : 'bg-slate-100 text-slate-500'}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {label}
            </button>
        );
    };

    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <div className="flex flex-col h-full bg-white">
            {isMobile && (
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-gradient-to-br from-slate-50 to-slate-100/50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-xl shadow-sm border border-white">
                            {user.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-slate-900 text-base truncate max-w-[160px]">{user.name}</h3>
                            <p className="text-xs text-slate-500 truncate max-w-[160px]">{user.email}</p>
                        </div>
                    </div>
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-white rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="space-y-1 mb-6">
                    <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Principal</p>
                    <SidebarItem view={View.DASHBOARD} icon={LayoutDashboard} label="Visão Geral" activeBg="bg-emerald-50" activeText="text-emerald-700" />
                    <SidebarItem view={View.TRANSACTIONS} icon={List} label="Extrato de Transações" activeBg="bg-blue-50" activeText="text-blue-700" />
                    <SidebarItem view={View.ACCOUNTS} icon={Wallet} label="Contas e Cartões" activeBg="bg-violet-50" activeText="text-violet-700" />
                    <SidebarItem view={View.INVESTMENTS} icon={TrendingUp} label="Investimentos" activeBg="bg-indigo-50" activeText="text-indigo-700" />
                </div>

                <div className="space-y-1 mb-6">
                    <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Planejamento</p>
                    <SidebarItem view={View.BUDGETS} icon={Target} label="Orçamentos" activeBg="bg-amber-50" activeText="text-amber-700" />
                    <SidebarItem view={View.GOALS} icon={Trophy} label="Metas e Sonhos" activeBg="bg-emerald-50" activeText="text-emerald-700" />
                    <SidebarItem view={View.TRIPS} icon={Plane} label="Minhas Viagens" activeBg="bg-purple-50" activeText="text-purple-700" />
                    <SidebarItem view={View.SHARED} icon={Users} label="Divisão de Gastos" activeBg="bg-indigo-50" activeText="text-indigo-700" />
                    <SidebarItem view={View.FAMILY} icon={UserCircle} label="Membros da Família" activeBg="bg-pink-50" activeText="text-pink-700" />
                </div>

                <div className="space-y-1">
                    <p className="px-4 py-2 text-xs font-bold text-slate-400 uppercase tracking-wider mb-1">Sistema</p>

                    <button
                        onClick={togglePrivacy}
                        className="w-full text-left px-4 py-3.5 rounded-xl flex items-center gap-4 text-sm font-semibold transition-all duration-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    >
                        <div className={`p-2 rounded-lg transition-colors ${!showValues ? 'bg-indigo-100 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                            {showValues ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                        </div>
                        {showValues ? 'Ocultar Valores' : 'Mostrar Valores'}
                    </button>

                    <SidebarItem view={View.SETTINGS} icon={SettingsIcon} label="Configurações e Backup" activeBg="bg-slate-100" activeText="text-slate-800" />
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 pb-safe bg-slate-50/50 shrink-0 space-y-2">
                <button onClick={toggleTheme} className="w-full py-3.5 flex items-center justify-center gap-2 text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl font-bold transition-all active:scale-95 shadow-sm">
                    {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </button>
                <button onClick={handleLogout} className="w-full py-3.5 flex items-center justify-center gap-2 text-red-600 bg-white border border-red-100 hover:bg-red-50 rounded-xl font-bold transition-all active:scale-95 shadow-sm">
                    <LogOut className="w-5 h-5" /> Sair da Conta
                </button>
            </div>
        </div>
    );

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <aside className="hidden md:flex flex-col w-72 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-20 shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView(View.DASHBOARD)}>
                        <div className="w-8 h-8 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-lg flex items-center justify-center shadow-emerald-500/20 shadow-lg shrink-0">
                            <PiggyBank className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <span className="font-bold text-slate-800 dark:text-white text-lg leading-tight block">Pé de Meia</span>
                        </div>
                    </div>
                </div>
                <SidebarContent />
            </aside>

            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
                <header className="bg-white/80 backdrop-blur-md border-b border-slate-200/60 sticky top-0 z-30 shrink-0 transition-all">
                    <div className="w-full px-4 md:px-8 h-16 flex items-center justify-between">
                        <div className="flex md:hidden items-center space-x-2 cursor-pointer active:opacity-70 transition-opacity" onClick={() => setActiveView(View.DASHBOARD)}>
                            <div className="w-9 h-9 bg-gradient-to-tr from-emerald-400 to-teal-500 rounded-xl flex items-center justify-center shadow-emerald-500/20 shadow-lg shrink-0">
                                <PiggyBank className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <span className="font-bold text-slate-800 text-lg leading-tight block">Pé de Meia</span>
                            </div>
                        </div>

                        <div className="hidden md:block">
                            <h2 className="text-xl font-bold text-slate-800">{activeView}</h2>
                        </div>

                        <div className="flex items-center space-x-1 bg-slate-100 rounded-full p-1 border border-slate-200 mx-2 flex-1 justify-center max-w-[160px] md:max-w-[200px]">
                            <button onClick={() => changeMonth('prev')} className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600 active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                            <div className="flex items-center justify-center relative group cursor-pointer h-8 px-1">
                                <span className="text-xs sm:text-sm font-bold text-slate-700 capitalize pointer-events-none leading-none pt-0.5 truncate">
                                    {currentDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}
                                </span>
                                <input
                                    type="month"
                                    value={getMonthInputValue(currentDate)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                                    onChange={handleDateChange}
                                />
                            </div>
                            <button onClick={() => changeMonth('next')} className="p-1.5 hover:bg-white hover:shadow-sm rounded-full transition-all text-slate-600 active:scale-90"><ChevronRight className="w-4 h-4" /></button>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            {/* NOTIFICATION BELL */}
                            <div className="relative">
                                <button
                                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 hover:bg-slate-50 transition-colors relative shadow-sm active:scale-95"
                                >
                                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                                    {activeNotifications.length > 0 && (
                                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white animate-pulse" />
                                    )}
                                </button>
                                {/* DROPDOWN */}
                                {isNotifOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                                        <div className="absolute right-0 top-12 w-72 sm:w-80 bg-white rounded-2xl shadow-xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                                                <h3 className="font-bold text-slate-800 flex items-center gap-2 text-sm">
                                                    <BellRing className="w-4 h-4 text-indigo-600" /> Notificações
                                                </h3>
                                                <span className="text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                                                    {activeNotifications.length}
                                                </span>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {activeNotifications.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-500">
                                                        <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                        <p className="text-xs">Tudo tranquilo.</p>
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-slate-50">
                                                        {activeNotifications.map(n => (
                                                            <div key={n.id} className="p-3 hover:bg-slate-50 transition-colors flex gap-3">
                                                                <div className="mt-1 p-1.5 bg-red-50 text-red-600 rounded-lg h-fit">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-slate-800 line-clamp-1">{n.description}</p>
                                                                    <p className="text-[10px] text-slate-500 mb-2">
                                                                        Vence: {new Date(n.notificationDate!).toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                        <button
                                                                            onClick={() => {
                                                                                handleRequestEdit(n.id);
                                                                                setIsNotifOpen(false);
                                                                            }}
                                                                            className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded hover:bg-indigo-100"
                                                                        >
                                                                            Ver
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleDismissNotification(n.id)}
                                                                            className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-1 rounded hover:bg-slate-200"
                                                                        >
                                                                            OK
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </>
                                )}
                            </div>

                            <button onClick={() => setIsTxModalOpen(true)} className="hidden md:flex items-center gap-2 bg-slate-900 text-white px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-800 transition-all shadow-sm active:scale-95">
                                <Plus className="w-4 h-4" /> Nova Transação
                            </button>
                            <button onClick={togglePrivacy} className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-50 rounded-full transition-all active:bg-slate-100">
                                {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </button>
                            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-slate-700 hover:bg-slate-100 rounded-full transition-all active:bg-slate-100">
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-slate-50 scroll-smooth pb-32 md:pb-8">
                    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8">
                        {renderContent()}
                    </div>
                </main>
            </div>

            {isMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)} />
                    <div className="relative w-full sm:w-80 bg-white h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <SidebarContent isMobile={true} />
                    </div>
                </div>
            )}

            {isTxModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsTxModalOpen(false)} />
                    <div className="bg-white w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 overflow-hidden">
                        <Transactions
                            transactions={transactions}
                            accounts={calculatedAccounts}
                            trips={trips}
                            familyMembers={familyMembers}
                            customCategories={customCategories}
                            onAddTransaction={handleAddTransaction}
                            onUpdateTransaction={handleUpdateTransaction}
                            onDeleteTransaction={handleDeleteTransaction}
                            onAnticipate={handleAnticipateInstallments}
                            modalMode={true}
                            onCancel={() => setIsTxModalOpen(false)}
                            currentDate={currentDate}
                            showValues={showValues}
                            onNavigateToAccounts={() => { setIsTxModalOpen(false); setActiveView(View.ACCOUNTS); }}
                            onNavigateToTrips={() => { setIsTxModalOpen(false); setActiveView(View.TRIPS); }}
                            onNavigateToFamily={() => { setIsTxModalOpen(false); setActiveView(View.FAMILY); }}
                        />
                    </div>
                </div>
            )}

            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe pointer-events-none">
                <div className="w-full max-w-[1600px] mx-auto px-2 pb-2 pt-0">
                    <div className="bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] h-[80px] rounded-3xl flex items-center justify-between pointer-events-auto relative px-2">
                        <div className="flex items-center justify-around w-[40%]">
                            <NavItem view={View.DASHBOARD} icon={Home} label="Início" activeColor="text-emerald-600" />
                            <NavItem view={View.TRANSACTIONS} icon={FileText} label="Extrato" activeColor="text-blue-600" />
                        </div>

                        <div className="absolute left-1/2 -top-6 transform -translate-x-1/2 z-[60] pointer-events-auto">
                            <button
                                onClick={() => setIsTxModalOpen(true)}
                                className="w-16 h-16 rounded-[22px] bg-slate-900 flex items-center justify-center text-white shadow-[0_8px_25px_rgba(15,23,42,0.3)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 border-[4px] border-slate-50 ring-1 ring-slate-100"
                            >
                                <Plus className="w-7 h-7" strokeWidth={3} />
                            </button>
                        </div>

                        <div className="flex items-center justify-around w-[40%]">
                            <NavItem view={View.ACCOUNTS} icon={Wallet} label="Contas" activeColor="text-violet-600" />
                            <NavItem view={View.INVESTMENTS} icon={TrendingUp} label="Invest." activeColor="text-indigo-600" />
                        </div>
                    </div>
                </div>
            </nav>
        </div>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <ThemeProvider>
        <ToastProvider>
            <App />
        </ToastProvider>
    </ThemeProvider>
);