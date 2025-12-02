import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { PiggyBank, Loader2 } from 'lucide-react';
import { migrateFromLocalStorage } from './services/db'; // Only for migration
import { supabase } from './integrations/supabase/client';
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
import { Reports } from './components/Reports';
import { View, SyncStatus, TransactionType } from './types';
import { calculateBalances } from './services/balanceEngine';
import { ThemeProvider } from './components/ui/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { DashboardSkeleton } from './components/ui/Skeleton';
import { useDataStore } from './hooks/useDataStore';
import { useAppLogic } from './hooks/useAppLogic';
import { MainLayout } from './components/MainLayout';
import { SpeedInsights } from "@vercel/speed-insights/react";
import './index.css';

const App = () => {
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);

    // Initial Setup & Session Check
    useEffect(() => {
        const init = async () => {
            // Check active session
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setSessionUser({
                    id: session.user.id,
                    name: session.user.user_metadata.name || session.user.email?.split('@')[0],
                    email: session.user.email
                });
            }
            setIsSessionLoading(false);
        };
        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (session) {
                setSessionUser({
                    id: session.user.id,
                    name: session.user.user_metadata.name || session.user.email?.split('@')[0],
                    email: session.user.email
                });
            } else {
                setSessionUser(null);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    const {
        user: storedUser, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading: isDataLoading, handlers
    } = useDataStore();

    // Sync Auth State with Data Store
    useEffect(() => {
        if (sessionUser && !storedUser) {
            handlers.handleLogin({
                id: sessionUser.id,
                name: sessionUser.name,
                email: sessionUser.email,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                syncStatus: SyncStatus.SYNCED
            });
        }
    }, [sessionUser, storedUser]);

    // Inject Handlers into Logic so it writes to Cloud, not Local DB
    useAppLogic({
        accounts,
        transactions,
        assets,
        isMigrating: isDataLoading,
        handlers: {
            handleAddTransaction: handlers.handleAddTransaction,
            handleUpdateTransaction: handlers.handleUpdateTransaction,
            handleAddSnapshot: handlers.handleAddSnapshot
        }
    });

    const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editTxId, setEditTxId] = useState<string | null>(null);
    const [showValues, setShowValues] = useState<boolean>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_privacy') || 'true'); } catch { return true; }
    });
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => { localStorage.setItem('pdm_privacy', JSON.stringify(showValues)); }, [showValues]);

    const calculatedAccounts = useMemo(() => {
        if (!accounts || !transactions) return [];
        const cutOffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return calculateBalances(accounts, transactions, cutOffDate);
    }, [accounts, transactions, currentDate]);

    const activeNotifications = useMemo(() => {
        if (!transactions) return [];
        const today = new Date().toISOString().split('T')[0];

        // 1. Configured Reminders (Explicit)
        const reminders = transactions.filter(t => t.enableNotification && t.notificationDate && t.notificationDate <= today);

        // 2. Critical: Overdue or Due Today Expenses (Unpaid & No Explicit Reminder)
        const critical = transactions.filter(t =>
            t.type === TransactionType.EXPENSE &&
            !t.isSettled &&
            t.date <= today &&
            !t.enableNotification
        );

        return [...reminders, ...critical].sort((a, b) => a.date.localeCompare(b.date));
    }, [transactions]);

    const handleRequestEdit = (id: string) => {
        setIsTxModalOpen(true);
        setEditTxId(id);
    };

    const handleDismissNotification = (id: string) => {
        if (!transactions) return;
        const tx = transactions.find(t => t.id === id);
        if (tx) handlers.handleUpdateTransaction({ ...tx, enableNotification: false });
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        await handlers.handleLogout();
    };

    const togglePrivacy = () => setShowValues(!showValues);

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

    if (isSessionLoading) {
        return (
            <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center">
                <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mb-4" />
                <p className="text-slate-400 font-medium">Conectando...</p>
            </div>
        );
    }

    if (!sessionUser) {
        return <Auth onLogin={() => { }} />;
    }

    if (isDataLoading && !accounts.length) {
        return (
            <div className="flex h-screen bg-slate-50 dark:bg-slate-950">
                <div className="flex-1 p-8">
                    <DashboardSkeleton />
                </div>
            </div>
        );
    }

    const renderContent = () => {
        switch (activeView) {
            case View.DASHBOARD:
                return <Dashboard accounts={calculatedAccounts} transactions={transactions} goals={goals} currentDate={currentDate} showValues={showValues} onEditRequest={handleRequestEdit} />;
            case View.ACCOUNTS:
                return <Accounts accounts={calculatedAccounts} transactions={transactions} onAddAccount={handlers.handleAddAccount} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onAddTransaction={handlers.handleAddTransaction} showValues={showValues} currentDate={currentDate} onAnticipate={handlers.handleAnticipateInstallments} />;
            case View.TRANSACTIONS:
                return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAnticipate={handlers.handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} onNavigateToAccounts={() => setActiveView(View.ACCOUNTS)} onNavigateToTrips={() => setActiveView(View.TRIPS)} onNavigateToFamily={() => setActiveView(View.FAMILY)} />;
            case View.BUDGETS:
                return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handlers.handleAddBudget} onUpdateBudget={handlers.handleUpdateBudget} onDeleteBudget={handlers.handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS:
                return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handlers.handleAddGoal} onUpdateGoal={handlers.handleUpdateGoal} onDeleteGoal={handlers.handleDeleteGoal} onAddTransaction={handlers.handleAddTransaction} />;
            case View.TRIPS:
                return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handlers.handleAddTransaction} onAddTrip={handlers.handleAddTrip} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onNavigateToShared={() => setActiveView(View.SHARED)} />;
            case View.SHARED:
                return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} currentDate={currentDate} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onNavigateToTrips={() => setActiveView(View.TRIPS)} />;
            case View.FAMILY:
                return <Family members={familyMembers} onAddMember={handlers.handleAddMember} onDeleteMember={handlers.handleDeleteMember} />;
            case View.INVESTMENTS:
                return <Investments accounts={calculatedAccounts} transactions={transactions} assets={assets} onAddAsset={handlers.handleAddAsset} onUpdateAsset={handlers.handleUpdateAsset} onDeleteAsset={handlers.handleDeleteAsset} onAddTransaction={handlers.handleAddTransaction} onAddAccount={handlers.handleAddAccount} currentDate={currentDate} showValues={showValues} />;
            case View.REPORTS:
                return <Reports accounts={calculatedAccounts} transactions={transactions} showValues={showValues} trips={trips} familyMembers={familyMembers} />;
            case View.SETTINGS:
                return <Settings customCategories={customCategories} onAddCategory={handlers.handleAddCategory} onDeleteCategory={handlers.handleDeleteCategory} accounts={accounts} transactions={transactions} trips={trips} budgets={budgets} goals={goals} familyMembers={familyMembers} assets={assets} snapshots={snapshots} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} />;
            default:
                return <Dashboard accounts={calculatedAccounts} transactions={transactions} goals={goals} currentDate={currentDate} showValues={showValues} />;
        }
    };

    return (
        <MainLayout
            activeView={activeView}
            setActiveView={setActiveView}
            user={storedUser || { id: 'loading', name: 'Carregando...', email: '' }}
            onLogout={handleLogout}
            showValues={showValues}
            togglePrivacy={togglePrivacy}
            currentDate={currentDate}
            onDateChange={handleDateChange}
            onMonthChange={changeMonth}
            notifications={activeNotifications}
            onNotificationClick={handleRequestEdit}
            onNotificationDismiss={handleDismissNotification}
            onOpenTxModal={() => setIsTxModalOpen(true)}
        >
            {renderContent()}

            {isTxModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsTxModalOpen(false)} />
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 overflow-hidden border dark:border-slate-800">
                        <Transactions
                            transactions={transactions}
                            accounts={calculatedAccounts}
                            trips={trips}
                            familyMembers={familyMembers}
                            customCategories={customCategories}
                            onAddTransaction={handlers.handleAddTransaction}
                            onUpdateTransaction={handlers.handleUpdateTransaction}
                            onDeleteTransaction={handlers.handleDeleteTransaction}
                            onAnticipate={handlers.handleAnticipateInstallments}
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
            <SpeedInsights />
        </MainLayout>
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