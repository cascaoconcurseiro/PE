import React, { useState } from 'react';
import { PiggyBank, ChevronLeft, ChevronRight, AlertTriangle, Menu, Plus, Eye, EyeOff } from 'lucide-react';
import { View, UserProfile, Transaction } from '../types';
import { Sidebar } from './layout/Sidebar';
import { MobileNav } from './layout/MobileNav';
import { NotificationSystem } from './layout/NotificationSystem';

interface MainLayoutProps {
    children: React.ReactNode;
    activeView: View;
    setActiveView: (view: View) => void;
    user: UserProfile;
    onLogout: () => void;
    showValues: boolean;
    togglePrivacy: () => void;
    currentDate: Date;
    onDateChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    onMonthChange: (direction: 'prev' | 'next') => void;
    notifications: Transaction[];
    onNotificationClick: (id: string) => void;
    onNotificationDismiss: (id: string) => void;
    onNotificationPay: (id: string) => void;
    onOpenTxModal: () => void;
    dataInconsistencies: string[];
    onOpenInconsistenciesModal: () => void;
}

export const MainLayout: React.FC<MainLayoutProps> = ({
    children,
    activeView,
    setActiveView,
    user,
    onLogout,
    showValues,
    togglePrivacy,
    currentDate,
    onDateChange,
    onMonthChange,
    notifications,
    onNotificationClick,
    onNotificationDismiss,
    onNotificationPay,
    onOpenTxModal,
    dataInconsistencies,
    onOpenInconsistenciesModal
}) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const getMonthInputValue = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    };

    return (
        <div className="flex h-screen sm:h-screen supports-[height:100dvh]:h-[100dvh] bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            {/* DESKTOP SIDEBAR */}
            <aside className="hidden md:flex flex-col w-72 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-20 shrink-0">
                <Sidebar
                    activeView={activeView}
                    setActiveView={setActiveView}
                    user={user}
                    onLogout={onLogout}
                    showValues={showValues}
                    togglePrivacy={togglePrivacy}
                />
            </aside>

            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
                {/* GLOBAL HEADER */}
                <header className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200/60 dark:border-slate-800/60 sticky top-0 z-30 shrink-0 transition-all">
                    <div className="w-full px-4 md:px-8 h-16 flex items-center justify-between">
                        <div className="flex md:hidden items-center space-x-2 cursor-pointer active:opacity-70 transition-opacity" onClick={() => setActiveView(View.DASHBOARD)}>
                            <div className="w-9 h-9 bg-slate-900 dark:bg-white rounded-xl flex items-center justify-center shadow-lg shrink-0 text-white dark:text-slate-900">
                                <PiggyBank className="w-5 h-5" />
                            </div>
                        </div>

                        <div className="hidden md:block">
                            <h2 className="text-xl font-bold text-slate-800 dark:text-white">{activeView}</h2>
                        </div>

                        {/* Month Selector */}
                        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 mx-2 flex-1 justify-center max-w-[170px] md:max-w-[220px]">
                            <button onClick={() => onMonthChange('prev')} className="p-3 md:p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all text-slate-600 dark:text-slate-400 active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                            <div className="flex items-center justify-center relative group cursor-pointer h-8 px-2 min-w-[90px]">
                                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 pointer-events-none leading-none pt-0.5 truncate">
                                    {currentDate.toLocaleString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase()}/{currentDate.getFullYear().toString().slice(2)}
                                </span>
                                <input
                                    type="month"
                                    value={getMonthInputValue(currentDate)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                                    onChange={onDateChange}
                                />
                            </div>
                            <button onClick={() => onMonthChange('next')} className="p-3 md:p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all text-slate-600 dark:text-slate-400 active:scale-90"><ChevronRight className="w-4 h-4" /></button>
                        </div>

                        {/* Top Right Actions */}
                        <div className="flex items-center gap-1 sm:gap-2">
                            {dataInconsistencies.length > 0 && (
                                <button
                                    onClick={onOpenInconsistenciesModal}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 flex items-center justify-center text-amber-600 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors relative shadow-sm active:scale-95"
                                    title={`${dataInconsistencies.length} inconsistência${dataInconsistencies.length !== 1 ? 's' : ''} detectada${dataInconsistencies.length !== 1 ? 's' : ''}`}
                                >
                                    <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-900">
                                        {dataInconsistencies.length}
                                    </span>
                                </button>
                            )}

                            <NotificationSystem
                                notifications={notifications}
                                onNotificationClick={onNotificationClick}
                                onNotificationDismiss={onNotificationDismiss}
                                onNotificationPay={onNotificationPay}
                            />

                            <button onClick={onOpenTxModal} className="hidden md:flex items-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-4 py-2 rounded-full text-sm font-bold hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-sm active:scale-95">
                                <Plus className="w-4 h-4" /> Nova Transação
                            </button>
                            <button onClick={togglePrivacy} className="p-2 text-slate-600 dark:text-slate-400 hover:text-emerald-700 dark:hover:text-emerald-400 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-full transition-all active:bg-slate-100">
                                {showValues ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                            </button>
                            <button onClick={() => setIsMenuOpen(true)} className="md:hidden p-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-all active:bg-slate-100">
                                <Menu className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-950 scroll-smooth pb-32 md:pb-8">
                    <div className="w-full max-w-[1600px] mx-auto p-4 md:p-8">
                        {children}
                    </div>
                </main>
            </div >

            {/* MOBILE DRAWER */}
            {
                isMenuOpen && (
                    <div className="md:hidden fixed inset-0 z-50 flex justify-end">
                        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)} />
                        <div className="relative w-full sm:w-80 bg-white dark:bg-slate-900 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                            <Sidebar
                                activeView={activeView}
                                setActiveView={setActiveView}
                                user={user}
                                onLogout={onLogout}
                                showValues={showValues}
                                togglePrivacy={togglePrivacy}
                                isMobile={true}
                                onCloseMobile={() => setIsMenuOpen(false)}
                            />
                        </div>
                    </div>
                )
            }

            {/* MOBILE BOTTOM NAV */}
            <MobileNav
                activeView={activeView}
                setActiveView={setActiveView}
                onOpenTxModal={onOpenTxModal}
            />
        </div >
    );
};