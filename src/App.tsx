import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useTransition } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from './integrations/supabase/client';
import { Auth } from './components/Auth';
import { View, SyncStatus, TransactionType } from './types';
import { calculateBalances } from './services/balanceEngine';
import { DashboardSkeleton } from './components/ui/Skeleton';
import { useDataStore } from './hooks/useDataStore';
import { useAppLogic } from './hooks/useAppLogic';
import { MainLayout } from './components/MainLayout';
import { InconsistenciesModal } from './components/ui/InconsistenciesModal';
import { LoadingScreen } from './components/ui/LoadingScreen';
import { GlobalSearch } from './components/GlobalSearch';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useKeyboardShortcuts, getDefaultShortcuts } from './hooks/useKeyboardShortcuts';
import { useSystemNotifications } from './hooks/useSystemNotifications';

import { lazyImport } from './utils/lazyImport';

// Lazy load heavy components with robust reload protection
const Dashboard = lazyImport(() => import('./components/Dashboard').then(m => ({ default: m.Dashboard })));
const Accounts = lazyImport(() => import('./components/Accounts').then(m => ({ default: m.Accounts })));
const Transactions = lazyImport(() => import('./components/Transactions').then(m => ({ default: m.Transactions })));
const Budgets = lazyImport(() => import('./components/Budgets').then(m => ({ default: m.Budgets })));
const Goals = lazyImport(() => import('./components/Goals').then(m => ({ default: m.Goals })));
const Trips = lazyImport(() => import('./components/Trips').then(m => ({ default: m.Trips })));
const Shared = lazyImport(() => import('./components/Shared').then(m => ({ default: m.Shared })));
const Family = lazyImport(() => import('./components/Family').then(m => ({ default: m.Family })));
const Settings = lazyImport(() => import('./components/Settings').then(m => ({ default: m.Settings })));
const Investments = lazyImport(() => import('./components/Investments').then(m => ({ default: m.Investments })));

