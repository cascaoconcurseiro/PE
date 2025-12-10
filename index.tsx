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
import { SettlementReviewModal } from './components/shared/SettlementReviewModal';
import { SettlementModal } from './components/shared/SettlementModal';
import { SpeedInsights } from "@vercel/speed-insights/react";
import { ServiceWorkerUpdater } from './components/ServiceWorkerUpdater';
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
    const [navigatedAccountId, setNavigatedAccountId] = useState<string | null>(null);
    const [showValues, setShowValues] = useState<boolean>(() => {
        try { return JSON.parse(localStorage.getItem('pdm_privacy') || 'true'); } catch { return true; }
    });
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dismissedNotifications, setDismissedNotifications] = useState<string[]>(() => {
        try {
            return JSON.parse(localStorage.getItem('pdm_dismissed_notifications') || '[]');
        } catch {
            return [];
        }
    });
    // ... (previous imports)
    const [pendingSharedRequests, setPendingSharedRequests] = useState(0);
    const [pendingSettlements, setPendingSettlements] = useState<any[]>([]); // Store full objects
    const [activeSettlementRequest, setActiveSettlementRequest] = useState<any | null>(null);
    const [settlementToPay, setSettlementToPay] = useState<any | null>(null);

    // Fetch Pending Shared Requests (Simple Polling)
    useEffect(() => {
        const fetchRequests = async () => {
            if (!sessionUser?.id) return;

            setPendingSharedRequests(0);


            // Filter relevant ones
            // If receiver_id == me: Incoming Payment (to confirm) OR Incoming Charge (I created it?? No, if I created Charge, I am Receiver. So I am waiting. No Notif).
            // Wait: If I (Receiver) Created Charge, Status is Pending. I am waiting.
            // If I (Receiver) Received Payment, Payer created it. I need to act.
            // If I (Payer) Received Charge, Receiver created it. I need to act.

            // Actionable items for Me:
            // 1. I am Receiver AND Type = PAYMENT (Someone sent me money)
            // 2. I am Payer AND Type = CHARGE (Someone charged me)

            setPendingSettlements([]);
        };
        fetchRequests();
        const interval = setInterval(fetchRequests, 30000); // 30s poll
        return () => clearInterval(interval);
    }, [sessionUser]);


    useEffect(() => { localStorage.setItem('pdm_privacy', JSON.stringify(showValues)); }, [showValues]);
    useEffect(() => { localStorage.setItem('pdm_dismissed_notifications', JSON.stringify(dismissedNotifications)); }, [dismissedNotifications]);

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
        if (!transactions || !accounts) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const notifs: any[] = [];

        // 1. Shared Transaction Requests
        if (pendingSharedRequests > 0) {
            notifs.push({
                id: 'shared-requests',
                type: 'SHARED_REQUEST',
                date: todayStr,
                description: `Você tem ${pendingSharedRequests} solicitação(ões) de compartilhamento pendente(s).`,
                amount: 0,
                enableNotification: true,
                category: 'Compartilhado',
                accountId: 'system'
            });
        }

        // 1.5 Settlement Requests (New)
        pendingSettlements.forEach(s => {
            const isCharge = s.type === 'CHARGE'; // If I see it, and it's charge, I am Payer.
            // Logic: 
            // If Payment: "X pagou Y. Confirmar."
            // If Charge: "X te cobrou Y. Pagar."
            const desc = isCharge
                ? `${s.other_user_name} te cobrou ${s.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Clique para pagar.`
                : `${s.other_user_name} pagou ${s.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}. Clique para confirmar.`;

            notifs.push({
                id: `settlement-${s.id}`,
                type: isCharge ? 'CHARGE_RECEIVED' : 'PAYMENT_RECEIVED',
                date: s.date,
                description: desc,
                amount: s.amount,
                enableNotification: true,
                category: 'Acerto de Contas',
                accountId: 'system'
            });
        });

        // 2. Credit Card Due Dates (Approximate)

        const creditCards = accounts.filter(a => a.type === 'CARTÃO DE CRÉDITO' && a.dueDay);
        creditCards.forEach(card => {
            if (!card.dueDay) return;
            // Calculate due date for current month
            let due = new Date(today.getFullYear(), today.getMonth(), card.dueDay);
            // If today is past due day, assume next month? Or if it's close? 
            // Simple logic: If due date is within next 3 days.
            // If due day is 5 and today is 25, we look at NEXT month's 5.
            if (due < today) {
                due = new Date(today.getFullYear(), today.getMonth() + 1, card.dueDay);
            }

            const diffTime = due.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays >= 0 && diffDays <= 2) {
                notifs.push({
                    id: `cc-due-${card.id}`,
                    type: 'CREDIT_CARD_DUE',
                    date: due.toISOString().split('T')[0],
                    description: `Fatura do cartão ${card.name} vence ${diffDays === 0 ? 'HOJE' : `em ${diffDays} dias`}.`,
                    amount: 0,
                    enableNotification: true,
                    category: 'Cartão de Crédito',
                    accountId: card.id
                });
            }
        });

        // 3. User Configured Reminders (Only Explicit)
        const manualReminders = transactions.filter(t =>
            t.enableNotification &&
            t.notificationDate &&
            t.notificationDate <= todayStr &&
            !t.deleted
        );
        notifs.push(...manualReminders);

        // 4. Budget API Limits
        if (budgets && budgets.length > 0) {
            budgets.forEach(budget => {
                // Calculate spent in current month for this category
                const spent = transactions
                    .filter(t =>
                        t.category === budget.categoryId &&
                        t.type === TransactionType.EXPENSE &&
                        !t.deleted &&
                        t.date.startsWith(todayStr.substring(0, 7)) // Current month YYYY-MM
                    )
                    .reduce((sum, t) => sum + t.amount, 0);

                const percentage = (spent / budget.amount) * 100;

                if (percentage >= 90) {
                    notifs.push({
                        id: `budget-${budget.id}`,
                        type: 'BUDGET_ALERT',
                        date: todayStr,
                        description: `Alerta: Orçamento de ${budget.categoryId} em ${percentage.toFixed(0)}%.`,
                        amount: 0,
                        enableNotification: true,
                        category: budget.categoryId as string,
                        accountId: 'system'
                    });
                }
            });
        }

        return notifs
            .filter(t => !dismissedNotifications.includes(t.id))
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 20);
    }, [transactions, accounts, pendingSharedRequests, dismissedNotifications]);

    const handleNotificationClick = useCallback((id: string) => {
        if (id === 'shared-requests') {
            startTransition(() => setActiveView(View.SHARED));
            return;
        }
        if (id.startsWith('settlement-')) {
            const rawId = id.replace('settlement-', '');
            const request = pendingSettlements.find(s => s.id === rawId);
            if (request) {
                if (request.type === 'CHARGE') {
                    setSettlementToPay(request);
                } else {
                    setActiveSettlementRequest(request);
                }
            }
            return;
        }
        if (id.startsWith('cc-due-')) {
            const accId = id.replace('cc-due-', '');
            startTransition(() => {
                setNavigatedAccountId(accId);
                setActiveView(View.ACCOUNTS);
            });
            return;
        }

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
                element.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
                setTimeout(() => {
                    element.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
                }, 3000);
            }
        }, 300);
    }, [transactions, accounts, pendingSharedRequests, pendingSettlements]);

    const handleDismissNotification = useCallback((id: string) => {
        if (id === 'shared-requests' || id.startsWith('cc-due-')) {
            setDismissedNotifications(prev => [...prev, id]);
            return;
        }

        if (!transactions) return;
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        if (tx.enableNotification) {
            handlers.handleUpdateTransaction({
                ...tx,
                enableNotification: false,
                updatedAt: new Date().toISOString()
            });
        } else {
            setDismissedNotifications(prev => [...prev, id]);
        }
    }, [transactions, handlers]);

    const handleNotificationPay = useCallback((id: string) => {
        if (id === 'shared-requests' || id.startsWith('cc-due-')) return;

        if (!transactions) return;
        const tx = transactions.find(t => t.id === id);
        if (!tx) return;

        const today = new Date();
        const txDate = new Date(tx.date);
        const newDate = txDate > today ? today.toISOString().split('T')[0] : tx.date;

        handlers.handleUpdateTransaction({
            ...tx,
            enableNotification: false,
            date: newDate,
            updatedAt: new Date().toISOString()
        });
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
            // Always snap to day 1 to avoid overflow (e.g. Jan 31 -> Feb -> Mar)
            newDate.setDate(1);
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



    const renderContent = () => {
        switch (activeView) {
            case View.DASHBOARD:
                return <Dashboard
                    accounts={calculatedAccounts}
                    transactions={transactions}
                    goals={goals}
                    currentDate={currentDate}
                    showValues={showValues}
                    onEditRequest={handleNotificationClick}
                    onNotificationPay={handleNotificationPay}
                    isLoading={isDataLoading}
                    pendingSharedRequestsCount={pendingSharedRequests}
                    pendingSettlements={pendingSettlements}
                    onOpenShared={() => handleViewChange(View.SHARED)}
                    onOpenSettlement={(r) => {
                        if (r.type === 'CHARGE') setSettlementToPay(r);
                        else setActiveSettlementRequest(r);
                    }}
                />;
            case View.ACCOUNTS:
                return <Accounts accounts={calculatedAccounts} transactions={transactions} onAddAccount={handlers.handleAddAccount} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onAddTransaction={handlers.handleAddTransaction} showValues={showValues} currentDate={currentDate} onAnticipate={handlers.handleAnticipateInstallments} initialAccountId={navigatedAccountId} onClearInitialAccount={() => setNavigatedAccountId(null)} />;
            case View.TRANSACTIONS:
                return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAnticipate={handlers.handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} onNavigateToAccounts={() => handleViewChange(View.ACCOUNTS)} onNavigateToTrips={() => handleViewChange(View.TRIPS)} onNavigateToFamily={() => handleViewChange(View.FAMILY)} />;
            case View.BUDGETS:
                return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handlers.handleAddBudget} onUpdateBudget={handlers.handleUpdateBudget} onDeleteBudget={handlers.handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS:
                return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handlers.handleAddGoal} onUpdateGoal={handlers.handleUpdateGoal} onDeleteGoal={handlers.handleDeleteGoal} onAddTransaction={handlers.handleAddTransaction} />;
            case View.TRIPS:
                return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handlers.handleAddTransaction} onAddTrip={handlers.handleAddTrip} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onNavigateToShared={() => handleViewChange(View.SHARED)} onEditTransaction={(id) => { setEditTxId(id); setIsTxModalOpen(true); }} />;
            case View.SHARED:
                return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} currentDate={currentDate} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onNavigateToTrips={() => handleViewChange(View.TRIPS)} />;
            case View.FAMILY:
                return <Family members={familyMembers} onAddMember={handlers.handleAddMember} onUpdateMember={handlers.handleUpdateMember} onDeleteMember={handlers.handleDeleteMember}
                    onInviteMember={async (memberId, email) => {
                        alert("Convites desabilitados na versão local.");
                    }}
                />
            case View.INVESTMENTS:
                return <Investments accounts={calculatedAccounts} transactions={transactions} assets={assets} onAddAsset={handlers.handleAddAsset} onUpdateAsset={handlers.handleUpdateAsset} onDeleteAsset={handlers.handleDeleteAsset} onAddTransaction={handlers.handleAddTransaction} onAddAccount={handlers.handleAddAccount} currentDate={currentDate} showValues={showValues} />;

            case View.SETTINGS:
                return <Settings customCategories={customCategories} onAddCategory={handlers.handleAddCategory} onDeleteCategory={handlers.handleDeleteCategory} accounts={accounts} transactions={transactions} trips={trips} budgets={budgets} goals={goals} familyMembers={familyMembers} assets={assets} snapshots={snapshots} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onFactoryReset={handlers.handleFactoryReset} />;
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
            onNotificationPay={handleNotificationPay}
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
            <Suspense fallback={activeView === View.DASHBOARD ? <div className="p-8"><DashboardSkeleton /></div> : <LoadingScreen />}>
                {renderContent()}
            </Suspense>

            {isTxModalOpen && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsTxModalOpen(false)} />
                    <div className="bg-white dark:bg-slate-900 w-full sm:max-w-2xl h-[90vh] sm:h-[85vh] rounded-t-3xl sm:rounded-3xl shadow-2xl relative z-10 flex flex-col animate-in slide-in-from-bottom-full duration-300 overflow-hidden border dark:border-slate-800">
                        <Suspense fallback={<div className="flex items-center justify-center h-full"><Loader2 className="w-8 h-8 animate-spin text-emerald-500" /></div>}>
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
                                onNavigateToAccounts={() => { setIsTxModalOpen(false); handleViewChange(View.ACCOUNTS); }}
                                onNavigateToTrips={() => { setIsTxModalOpen(false); handleViewChange(View.TRIPS); }}
                                onNavigateToFamily={() => { setIsTxModalOpen(false); handleViewChange(View.FAMILY); }}
                            />
                        </Suspense>
                    </div>
                </div>
            )}



            <InconsistenciesModal
                isOpen={isInconsistenciesModalOpen}
                onClose={() => setIsInconsistenciesModalOpen(false)}
                issues={dataInconsistencies}
                onNavigateToTransaction={(id) => {
                    handleViewChange(View.TRANSACTIONS);
                    setEditTxId(id);
                    // Standard logic to scroll to tx
                    setTimeout(() => {
                        const element = document.getElementById(`transaction-${id}`);
                        if (element) {
                            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            element.classList.add('ring-2', 'ring-amber-500', 'ring-offset-2');
                            setTimeout(() => {
                                element.classList.remove('ring-2', 'ring-amber-500', 'ring-offset-2');
                            }, 3000);
                        }
                    }, 500);
                }}
            />

            <SpeedInsights />
        </MainLayout>
    );
};

import { ErrorBoundary } from './components/ErrorBoundary';

const container = document.getElementById('root');
const root = createRoot(container!);
root.render(
    <ErrorBoundary>
        <ThemeProvider>
            <ToastProvider>
                <SettingsProvider>
                    <ServiceWorkerUpdater />
                    <App />
                </SettingsProvider>
            </ToastProvider>
        </ThemeProvider>
    </ErrorBoundary>
    </ErrorBoundary >
);