import React from 'react';
import { Home, Plane, History, RefreshCcw } from 'lucide-react';

interface SharedFiltersProps {
    activeTab: 'REGULAR' | 'TRAVEL' | 'HISTORY';
    setActiveTab: (tab: 'REGULAR' | 'TRAVEL' | 'HISTORY') => void;
    onOpenImport: () => void;
}

export const SharedFilters: React.FC<SharedFiltersProps> = ({ activeTab, setActiveTab, onOpenImport }) => {
    return (
        <div className="flex justify-center">
            <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl inline-flex shadow-inner">
                <button onClick={() => setActiveTab('REGULAR')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'REGULAR' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Home className="w-4 h-4" /> Mensal</button>
                <button onClick={() => setActiveTab('TRAVEL')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'TRAVEL' ? 'bg-white dark:bg-slate-800 text-violet-700 dark:text-violet-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><Plane className="w-4 h-4" /> Viagens</button>
                <button onClick={() => setActiveTab('HISTORY')} className={`px-4 py-2 text-sm font-bold rounded-lg transition-all flex items-center gap-2 ${activeTab === 'HISTORY' ? 'bg-white dark:bg-slate-800 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-slate-500 dark:text-slate-400'}`}><History className="w-4 h-4" /> Histórico</button>
            </div>
            <button
                onClick={onOpenImport}
                className="ml-4 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20 font-bold flex items-center gap-2 transition-all active:scale-95"
            >
                <RefreshCcw className="w-4 h-4" /> Importar Parcelas
            </button>
        </div>
    );
};
