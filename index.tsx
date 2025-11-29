import React, { useState, useEffect, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { PiggyBank } from 'lucide-react';
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
import { View } from './types';
import { calculateBalances } from './services/balanceEngine';
import { ThemeProvider } from './components/ui/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { DashboardSkeleton } from './components/ui/Skeleton';
import { useDataStore } from './hooks/useDataStore';
import { useAppLogic } from './hooks/useAppLogic';
import { MainLayout } from './components/MainLayout';
import './index.css'; // Importando estilos globais

const App = () => {
    // --- MIGRATION & INIT ---
    const [isMigrating, setIsMigrating] = useState(true);

    useEffect(() => {
        const init = async () => {
            await migrateFromLocalStorage();
            setIsMigrating(false);
        };
        init();
    }, []);

    // --- CUSTOM HOOKS ---
    const {
        user, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, handlers
    } = useDataStore();

    useAppLogic({ accounts, transactions, assets, isMigrating });

    // --- APP STATE ---
    const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [editTxId, setEditTxId] = useState<string | null>(null);
    const [showValues, setShowValues] = useState<boolean>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_privacy') || 'true'); } catch { return true; }
    });
    const [currentDate, setCurrentDate] = useState(new Date());

    useEffect(() => { localStorage.setItem('pdm_privacy', JSON.stringify(showValues)); }, [showValues]);

    // --- CALCULATED VALUES ---
    const calculatedAccounts = useMemo(() => {
        if (!accounts || !transactions) return [];
        const cutOffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return calculateBalances(accounts, transactions, cutOffDate);
    }, [accounts, transactions, currentDate]);

    const activeNotifications = useMemo(() => {
        if (!transactions) return [];
        const today = new Date().toISOString().split('T')[0];
        return transactions.filter(t => t.enableNotification && t.notificationDate && t.notificationDate <= today);
    }, [transactions]);

    // --- HANDLERS ---
    const handleRequestEdit = (id: string) => {
        setIsTxModalOpen(true);
        setEditTxId(id);
    };

    const handleDismissNotification = (id: string) => {
        if (!transactions) return;
        const tx = transactions.find(t => t.id === id);
        if (tx) handlers.handleUpdateTransaction({ ...tx, enableNotification: false });
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

    // --- RENDER ---

    if (isMigrating) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center animate-bounce mb-4">
                    <PiggyBank className="w-10 h-10" />
                </div>
                <p className="text-slate-600 font-medium animate-pulse">Atualizando banco de dados...</p>
            </div>
        );
    }

    if (!user) {
        return <Auth onLogin={handlers.handleLogin} />;
    }

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
                return <Accounts accounts={calculatedAccounts} transactions={transactions} onAddAccount={handlers.handleAddAccount} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onAddTransaction={handlers.handleAddTransaction} showValues={showValues} />;
            case View.TRANSACTIONS:
                return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAnticipate={handlers.handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} onNavigateToAccounts={() => setActiveView(View.ACCOUNTS)} onNavigateToTrips={() => setActiveView(View.TRIPS)} onNavigateToFamily={() => setActiveView(View.FAMILY)} />;
            case View.BUDGETS:
                return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handlers.handleAddBudget} onUpdateBudget={handlers.handleUpdateBudget} onDeleteBudget={handlers.handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS:
                return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handlers.handleAddGoal} onUpdateGoal={handlers.handleUpdateGoal} onDeleteGoal={handlers.handleDeleteGoal} onAddTransaction={handlers.handleAddTransaction} />;
            case View.TRIPS:
                return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handlers.handleAddTransaction} onAddTrip={handlers.handleAddTrip} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} />;
            case View.SHARED:
                return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} onAddTransaction={handlers.handleAddTransaction} onNavigateToTrips={() => setActiveView(View.TRIPS)} />;
            case View.FAMILY:
                return <Family members={familyMembers} onAddMember={handlers.handleAddMember} onDeleteMember={handlers.handleDeleteMember} />;
            case View.INVESTMENTS:
                return <Investments accounts={calculatedAccounts} transactions={transactions} assets={assets} onAddAsset={handlers.handleAddAsset} onUpdateAsset={handlers.handleUpdateAsset} onDeleteAsset={handlers.handleDeleteAsset} onAddTransaction={handlers.handleAddTransaction} onAddAccount={handlers.handleAddAccount} currentDate={currentDate} showValues={showValues} />;
            case View.SETTINGS:
                return <Settings onImport={handlers.handleImportData} customCategories={customCategories} onAddCategory={handlers.handleAddCategory} onDeleteCategory={handlers.handleDeleteCategory} accounts={accounts} transactions={transactions} trips={trips} budgets={budgets} goals={goals} familyMembers={familyMembers} assets={assets} snapshots={snapshots} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} />;
            default:
                return <Dashboard accounts={calculatedAccounts} transactions={transactions} currentDate={currentDate} showValues={showValues} />;
        }
    };

    return (
        <MainLayout
            activeView={activeView}
            setActiveView={setActiveView}
            user={user}
            onLogout={handlers.handleLogout}
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
                    <div className="bg-white w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 overflow-hidden">
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