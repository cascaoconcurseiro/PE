import React from 'react';
import {
    LayoutDashboard, List, Wallet, TrendingUp, Target, Trophy, Plane, Users, UserCircle,
    Eye, EyeOff, Settings as SettingsIcon, Sun, Moon, LogOut, X, PiggyBank, FileText
} from 'lucide-react';
import { View, UserProfile } from '../../types';
import { useTheme } from '../ui/ThemeContext';

interface SidebarProps {
    activeView: View;
    setActiveView: (view: View) => void;
    user: UserProfile;
    onLogout: () => void;
    showValues: boolean;
    togglePrivacy: () => void;
    isMobile?: boolean; // If true, renders as mobile drawer content
    onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
    activeView,
    setActiveView,
    user,
    onLogout,
    showValues,
    togglePrivacy,
    isMobile = false,
    onCloseMobile
}) => {
    const { theme, toggleTheme } = useTheme();

    const handleMenuClick = (view: View) => {
        setActiveView(view);
        if (isMobile && onCloseMobile) onCloseMobile();
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

    return (
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
                    {onCloseMobile && (
                        <button onClick={onCloseMobile} className="p-2 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    )}
                </div>
            )}

            {!isMobile && (
                <div className="h-16 flex items-center px-6 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shrink-0">
                    <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setActiveView(View.DASHBOARD)}>
                        <div className="w-8 h-8 bg-slate-900 dark:bg-white rounded-lg flex items-center justify-center shadow-lg shrink-0 text-white dark:text-slate-900">
                            <PiggyBank className="w-5 h-5" />
                        </div>
                        <div>
                            <span className="font-bold text-slate-800 dark:text-white text-lg leading-tight block">Pé de Meia</span>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                <div className="space-y-1 mb-6">
                    <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Visão Geral</p>
                    <SidebarItem view={View.DASHBOARD} icon={LayoutDashboard} label="Início" activeBg="bg-emerald-50 dark:bg-emerald-900/20" activeText="text-emerald-700 dark:text-emerald-400" />
                    <SidebarItem view={View.TRANSACTIONS} icon={List} label="Extrato" activeBg="bg-blue-50 dark:bg-blue-900/20" activeText="text-blue-700 dark:text-blue-400" />
                    <SidebarItem view={View.ACCOUNTS} icon={Wallet} label="Minhas Contas" activeBg="bg-violet-50 dark:bg-violet-900/20" activeText="text-violet-700 dark:text-violet-400" />
                    <SidebarItem view={View.INVESTMENTS} icon={TrendingUp} label="Investimentos" activeBg="bg-indigo-50 dark:bg-indigo-900/20" activeText="text-indigo-700 dark:text-indigo-400" />

                </div>

                <div className="space-y-1 mb-6">
                    <p className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">Planejamento</p>
                    <SidebarItem view={View.BUDGETS} icon={Target} label="Orçamentos" activeBg="bg-amber-50 dark:bg-amber-900/20" activeText="text-amber-700 dark:text-amber-400" />
                    <SidebarItem view={View.GOALS} icon={Trophy} label="Objetivos" activeBg="bg-emerald-50 dark:bg-emerald-900/20" activeText="text-emerald-700 dark:text-emerald-400" />
                    <SidebarItem view={View.TRIPS} icon={Plane} label="Viagens" activeBg="bg-purple-50 dark:bg-purple-900/20" activeText="text-purple-700 dark:text-purple-400" />
                    <SidebarItem view={View.SHARED} icon={Users} label="Compartilhado" activeBg="bg-indigo-50 dark:bg-indigo-900/20" activeText="text-indigo-700 dark:text-indigo-400" />
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
};
