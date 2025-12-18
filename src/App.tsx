import React, { useState, useEffect, useMemo, useCallback, lazy, Suspense, useTransition, useRef } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from './integrations/supabase/client';
import { Auth } from './components/Auth';
import { View, SyncStatus, TransactionType, UserProfile } from './types';
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
import { useToast } from './components/ui/Toast';

import { lazyImport } from './utils/lazyImport';
import { APP_VERSION } from './config/appVersion';
import { PendingSettlement, SettlementRequest } from './types/settlement';
import { logger } from './utils/logger';

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
    const [sessionUser, setSessionUser] = useState<UserProfile | null>(null);
    const [isSessionLoading, setIsSessionLoading] = useState(true);
    const [isPending, startTransition] = useTransition();

    const {
        user: storedUser, accounts, transactions, trips, budgets, goals, familyMembers, assets, snapshots, customCategories,
        isLoading: isDataLoading, isLoadingHistory, // Added isLoadingHistory
        dataInconsistencies, handlers, ensurePeriodLoaded
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
    const { notifications: systemNotifications, markAsRead } = useSystemNotifications(sessionUser?.id);

    const [pendingSettlements, setPendingSettlements] = useState<PendingSettlement[]>([]);
    const [activeSettlementRequest, setActiveSettlementRequest] = useState<SettlementRequest | null>(null);
    const [settlementToPay, setSettlementToPay] = useState<SettlementRequest | null>(null);

    // SAFETY BRAKE: Prevent infinite loops in effect
    const lastAttemptedDate = useRef<number>(0);

    // ...


    // ...

    // Welcome Toast Removed

    // Initial Setup & Version Check
    useEffect(() => {
        const checkVersion = async () => {
            const storedVersion = localStorage.getItem('dyad_app_version');

            // IF VERSION MISMATCH (or first run): FORCE CLEANUP
            if (storedVersion !== APP_VERSION) {
                logger.warn(`Detectada nova versão: ${APP_VERSION} (Antiga: ${storedVersion}). Forçando atualização...`);

                // 1. Wipe Local Storage (Cache)
                localStorage.clear();

                // 2. Set New Version
                localStorage.setItem('dyad_app_version', APP_VERSION);

                // 3. Force Sign Out to ensure clean session state
                await supabase.auth.signOut();

                // 4. Force Hard Reload (Bypassing Service Worker if active)
                window.location.reload();
                return; // Stop execution
            }
        };
        checkVersion();

        const init = async () => {
            try {
                // RACE CONDITION: Timeout after 3s if Supabase is slow/stuck
                const sessionPromise = supabase.auth.getSession();
                const timeoutPromise = new Promise<{ data: { session: null }, error: Error }>((resolve) =>
                    setTimeout(() => resolve({ data: { session: null }, error: new Error("Timeout") }), 3000)
                );

                const { data: { session }, error } = await Promise.race([sessionPromise, timeoutPromise]);

                if (error && error.message !== "Timeout") throw error;

                startTransition(() => {
                    if (session) {
                        setSessionUser({
                            id: session.user.id,
                            name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'Usuário',
                            email: session.user.email || ''
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
            startTransition(() => {
                if (session) {
                    setSessionUser({
                        id: session.user.id,
                        name: session.user.user_metadata.name || session.user.email?.split('@')[0] || 'Usuário',
                        email: session.user.email || ''
                    });
                    // Ensure loading is cleared on auth change too
                    setIsSessionLoading(false);
                } else {
                    setSessionUser(null);
                    setIsSessionLoading(false);
                }
            });
        });
        return () => subscription.unsubscribe();
    }, []);

    // ONE-TIME: Smart Sync for Month Navigation
    // ONE-TIME: Smart Sync for Month Navigation
    useEffect(() => {
        if (sessionUser && ensurePeriodLoaded) {
            // Check if we already tried this date recently (deduplication)
            const dateKey = currentDate.getTime();
            if (lastAttemptedDate.current === dateKey) return;

            lastAttemptedDate.current = dateKey;

            const timer = setTimeout(() => {
                ensurePeriodLoaded(currentDate);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [currentDate, sessionUser, ensurePeriodLoaded]);

    // Helper Functions & Memos
    const handleViewChange = (view: View) => startTransition(() => setActiveView(view));

    // ✅ REESTRUTURAÇÃO: Backend é fonte de verdade para saldos
    // Frontend apenas usa account.balance do banco (já calculado pelo trigger)
    const calculatedAccounts = useMemo(() => {
        return accounts || [];
    }, [accounts]);

    // Projeção de saldo: Usa saldo atual do banco + transações futuras do mês
    const projectedAccounts = useMemo(() => {
        if (!accounts || !transactions) return [];
        
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        const now = new Date();
        now.setHours(0, 0, 0, 0);

        return accounts.map(acc => {
            // Saldo atual vem do banco (já calculado pelo trigger)
            const currentBalance = acc.balance || 0;
            
            // Calcular impacto de transações futuras (ainda não refletidas no saldo do banco)
            const futureTxs = transactions.filter(t =>
                t.accountId === acc.id &&
                new Date(t.date) > now &&
                new Date(t.date) <= endOfMonth &&
                !t.deleted
            );

            const futureImpact = futureTxs.reduce((sum, t) => {
                if (t.type === TransactionType.INCOME) return sum + t.amount;
                if (t.type === TransactionType.EXPENSE) return sum - t.amount;
                if (t.type === TransactionType.TRANSFER && t.accountId === acc.id) {
                    return sum - t.amount; // Transferência de saída
                }
                return sum;
            }, 0);

            return { ...acc, balance: currentBalance + futureImpact };
        });
    }, [accounts, transactions, currentDate]);

    const activeNotifications = useMemo(() => {
        if (!transactions || !accounts) return [];
        const notifs: Array<{ id: string; type: string; title?: string; description: string; message?: string; date?: string }> = [];

        // Removed pendingSharedRequests logic

        if (systemNotifications) {
            const mapped = systemNotifications
                .filter(sn => !sn.is_read) // ONLY SHOW UNREAD
                .map(sn => ({
                    id: sn.id,
                    title: sn.title,
                    description: sn.message || '',
                    type: sn.type,
                    date: sn.created_at
                }));
            notifs.push(...mapped);
        }
        return notifs;
    }, [transactions, accounts, dismissedNotifications, systemNotifications]);

    // Re-implementing critical handlers
    const handleLogout = useCallback(async () => {
        await supabase.auth.signOut();
        await handlers.handleLogout();
        // SECURITY: Force reload to clear all memory states/caches
        window.location.reload();
    }, [handlers]);

    const handleNotificationPay = useCallback(() => { }, []);
    const handleNotificationClick = useCallback(async (id: string) => {
        const sysNotif = systemNotifications?.find(n => n.id === id);

        if (sysNotif) {
            // 1. Mark as Read
            await markAsRead(id);

            // 2. Perform Navigation Action
            const { type, data } = sysNotif;

            if (type === 'INVITE') {
                // Navigate to Family view to see the new connection
                setActiveView(View.FAMILY);
                // Optional: Show a toast or highlight?
            } else if (type === 'TRIP') {
                setActiveView(View.TRIPS);
                // If we implemented opening a specific trip, we'd use data.tripId here
            } else if (type === 'TRANSACTION') {
                setActiveView(View.TRANSACTIONS);
                if (data?.transactionId && typeof data.transactionId === 'string') {
                    setEditTxId(data.transactionId);
                    setIsTxModalOpen(true);
                }
            }
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
            case View.DASHBOARD: return <Dashboard accounts={calculatedAccounts} projectedAccounts={projectedAccounts} transactions={transactions} trips={trips} goals={goals} currentDate={currentDate} showValues={showValues} onEditRequest={() => { }} onNotificationPay={() => { }} isLoading={isDataLoading} isLoadingHistory={isLoadingHistory} pendingSettlements={pendingSettlements} onOpenShared={() => handleViewChange(View.SHARED)} onOpenSettlement={() => { }} userName={sessionUser?.name} />;
            case View.ACCOUNTS: return <Accounts accounts={calculatedAccounts} transactions={transactions} members={familyMembers} onAddAccount={handlers.handleAddAccount} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onDeleteTransaction={handlers.handleDeleteTransaction} onAddTransaction={handlers.handleAddTransaction} onAddTransactions={handlers.handleAddTransactions} showValues={showValues} currentDate={currentDate} onAnticipate={handlers.handleAnticipateInstallments} initialAccountId={navigatedAccountId} onClearInitialAccount={() => setNavigatedAccountId(null)} />;
            case View.TRANSACTIONS: return <Transactions transactions={transactions} accounts={calculatedAccounts} trips={trips} familyMembers={familyMembers} customCategories={customCategories} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAnticipate={handlers.handleAnticipateInstallments} currentDate={currentDate} showValues={showValues} initialEditId={editTxId} onClearEditId={() => setEditTxId(null)} onNavigateToAccounts={() => handleViewChange(View.ACCOUNTS)} onNavigateToTrips={() => handleViewChange(View.TRIPS)} onNavigateToFamily={() => handleViewChange(View.FAMILY)} currentUserName={sessionUser?.name || 'Eu'} currentUserId={sessionUser?.id} />;
            case View.BUDGETS: return <Budgets budgets={budgets} transactions={transactions} onAddBudget={handlers.handleAddBudget} onUpdateBudget={handlers.handleUpdateBudget} onDeleteBudget={handlers.handleDeleteBudget} currentDate={currentDate} />;
            case View.GOALS: return <Goals goals={goals} accounts={calculatedAccounts} onAddGoal={handlers.handleAddGoal} onUpdateGoal={handlers.handleUpdateGoal} onDeleteGoal={handlers.handleDeleteGoal} onAddTransaction={handlers.handleAddTransaction} />;
            case View.TRIPS: return <Trips trips={trips} transactions={transactions} accounts={calculatedAccounts} familyMembers={familyMembers} onAddTransaction={handlers.handleAddTransaction} onUpdateTransaction={handlers.handleUpdateTransaction} onDeleteTransaction={handlers.handleDeleteTransaction} onAddTrip={handlers.handleAddTrip} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onNavigateToShared={() => handleViewChange(View.SHARED)} onEditTransaction={(id) => { setEditTxId(id); setIsTxModalOpen(true); }} currentUserId={sessionUser?.id} />;
            case View.SHARED: return <Shared transactions={transactions} trips={trips} members={familyMembers} accounts={calculatedAccounts} currentDate={currentDate} onAddTransaction={handlers.handleAddTransaction} onAddTransactions={handlers.handleAddTransactions} onUpdateTransaction={handlers.handleUpdateTransaction} onBatchUpdateTransactions={handlers.handleBatchUpdateTransactions} onDeleteTransaction={handlers.handleDeleteTransaction} onNavigateToTrips={() => handleViewChange(View.TRIPS)} currentUserName={sessionUser?.name || 'Eu'} />;
            case View.FAMILY: return <Family members={familyMembers} transactions={transactions} onAddMember={(m) => handlers.handleAddMember(m as Omit<import('./types').FamilyMember, 'id'>)} onUpdateMember={(m) => handlers.handleUpdateMember(m as import('./types').FamilyMember)} onDeleteMember={handlers.handleDeleteMember} onInviteMember={async (memberId, email) => {
                const { data, error } = await supabase.rpc('invite_user_to_family', { member_id: memberId, email_to_invite: email });
                if (error) {
                    alert('Erro ao convidar: ' + error.message);
                } else {
                    if (data?.success) alert(data.message);
                    else alert('Falha: ' + (data?.message || 'Erro desconhecido'));
                }
            }} />;
            case View.INVESTMENTS: return <Investments accounts={calculatedAccounts} transactions={transactions} assets={assets} onAddAsset={handlers.handleAddAsset} onUpdateAsset={handlers.handleUpdateAsset} onDeleteAsset={handlers.handleDeleteAsset} onAddTransaction={handlers.handleAddTransaction} onAddAccount={handlers.handleAddAccount} currentDate={currentDate} showValues={showValues} />;
            case View.SETTINGS: return <Settings customCategories={customCategories} onAddCategory={handlers.handleAddCategory} onDeleteCategory={handlers.handleDeleteCategory} accounts={accounts} transactions={transactions} trips={trips} budgets={budgets} goals={goals} familyMembers={familyMembers} assets={assets} snapshots={snapshots} onUpdateAccount={handlers.handleUpdateAccount} onDeleteAccount={handlers.handleDeleteAccount} onUpdateTrip={handlers.handleUpdateTrip} onDeleteTrip={handlers.handleDeleteTrip} onFactoryReset={handlers.handleFactoryReset} currentUserName={sessionUser?.name} currentUserEmail={sessionUser?.email} />;
            default: return <Dashboard accounts={calculatedAccounts} transactions={transactions} trips={trips} goals={goals} currentDate={currentDate} showValues={showValues} />;
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
            user={storedUser || sessionUser || { id: 'temp', name: 'Visitante', email: '' }}
            onLogout={handleLogout}
            onNotificationPay={handleNotificationPay}
            showValues={showValues}
            togglePrivacy={() => setShowValues(!showValues)}
            currentDate={currentDate}
            onDateChange={(e) => {
                if (e.target.value) {
                    const [year, month] = e.target.value.split('-');
                    // Usar startTransition para não bloquear UI
                    startTransition(() => {
                        setCurrentDate(new Date(parseInt(year), parseInt(month) - 1, 1));
                    });
                }
            }}
            onMonthChange={(dir) => {
                // Usar startTransition para transição suave sem flicker
                startTransition(() => {
                    setCurrentDate(prev => {
                        const d = new Date(prev);
                        d.setDate(1);
                        d.setMonth(d.getMonth() + (dir === 'next' ? 1 : -1));
                        return d;
                    });
                });
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
                                currentUserId={sessionUser?.id}
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
