import React from 'react';
import { Search, Filter, X } from 'lucide-react';
import { Account, CustomCategory } from '../../types';

interface TransactionFiltersProps {
    searchTerm: string;
    setSearchTerm: (term: string) => void;
    filters?: {
        accountId?: string;
        type?: 'RECEITA' | 'DESPESA' | 'TRANSFERÊNCIA';
        category?: string;
        dateFrom?: string;
        dateTo?: string;
    };
    onFiltersChange?: (filters: {
        accountId?: string;
        type?: 'RECEITA' | 'DESPESA' | 'TRANSFERÊNCIA';
        category?: string;
        dateFrom?: string;
        dateTo?: string;
    }) => void;
    accounts?: Account[];
    customCategories?: CustomCategory[];
}

export const TransactionFilters: React.FC<TransactionFiltersProps> = ({ 
    searchTerm, 
    setSearchTerm,
    filters = {},
    onFiltersChange,
    accounts = [],
    customCategories = []
}) => {
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    const handleFilterChange = (key: string, value: string | undefined) => {
        if (onFiltersChange) {
            onFiltersChange({
                ...filters,
                [key]: value || undefined
            });
        }
    };

    const hasActiveFilters = Object.keys(filters).some(key => filters[key as keyof typeof filters]);

    const clearAllFilters = () => {
        if (onFiltersChange) {
            onFiltersChange({});
        }
        setSearchTerm('');
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 justify-between items-end sm:items-center bg-white dark:bg-slate-800 p-2 sm:p-2 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm">
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

                {/* FILTER TOGGLE */}
                <div className="flex items-center gap-2">
                    {hasActiveFilters && (
                        <button
                            onClick={clearAllFilters}
                            className="flex items-center gap-1 px-3 py-2 text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30 rounded-xl transition-colors"
                        >
                            <X className="w-3 h-3" />
                            Limpar
                        </button>
                    )}
                    <button
                        onClick={() => setShowAdvanced(!showAdvanced)}
                        className={`flex items-center gap-2 px-4 py-3 rounded-2xl font-bold text-sm transition-all ${
                            showAdvanced || hasActiveFilters
                                ? 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600'
                        }`}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                        {hasActiveFilters && (
                            <span className="bg-indigo-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                                {Object.keys(filters).filter(key => filters[key as keyof typeof filters]).length}
                            </span>
                        )}
                    </button>
                </div>
            </div>

            {/* ADVANCED FILTERS */}
            {showAdvanced && (
                <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Account Filter */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Conta
                            </label>
                            <select
                                value={filters.accountId || ''}
                                onChange={(e) => handleFilterChange('accountId', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="">Todas as contas</option>
                                {accounts.map(account => (
                                    <option key={account.id} value={account.id}>
                                        {account.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Type Filter */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Tipo
                            </label>
                            <select
                                value={filters.type || ''}
                                onChange={(e) => handleFilterChange('type', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="">Todos os tipos</option>
                                <option value="RECEITA">Receita</option>
                                <option value="DESPESA">Despesa</option>
                                <option value="TRANSFERÊNCIA">Transferência</option>
                            </select>
                        </div>

                        {/* Category Filter */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Categoria
                            </label>
                            <select
                                value={filters.category || ''}
                                onChange={(e) => handleFilterChange('category', e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                            >
                                <option value="">Todas as categorias</option>
                                {customCategories.map(category => (
                                    <option key={category.id} value={category.name}>
                                        {category.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Date Range */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
                                Período
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="date"
                                    value={filters.dateFrom || ''}
                                    onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
                                    className="flex-1 px-2 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                                <input
                                    type="date"
                                    value={filters.dateTo || ''}
                                    onChange={(e) => handleFilterChange('dateTo', e.target.value)}
                                    className="flex-1 px-2 py-2 text-xs border border-slate-200 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
