import React from 'react';
import { Home, FileText, Wallet, TrendingUp, Plus } from 'lucide-react';
import { View } from '../../types';

interface MobileNavProps {
    activeView: View;
    setActiveView: (view: View) => void;
    onOpenTxModal: () => void;
}

export const MobileNav: React.FC<MobileNavProps> = ({ activeView, setActiveView, onOpenTxModal }) => {

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
    );
};
