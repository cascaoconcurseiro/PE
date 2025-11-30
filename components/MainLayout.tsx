import React, { useState } from 'react';
import {
    LayoutDashboard, List, Wallet, TrendingUp, Target, Trophy, Plane, Users, UserCircle,
    Eye, EyeOff, Settings as SettingsIcon, Sun, Moon, LogOut, PiggyBank,
    ChevronLeft, ChevronRight, Bell, BellRing, AlertTriangle, Sparkles, Menu, Home, FileText, Plus, X
} from 'lucide-react';
import { View, UserProfile, Transaction } from '../types';
import { useTheme } from './ui/ThemeContext';

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
    onOpenTxModal: () => void;
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
    onOpenTxModal
}) => {
    const { theme, toggleTheme } = useTheme();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    const getMonthInputValue = (date: Date) => {
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        return `${year}-${month}`;
    };

    const handleMenuClick = (view: View) => {
        setActiveView(view);
        setIsMenuOpen(false); // Fecha o menu automaticamente
    };

    const SidebarItem = ({ view, icon: Icon, label, activeBg, activeText }: { view: View, icon: any, label: string, activeBg: string, activeText: string }) => {
        const isActive = activeView === view;
        return (
            <button
                onClick={() => handleMenuClick(view)}
                className={`w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-all duration-200 ${isActive ? `${activeBg} ${activeText} shadow-sm` : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200'}`}
            >
                <Icon className={`w-5 h-5 ${isActive ? '' : 'text-slate-400 dark:text-slate-500'}`} strokeWidth={2} />
                {label}
            </button>
        );
    };

    const SidebarContent = ({ isMobile = false }: { isMobile?: boolean }) => (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {isMobile && (
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-900 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-lg shadow-sm border border-white dark:border-slate-700">
                            {user.name.charAt(0)}
                        </div>
                        <div className="overflow-hidden">
                            <h3 className="font-bold text-slate-900 dark:text-white text-sm truncate max-w-[160px]">{user.name}</h3>
                            <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-[160px]">Conta Premium</p>
                        </div>
                    </div>
                    <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="space-y-1 mb-6">
                    <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Visão Geral</p>
                    <SidebarItem view={View.DASHBOARD} icon={LayoutDashboard} label="Início" activeBg="bg-emerald-50 dark:bg-emerald-900/20" activeText="text-emerald-700 dark:text-emerald-400" />
                    <SidebarItem view={View.TRANSACTIONS} icon={List} label="Extrato" activeBg="bg-blue-50 dark:bg-blue-900/20" activeText="text-blue-700 dark:text-blue-400" />
                    <SidebarItem view={View.ACCOUNTS} icon={Wallet} label="Minhas Contas" activeBg="bg-violet-50 dark:bg-violet-900/20" activeText="text-violet-700 dark:text-violet-400" />
                    <SidebarItem view={View.INVESTMENTS} icon={TrendingUp} label="Investimentos" activeBg="bg-indigo-50 dark:bg-indigo-900/20" activeText="text-indigo-700 dark:text-indigo-400" />
                    <SidebarItem view={View.REPORTS} icon={FileText} label="Relatórios Contábeis" activeBg="bg-orange-50 dark:bg-orange-900/20" activeText="text-orange-700 dark:text-orange-400" />
                </div>

                <div className="space-y-1 mb-6">
                    <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Planejamento</p>
                    <SidebarItem view={View.BUDGETS} icon={Target} label="Orçamentos" activeBg="bg-amber-50 dark:bg-amber-900/20" activeText="text-amber-700 dark:text-amber-400" />
                    <SidebarItem view={View.GOALS} icon={Trophy} label="Objetivos" activeBg="bg-emerald-50 dark:bg-emerald-900/20" activeText="text-emerald-700 dark:text-emerald-400" />
                    <SidebarItem view={View.TRIPS} icon={Plane} label="Viagens" activeBg="bg-purple-50 dark:bg-purple-900/20" activeText="text-purple-700 dark:text-purple-400" />
                    <SidebarItem view={View.SHARED} icon={Users} label="Divisão de Gastos" activeBg="bg-indigo-50 dark:bg-indigo-900/20" activeText="text-indigo-700 dark:text-indigo-400" />
                    <SidebarItem view={View.FAMILY} icon={UserCircle} label="Família" activeBg="bg-pink-50 dark:bg-pink-900/20" activeText="text-pink-700 dark:text-pink-400" />
                </div>

                <div className="space-y-1">
                    <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Preferências</p>
                    <button
                        onClick={togglePrivacy}
                        className="w-full text-left px-4 py-3 rounded-xl flex items-center gap-3 text-sm font-medium transition-all duration-200 text-slate-600 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
                    >
                        {showValues ? <EyeOff className="w-5 h-5 text-slate-400" /> : <Eye className="w-5 h-5 text-slate-400" />}
                        {showValues ? 'Ocultar Valores' : 'Mostrar Valores'}
                    </button>
                    <SidebarItem view={View.SETTINGS} icon={SettingsIcon} label="Configurações" activeBg="bg-slate-100 dark:bg-slate-800" activeText="text-slate-800 dark:text-slate-200" />
                </div>
            </div>

            <div className="p-4 border-t border-slate-100 dark:border-slate-800 pb-safe bg-slate-50/50 dark:bg-slate-900/50 shrink-0 space-y-2">
                <button onClick={toggleTheme} className="w-full py-3 flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-xl font-bold transition-all active:scale-95 shadow-sm text-sm">
                    {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                    {theme === 'dark' ? 'Modo Claro' : 'Modo Escuro'}
                </button>
                <button onClick={onLogout} className="w-full py-3 flex items-center justify-center gap-2 text-red-600 bg-white dark:bg-slate-800 border border-red-100 dark:border-red-900/30 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl font-bold transition-all active:scale-95 shadow-sm text-sm">
                    <LogOut className="w-4 h-4" /> Sair
                </button>
            </div>
        </div>
    );

    const NavItem = ({ view, icon: Icon, label, activeColor }: { view: View, icon: any, label: string, activeColor: string }) => {
        const isActive = activeView === view;
        return (
            <button
                onClick={() => setActiveView(view)}
                className={`flex flex-col items-center justify-center w-full h-full active:scale-90 transition-all duration-200 relative group`}
            >
                <div className={`p-1.5 rounded-xl transition-all duration-300 ${isActive ? `${activeColor.replace('text-', 'bg-')}/10` : 'bg-transparent'}`}>
                    <Icon
                        className={`w-6 h-6 transition-colors duration-300 ${isActive ? activeColor : 'text-slate-400 dark:text-slate-500'}`}
                        strokeWidth={isActive ? 2.5 : 2}
                    />
                </div>
                <span className={`text-[10px] font-bold mt-0.5 transition-colors duration-300 ${isActive ? activeColor : 'text-slate-400 dark:text-slate-500'}`}>
                    {label}
                </span>
            </button>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 font-sans overflow-hidden">
            <aside className="hidden md:flex flex-col w-72 h-full border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm z-20 shrink-0">
                <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView(View.DASHBOARD)}>
                        <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center shadow-lg shrink-0 text-white dark:text-slate-900">
                            <PiggyBank className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="font-bold text-slate-800 dark:text-white text-lg leading-tight block">Pé de Meia</span>
                        </div>
                    </div>
                </div>
                <SidebarContent />
            </aside>

            <div className="flex-1 flex flex-col h-full overflow-hidden relative min-w-0">
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

                        <div className="flex items-center space-x-1 bg-slate-100 dark:bg-slate-800 rounded-full p-1 border border-slate-200 dark:border-slate-700 mx-2 flex-1 justify-center max-w-[160px] md:max-w-[200px]">
                            <button onClick={() => onMonthChange('prev')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all text-slate-600 dark:text-slate-400 active:scale-90"><ChevronLeft className="w-4 h-4" /></button>
                            <div className="flex items-center justify-center relative group cursor-pointer h-8 px-1">
                                <span className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 capitalize pointer-events-none leading-none pt-0.5 truncate">
                                    {currentDate.toLocaleString('pt-BR', { month: 'short', year: '2-digit' }).replace('.', '')}
                                </span>
                                <input
                                    type="month"
                                    value={getMonthInputValue(currentDate)}
                                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-20"
                                    onChange={onDateChange}
                                />
                            </div>
                            <button onClick={() => onMonthChange('next')} className="p-1.5 hover:bg-white dark:hover:bg-slate-700 hover:shadow-sm rounded-full transition-all text-slate-600 dark:text-slate-400 active:scale-90"><ChevronRight className="w-4 h-4" /></button>
                        </div>

                        <div className="flex items-center gap-1 sm:gap-2">
                            <div className="relative">
                                <button
                                    onClick={() => setIsNotifOpen(!isNotifOpen)}
                                    className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors relative shadow-sm active:scale-95"
                                >
                                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                                    {notifications.length > 0 && (
                                        <span className="absolute top-2 right-2.5 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse" />
                                    )}
                                </button>
                                {isNotifOpen && (
                                    <>
                                        <div className="fixed inset-0 z-40" onClick={() => setIsNotifOpen(false)} />
                                        <div className="absolute right-0 top-12 w-72 sm:w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
                                            <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-800/50">
                                                <h3 className="font-bold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
                                                    <BellRing className="w-4 h-4 text-indigo-600 dark:text-indigo-400" /> Notificações
                                                </h3>
                                                <span className="text-xs font-bold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 px-2 py-0.5 rounded-full">
                                                    {notifications.length}
                                                </span>
                                            </div>
                                            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
                                                {notifications.length === 0 ? (
                                                    <div className="p-8 text-center text-slate-500">
                                                        <Sparkles className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                        <p className="text-xs">Tudo tranquilo.</p>
                                                    </div>
                                                ) : (
                                                    <div className="divide-y divide-slate-50 dark:divide-slate-700/50">
                                                        {notifications.map(n => (
                                                            <div key={n.id} className="p-3 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors flex gap-3">
                                                                <div className="mt-1 p-1.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-lg h-fit">
                                                                    <AlertTriangle className="w-3 h-3" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 line-clamp-1">{n.description}</p>
                                                                    <p className="text-[10px] text-slate-500 mb-2">
                                                                        Vence: {new Date(n.notificationDate || n.date).toLocaleDateString('pt-BR')}
                                                                    </p>
                                                                    <div className="flex gap-2">
                                                                        <button onClick={() => { onNotificationClick(n.id); setIsNotifOpen(false); }} className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-1 rounded hover:bg-indigo-100">Ver</button>
                                                                        <button onClick={() => onNotificationDismiss(n.id)} className="text-[10px] font-bold text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded hover:bg-slate-200">OK</button>
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
            </div>

            {isMenuOpen && (
                <div className="md:hidden fixed inset-0 z-50 flex justify-end">
                    <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity" onClick={() => setIsMenuOpen(false)} />
                    <div className="relative w-full sm:w-80 bg-white dark:bg-slate-900 h-full shadow-2xl animate-in slide-in-from-right duration-300 flex flex-col">
                        <SidebarContent isMobile={true} />
                    </div>
                </div>
            )}

            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 pb-safe pointer-events-none">
                <div className="w-full max-w-[1600px] mx-auto px-2 pb-2 pt-0">
                    <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border border-slate-200/50 dark:border-slate-800/50 shadow-[0_-8px_30px_rgba(0,0,0,0.04)] h-[80px] rounded-3xl flex items-center justify-between pointer-events-auto relative px-2">
                        <div className="flex items-center justify-around w-[40%]">
                            <NavItem view={View.DASHBOARD} icon={Home} label="Início" activeColor="text-emerald-600 dark:text-emerald-400" />
                            <NavItem view={View.TRANSACTIONS} icon={FileText} label="Extrato" activeColor="text-blue-600 dark:text-blue-400" />
                        </div>

                        <div className="absolute left-1/2 -top-6 transform -translate-x-1/2 z-[60] pointer-events-auto">
                            <button
                                onClick={onOpenTxModal}
                                className="w-16 h-16 rounded-[22px] bg-slate-900 dark:bg-slate-100 flex items-center justify-center text-white dark:text-slate-900 shadow-[0_8px_25px_rgba(15,23,42,0.3)] hover:shadow-[0_12px_30px_rgba(15,23,42,0.4)] hover:scale-105 active:scale-95 transition-all duration-300 border-[4px] border-slate-50 dark:border-slate-950 ring-1 ring-slate-100 dark:ring-slate-800"
                            >
                                <Plus className="w-7 h-7" strokeWidth={3} />
                            </button>
                        </div>

                        <div className="flex items-center justify-around w-[40%]">
                            <NavItem view={View.ACCOUNTS} icon={Wallet} label="Contas" activeColor="text-violet-600 dark:text-violet-400" />
                            <NavItem view={View.INVESTMENTS} icon={TrendingUp} label="Invest." activeColor="text-indigo-600 dark:text-indigo-400" />
                        </div>
                    </div>
                </div>
            </nav>
        </div>
    );
};