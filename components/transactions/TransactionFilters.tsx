import React from 'react';
import { Search } from 'lucide-react';

interface TransactionFiltersProps {
    activeTab: 'REGULAR' | 'TRAVEL';
    setActiveTab: (tab: 'REGULAR' | 'TRAVEL') => void;
    searchTerm: string;
    setSearchTerm: (term: string) => void;
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({ activeTab, setActiveTab, searchTerm, setSearchTerm }) => {
    return (
        <div className="space-y-4">
            {/* TABS */}
            <div className="flex gap-2 bg-slate-100 dark:bg-slate-800 p-1 rounded-xl w-fit">
                <button
                    onClick={() => setActiveTab('REGULAR')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'REGULAR' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Transações Regulares
                </button>
                <button
                    onClick={() => setActiveTab('TRAVEL')}
                    className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}
                >
                    Viagens Internacionais
                </button>
            </div>

            {/* SEARCH BAR */}
            <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-2 flex items-center gap-2">
                <Search className="w-5 h-5 text-slate-400 dark:text-slate-300 ml-2" />
                <input
                    type="text"
                    placeholder="Buscar transações..."
                    className="flex-1 outline-none text-sm font-medium text-slate-700 dark:text-white placeholder:text-slate-400 dark:placeholder:text-slate-300 h-10 bg-transparent"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
        </div>
    );
};
