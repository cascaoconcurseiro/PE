import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useTransition } from 'react';
import { createRoot } from 'react-dom/client';
import { Loader2 } from 'lucide-react';
// import { migrateFromLocalStorage } from './services/db'; // Removed: Dexie migration no longer needed
import { supabase } from './integrations/supabase/client';
import { Auth } from './components/Auth';
import { View, SyncStatus, TransactionType } from './types';
import { calculateBalances } from './services/balanceEngine';
import { ThemeProvider } from './components/ui/ThemeContext';
import { ToastProvider } from './components/ui/Toast';
import { SettingsProvider } from './hooks/useSettings';
import { DashboardSkeleton } from './components/ui/Skeleton';
import { useDataStore } from './hooks/useDataStore';
import { useAppLogic } from './hooks/useAppLogic';
import { MainLayout } from './components/MainLayout';
import { InconsistenciesModal } from './components/ui/InconsistenciesModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { SpeedInsights } from "@vercel/speed-insights/react";
import './index.css';

// Lazy load heavy components
const Dashboard = lazy(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Accounts = lazy(() => import('./components/Accounts').then(m => ({ default: m.Accounts })));
const Transactions = lazy(() => import('./components/Transactions').then(m => ({ default: m.Transactions })));
const Budgets = lazy(() => import('./components/Budgets').then(m => ({ default: m.Budgets })));
const Goals = lazy(() => import('./components/Goals').then(m => ({ default: m.Goals })));
const Trips = lazy(() => import('./components/Trips').then(m => ({ default: m.Trips })));
const Shared = lazy(() => import('./components/Shared').then(m => ({ default: m.Shared })));
const Family = lazy(() => import('./components/Family').then(m => ({ default: m.Family })));
const Settings = lazy(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const Investments = lazy(() => import('./components/Investments').then(m => ({ default: m.Investments })));
const Reports = lazy(() => import('./components/Reports').then(m => ({ default: m.Reports })));

const App = () => {
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    // Initial Setup & Session Check
    useEffect(() => {
        const init = async () => {
            // Check active session
            const { data: { session } } = await supabase.auth.getSession();
            startTransition(() => {
                if (session) {
                    setSessionUser({
                        id: session.user.id,
                        name: session.user.user_metadata.name || session.user.email?.split('@')[0],
                        email: session.user.email
                    });
                }
                setIsSessionLoading(false);
            });
        };
        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            startTransition(() => {
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
        });

        return () => subscription.unsubscribe();
    }, []);

    const {
        user: storedUser, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading: isDataLoading, dataInconsistencies, handlers
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
    const [isInconsistenciesModalOpen, setIsInconsistenciesModalOpen] = useState(false);
    const [editTxId, setEditTxId] = useState<string | null>(null);
    const [showValues, setShowValues] = useState<boolean>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_privacy') || 'true'); } catch { return true; }
    });
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);

    useEffect(() => { localStorage.setItem('pdm_privacy', JSON.stringify(showValues)); }, [showValues]);

    const handleViewChange = (view: View) => {
        startTransition(() => {
            setActiveView(view);
        });
    };

    const calculatedAccounts = useMemo(() => {
        if (!accounts || !transactions) return [];
        const cutOffDate = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        return calculateBalances(accounts, transactions, cutOffDate);
    }, [accounts, transactions, currentDate]);

    const activeNotifications = useMemo(() => {
        if (!transactions) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        // 1. Configured Reminders (Explicit)
        const reminders = transactions.filter(t =>
            t.enableNotification &&
            t.notificationDate &&
            t.notificationDate <= todayStr &&
            !t.deleted  // ✅ Ignorar deletadas
        );

        // 2. Critical: Overdue or Due Today Expenses (Unpaid)
        // ✅ CORREÇÃO: Usar lógica correta sem isSettled
        const critical = transactions.filter(t => {
            if (t.deleted) return false;
            if (t.type !== TransactionType.EXPENSE) return false;
            if (t.enableNotification) return false;  // Já está em reminders

            // Verificar se está vencida (data <= hoje)
            const txDate = new Date(t.date);
            txDate.setHours(0, 0, 0, 0);

            return txDate <= today;
        });

        return [...reminders, ...critical]
            .filter(t => !dismissedNotifications.includes(t.id))  // ✅ Filtrar dispensadas
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 20);  // ✅ Limitar a 20 notificações
    }, [transactions, dismissedNotifications]);

    const handleNotificationClick = useCallback((id: string) => {
        // Navegar para a view de transações e destacar a transação
        startTransition(() => {
            setActiveView(View.TRANSACTIONS);
            setEditTxId(id);
        });

        // Scroll suave até a transação após um pequeno delay
        setTimeout(() => {
            const element = document.getElementById(`transaction-${id}`);
            if (element) {
                element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                // Adicionar efeito visual temporário
                element.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
                setTimeout(() => {
                    element.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
                }, 3000);
            }
        }, 300);
    }, []);

    const handleDismissNotification = useCallback((id: string) => {
        if (!transactions) return;
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        // Para notificações configuradas: desativar permanentemente
        if (tx.enableNotification) {
            handlers.handleUpdateTransaction({
                ...tx,
                enableNotification: false,
                updatedAt: new Date().toISOString()
            });
        }
        // Para notificações críticas (vencidas): dispensar temporariamente
        else {
            setDismissedNotifications(prev => [...prev, id]);
        }
    }, [transactions, handlers]);

    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        await handlers.handleLogout();
    }, [handlers]);

    const togglePrivacy = useCallback(() => {
        setShowValues(prev => !prev);
    }, []);

    const changeMonth = useCallback((direction: 'prev' | 'next') => {
        setCurrentDate(prev => {
            const newDate = new Date(prev);
            newDate.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
            return newDate;
        });
    }, []);

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
                return <Dashboard accounts={calculatedAccounts} transactions={transactions} goals={goals} currentDate={currentDate} showValues={showValues} onEditRequest={handleNotificationClick} />;
            case View.ACCOUNTS:
                return <Accounts accounts={calculatedAccounts} transactions={transactions} onAddAccount={handlers.handleAddAccount} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onAddTransaction={handlers.handleAddTransaction} showValues={showValues} currentDate={currentDate} onAnticipate={handlers.handleAnticipateInstallments} />;
            case View.TRANSACTIONS:
                return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAnticipate={handlers.handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} onNavigateToAccounts={() => handleViewChange(View.ACCOUNTS)} onNavigateToTrips={() => handleViewChange(View.TRIPS)} onNavigateToFamily={() => handleViewChange(View.FAMILY)} />;
            case View.BUDGETS:
                return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handlers.handleAddBudget} onUpdateBudget={handlers.handleUpdateBudget} onDeleteBudget={handlers.handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS:
                return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handlers.handleAddGoal} onUpdateGoal={handlers.handleUpdateGoal} onDeleteGoal={handlers.handleDeleteGoal} onAddTransaction={handlers.handleAddTransaction} />;
            case View.TRIPS:
                return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handlers.handleAddTransaction} onAddTrip={handlers.handleAddTrip} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onNavigateToShared={() => handleViewChange(View.SHARED)} />;
            case View.SHARED:
                return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} currentDate={currentDate} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onNavigateToTrips={() => handleViewChange(View.TRIPS)} />;
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
            setActiveView={handleViewChange}
            user={storedUser || { id: 'loading', name: 'Carregando...', email: '' }}
            onLogout={handleLogout}
            showValues={showValues}
            togglePrivacy={togglePrivacy}
            currentDate={currentDate}
            onDateChange={handleDateChange}
            onMonthChange={changeMonth}
            notifications={activeNotifications}
            onNotificationClick={handleNotificationClick}
            onNotificationDismiss={handleDismissNotification}
            onOpenTxModal={() => setIsTxModalOpen(true)}
            dataInconsistencies={dataInconsistencies}
            onOpenInconsistenciesModal={() => setIsInconsistenciesModalOpen(true)}
        >
            <Suspense fallback={<LoadingScreen />}>
                {renderContent()}
            </Suspense>

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

            <InconsistenciesModal
                isOpen={isInconsistenciesModalOpen}
                onClose={() => setIsInconsistenciesModalOpen(false)}
                issues={dataInconsistencies}
                onNavigateToTransaction={handleNotificationClick}
            />

            <SpeedInsights />
        </MainLayout>
    );
};

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <ThemeProvider>
        <ToastProvider>
            <SettingsProvider>
                <App />
            </SettingsProvider>
        </ToastProvider>
    </ThemeProvider>
);