const App = () => {
    // 1. All Hooks Declarations
    const [sessionUser, setSessionUser] = useState<any>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const {
        user: storedUser, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories, isLoading: isDataLoading, dataInconsistencies, handlers
    } = useDataStore();

    const [activeView, setActiveView] = useState<View>(View.DASHBOARD);
    const [isTxModalOpen, setIsTxModalOpen] = useState(false);
    const [isInconsistenciesModalOpen, setIsInconsistenciesModalOpen] = useState(false);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [editTxId, setEditTxId] = useState<string | null>(null);
    const [navigatedAccountId, setNavigatedAccountId] = useState<string | null>(null);
    const [showValues, setShowValues] = useState<boolean>(true);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [dismissedNotifications, setDismissedNotifications] = useState<string[]>([]);
    const { systemNotifications, markAsRead } = useSystemNotifications(sessionUser?.id);

    const [pendingSharedRequests, setPendingSharedRequests] = useState(0);
    const [pendingSettlements, setPendingSettlements] = useState<any[]>([]);
    const [activeSettlementRequest, setActiveSettlementRequest] = useState<any | null>(null);
    const [settlementToPay, setSettlementToPay] = useState<any | null>(null);

    // AUTO-UPDATE LOGIC (Zombie SW Killer)
    // AUTO-UPDATE LOGIC REMOVED: Now relying on lazyImport retry mechanism.


    // Initial Setup
    useEffect(() => {
        const init = async () => {
            try {
                const { data: { session }, error } = await supabase.auth.getSession();
                if (error) throw error;
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
            } catch (err) {
                console.warn("Session init error:", err);
                setIsSessionLoading(false);
            }
        };
        init();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            console.log(`Auth state changed: ${_event}`, session ? 'User present' : 'No session');
            startTransition(() => {
                if (session) {
                    setSessionUser({
                        id: session.user.id,
                        name: session.user.user_metadata.name || session.user.email?.split('@')[0],
                        email: session.user.email
                    });
                } else {
                    console.warn("User signed out or session invalid.");
                    setSessionUser(null);
                }
            });
        });
        return () => subscription.unsubscribe();
    }, []);

    // Sync Auth
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

    // App Logic
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

    // Keyboard Shortcuts
    useKeyboardShortcuts(getDefaultShortcuts({
        openNewTransaction: () => setIsTxModalOpen(true),
        openSearch: () => setIsSearchOpen(true),
        closeModal: () => {
            if (isSearchOpen) setIsSearchOpen(false);
            else if (isTxModalOpen) setIsTxModalOpen(false);
        }
    }), !!sessionUser);

    // Fetch Requests
    useEffect(() => {
        const fetchRequests = async () => {
            if (!sessionUser?.id) return;
            setPendingSharedRequests(0);
            setPendingSettlements([]);
        };
        fetchRequests();
        const interval = setInterval(fetchRequests, 30000);
        return () => clearInterval(interval);
    }, [sessionUser]);

    // Helper Functions & Memos
    const handleViewChange = (view: View) => startTransition(() => setActiveView(view));

    const calculatedAccounts = useMemo(() => {
        return accounts || [];
    }, [accounts]);

    const projectedAccounts = useMemo(() => {
        if (!accounts || !transactions) return [];
        // COMPUTE PROJECTED BALANCE (Optimized: Current DB Balance + Future Txs)
        // Complexity: O(M) where M is transactions in current view (small)
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return accounts.map(acc => {
            const futureTxs = transactions.filter(t =>
                t.accountId === acc.id &&
                new Date(t.date) >= now &&
                new Date(t.date) <= endOfMonth &&
                !t.isSettled // Only count unresolved/unpaid items for projection? 
                // depends on definition. Usually projection includes everything scheduled.
                // If it's settled, it's already in the balance?
                // Yes, if settled (paid), it effectively updated the "Current Balance" via Trigger/Update?
                // Actually, "isSettled" is often used for "Paid".
                // If I paid it today, it's in stored balance.
                // If it's scheduled for tomorrow, it's not in stored balance.
                // So checking date > now is correct.
            );

            const futureImpact = futureTxs.reduce((sum, t) => {
                let amount = t.amount;
                // Handle Transfers? 
                // If I transfer out tomorrow, balance decreases.
                if (t.type === TransactionType.INCOME) return sum + amount;
                if (t.type === TransactionType.EXPENSE) return sum - amount;
                if (t.type === TransactionType.TRANSFER) {
                    // Outgoing transfer
                    return sum - amount;
                }
                return sum;
            }, 0);

            return { ...acc, balance: (acc.balance || 0) + futureImpact };
        });
    }, [accounts, transactions, currentDate]);

    const activeNotifications = useMemo(() => {
        if (!transactions || !accounts) return [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        const notifs: any[] = [];
        return notifs;
        if (systemNotifications) {
            const mapped = systemNotifications.map(sn => ({
                id: sn.id,
                title: sn.title,
                description: sn.message,
                type: sn.type,
                date: sn.created_at,
                isLocal: false
            }));
            notifs.push(...mapped);
        }
        return notifs;
    }, [transactions, accounts, pendingSharedRequests, dismissedNotifications, systemNotifications]);

    // Re-implementing critical handlers
    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        await handlers.handleLogout();
        // SECURITY: Force reload to clear all memory states/caches
        window.location.reload();
    }, [handlers]);

    const handleNotificationPay = useCallback(() => { }, []);
    const handleNotificationClick = useCallback(async (id: string) => {
        const isLocal = !systemNotifications.find(n => n.id === id);
        if (!isLocal) {
            await markAsRead(id);
        }
    }, [markAsRead, systemNotifications]);

    const handleDismissNotification = useCallback(async (id: string) => {
        const isLocal = !systemNotifications.find(n => n.id === id);
        if (isLocal) {
            setDismissedNotifications(prev => [...prev, id]);
        } else {
            await markAsRead(id);
        }
    }, [markAsRead, systemNotifications]);

    const renderContent = () => {
        switch (activeView) {
            case View.DASHBOARD: return <Dashboard accounts={calculatedAccounts} projectedAccounts={projectedAccounts} transactions={transactions} goals={goals} currentDate={currentDate} showValues={showValues} onEditRequest={() => { }} onNotificationPay={() => { }} isLoading={isDataLoading} pendingSharedRequestsCount={pendingSharedRequests} pendingSettlements={pendingSettlements} onOpenShared={() => handleViewChange(View.SHARED)} onOpenSettlement={() => { }} />;
            case View.ACCOUNTS: return <Accounts accounts={calculatedAccounts} transactions={transactions} members={familyMembers} onAddAccount={handlers.handleAddAccount} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onAddTransaction={handlers.handleAddTransaction} onAddTransactions={handlers.handleAddTransactions} showValues={showValues} currentDate={currentDate} onAnticipate={handlers.handleAnticipateInstallments} initialAccountId={navigatedAccountId} onClearInitialAccount={() => setNavigatedAccountId(null)} />;
            case View.TRANSACTIONS: return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAnticipate={handlers.handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} onNavigateToAccounts={() => handleViewChange(View.ACCOUNTS)} onNavigateToTrips={() => handleViewChange(View.TRIPS)} onNavigateToFamily={() => handleViewChange(View.FAMILY)} currentUserName={sessionUser?.name || 'Eu'} />;
            case View.BUDGETS: return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handlers.handleAddBudget} onUpdateBudget={handlers.handleUpdateBudget} onDeleteBudget={handlers.handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS: return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handlers.handleAddGoal} onUpdateGoal={handlers.handleUpdateGoal} onDeleteGoal={handlers.handleDeleteGoal} onAddTransaction={handlers.handleAddTransaction} />;
            case View.TRIPS: return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAddTrip={handlers.handleAddTrip} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onNavigateToShared={() => handleViewChange(View.SHARED)} onEditTransaction={(id) => { setEditTxId(id); setIsTxModalOpen(true); }} onLoadHistory={handlers.loadHistoryWindow} />;
            case View.SHARED: return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} currentDate={currentDate} onAddTransaction={handlers.handleAddTransaction} onAddTransactions={handlers.handleAddTransactions} onUpdateTransaction={handlers.handleUpdateTransaction} onBatchUpdateTransactions={handlers.handleBatchUpdateTransactions} onDeleteTransaction={handlers.handleDeleteTransaction} onNavigateToTrips={() => handleViewChange(View.TRIPS)} currentUserName={sessionUser?.name || 'Eu'} />;
            case View.FAMILY: return <Family members={familyMembers} onAddMember={(m) => handlers.handleAddMember(m as any)} onUpdateMember={(m) => handlers.handleUpdateMember(m as any)} onDeleteMember={handlers.handleDeleteMember} onInviteMember={async (memberId, email) => {
                const { data, error } = await supabase.rpc('invite_user_to_family', { p_member_id: memberId, p_email: email });
                if (error) {
                    alert('Erro ao convidar: ' + error.message);
                } else {
                    if (data?.success) alert(data.message);
                    else alert('Falha: ' + (data?.message || 'Erro desconhecido'));
                }
            }} />;
            case View.INVESTMENTS: return <Investments accounts={calculatedAccounts} transactions={transactions} assets={assets} onAddAsset={handlers.handleAddAsset} onUpdateAsset={handlers.handleUpdateAsset} onDeleteAsset={handlers.handleDeleteAsset} onAddTransaction={handlers.handleAddTransaction} onAddAccount={handlers.handleAddAccount} currentDate={currentDate} showValues={showValues} />;
            case View.SETTINGS: return <Settings customCategories={customCategories} onAddCategory={handlers.handleAddCategory} onDeleteCategory={handlers.handleDeleteCategory} accounts={accounts} transactions={transactions} trips={trips} budgets={budgets} goals={goals} familyMembers={familyMembers} assets={assets} snapshots={snapshots} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onFactoryReset={handlers.handleFactoryReset} currentUserName={sessionUser?.name} currentUserEmail={sessionUser?.email} />;
            default: return <Dashboard accounts={calculatedAccounts} transactions={transactions} goals={goals} currentDate={currentDate} showValues={showValues} />;
        }
    };

    // 2. Render Logic - Inline Conditional
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

    // 3. Main Render - Only reached if !loading and user exists
    return (
        <MainLayout
            activeView={activeView}
            setActiveView={handleViewChange}
            user={storedUser || { id: 'loading', name: 'Carregando...', email: '' }}
            onLogout={handleLogout}
            onNotificationPay={handleNotificationPay}
            showValues={showValues}
            togglePrivacy={() => setShowValues(!showValues)}
            currentDate={currentDate}
            onDateChange={(e) => {
                if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                }
            }}
            onMonthChange={(dir) => {
                const d = new Date(currentDate);
                d.setDate(1);
                d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
                setCurrentDate(d);
            }}
            notifications={activeNotifications}
            onNotificationClick={handleNotificationClick}
            onNotificationDismiss={handleDismissNotification}
            onOpenTxModal={() => setIsTxModalOpen(true)}
            dataInconsistencies={dataInconsistencies}
            onOpenInconsistenciesModal={() => setIsInconsistenciesModalOpen(true)}
        >
            <ErrorBoundary>
                <Suspense fallback={<LoadingScreen />}>
                    {renderContent()}
                </Suspense>
            </ErrorBoundary>

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
                                currentUserName={sessionUser?.name || 'Eu'}
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
                }}
            />

            <GlobalSearch
                isOpen={isSearchOpen}
                onClose={() => setIsSearchOpen(false)}
                transactions={transactions}
                onSelectTransaction={(tx) => {
                    handleViewChange(View.TRANSACTIONS);
                    setEditTxId(tx.id);
                    setIsSearchOpen(false);
                }}
            />
        </MainLayout>
    );
};

export default App;
