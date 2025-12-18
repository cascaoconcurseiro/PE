import React from 'react';
import { Search, Filter, Download, Printer } from 'lucide-react';
import { Button } from '../ui/Button';
import { AssetType } from '../../types';

interface InvestmentFiltersProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filterType: AssetType | 'ALL';
    setFilterType: (type: AssetType | 'ALL') => void;
    onExport: () => void;
    onPrint: () => void;
}

export const InvestmentFilters: React.FC<InvestmentFiltersProps> = ({
    searchTerm,
    setSearchTerm,
    filterType,
    setFilterType,
    onExport,
    onPrint
}) => {
    return (
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col md:flex-row gap-4 items-center sticky top-4 z-20">
            <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                    type="text"
                    placeholder="Buscar ativos (ex: PETR4, Bitcoin)..."
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-medium text-slate-700 dark:text-white placeholder:text-slate-400"
                />
            </div>

            <div className="flex flex-wrap gap-3 w-full md:w-auto">
                <div className="relative min-w-[140px]">
                    <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    <select
                        value={filterType}
                        onChange={e => setFilterType(e.target.value as 'ALL' | AssetType)}
                        className="w-full pl-9 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-700 dark:text-white appearance-none cursor-pointer"
                    >
                        <option value="ALL">Todos os Tipos</option>
                        {(Object.values(AssetType) as string[]).map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                </div>

                <Button onClick={onExport} variant="secondary" className="h-12 px-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" title="Baixar CSV">
                    <Download className="w-5 h-5" />
                </Button>
                <Button onClick={onPrint} variant="secondary" className="h-12 px-4 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700" title="Imprimir Relatório">
                    <Printer className="w-5 h-5" />
                </Button>
            </div>
        </div>
    );
};
