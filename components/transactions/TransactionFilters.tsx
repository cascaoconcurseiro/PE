import React from 'react';
import { Search, Filter, Calendar } from 'lucide-react';

interface TransactionFiltersProps {
    activeTab: 'REGULAR' | 'TRAVEL';
    setActiveTab: (tab: 'REGULAR' | 'TRAVEL') => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({ activeTab, setActiveTab, searchTerm, setSearchTerm }) => {
    return (
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center bg-white dark:bg-slate-800 p-2 sm:p-2 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
            {/* TABS - Pill Style */}
            <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1.5 rounded-2xl w-full sm:w-auto">
                <button
                    onClick={() => setActiveTab('REGULAR')}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'REGULAR'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md transform scale-105'
                        : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500'
                        }`}
                >
                    Extrato
                </button>
                <button
                    onClick={() => setActiveTab('TRAVEL')}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 ${activeTab === 'TRAVEL'
                        ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-md transform scale-105'
                        : 'text-slate-500 dark:text-slate-400 hover:text-indigo-500'
                        }`}
                >
                    Viagens
                </button>
            </div>

            {/* SEARCH BAR */}
            <div className="relative w-full sm:w-72">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-slate-400" />
                </div>
                <input
                    type="text"
                    placeholder="Buscar transação..."
                    className="block w-full pl-10 pr-3 py-3 border-none rounded-2xl bg-slate-50 dark:bg-slate-700/50 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 text-sm font-bold transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
    );
};
