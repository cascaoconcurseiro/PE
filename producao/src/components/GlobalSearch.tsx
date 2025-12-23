import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Search, X, ArrowRight, Clock, Tag } from 'lucide-react';
import { Transaction, Category, TransactionType } from '../types';
import { formatCurrency, getCategoryIcon } from '../utils';

interface GlobalSearchProps {
    isOpen: boolean;
    onClose: () => void;
    transactions: Transaction[];
    onSelectTransaction: (tx: Transaction) => void;
    onNavigate?: (view: string) => void;
}

export const GlobalSearch: React.FC<GlobalSearchProps> = ({
    isOpen,
    onClose,
    transactions,
    onSelectTransaction,
    onNavigate
}) => {
    const [query, setQuery] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const inputRef = useRef<HTMLInputElement>(null);

    // Focus input when opened
    useEffect(() => {
        if (isOpen) {
            setQuery('');
            setSelectedIndex(0);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Filter transactions
    const results = useMemo(() => {
        if (!query.trim()) return [];

        const lowerQuery = query.toLowerCase();
        return transactions
            .filter(t =>
                t.description.toLowerCase().includes(lowerQuery) ||
                t.category?.toLowerCase().includes(lowerQuery) ||
                t.amount.toString().includes(query)
            )
            .slice(0, 10); // Limit to 10 results
    }, [query, transactions]);

    // Keyboard navigation
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!isOpen) return;

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex(i => Math.min(i + 1, results.length - 1));
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex(i => Math.max(i - 1, 0));
            } else if (e.key === 'Enter' && results[selectedIndex]) {
                e.preventDefault();
                onSelectTransaction(results[selectedIndex]);
                onClose();
            } else if (e.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, results, selectedIndex, onSelectTransaction, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                onClick={onClose}
            />

            {/* Search Modal */}
            <div className="relative w-full max-w-xl mx-4 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-200 dark:border-slate-700">
                {/* Search Input */}
                <div className="flex items-center gap-3 p-4 border-b border-slate-200 dark:border-slate-700">
                    <Search className="w-5 h-5 text-slate-400" />
                    <input
                        ref={inputRef}
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Buscar transações..."
                        className="flex-1 bg-transparent text-lg font-medium text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-none"
                    />
                    <div className="flex items-center gap-2">
                        <kbd className="hidden sm:inline-flex items-center px-2 py-1 text-xs font-medium text-slate-500 bg-slate-100 dark:bg-slate-700 rounded">
                            ESC
                        </kbd>
                        <button
                            onClick={onClose}
                            className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5 text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* Results */}
                <div className="max-h-[400px] overflow-y-auto">
                    {query && results.length === 0 && (
                        <div className="p-8 text-center text-slate-500">
                            <Search className="w-10 h-10 mx-auto mb-3 opacity-30" />
                            <p>Nenhum resultado para "{query}"</p>
                        </div>
                    )}

                    {results.map((tx, index) => {
                        const CatIcon = getCategoryIcon(tx.category as Category);
                        const isSelected = index === selectedIndex;

                        return (
                            <button
                                key={tx.id}
                                onClick={() => {
                                    onSelectTransaction(tx);
                                    onClose();
                                }}
                                className={`w-full flex items-center gap-4 p-4 text-left transition-colors ${isSelected
                                    ? 'bg-indigo-50 dark:bg-indigo-900/30'
                                    : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'
                                    }`}
                            >
                                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tx.type === TransactionType.INCOME
                                    ? 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600'
                                    : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                                    }`}>
                                    <CatIcon className="w-5 h-5" />
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-slate-900 dark:text-white truncate">
                                        {tx.description}
                                    </p>
                                    <div className="flex items-center gap-2 text-xs text-slate-500">
                                        <Clock className="w-3 h-3" />
                                        <span>{new Date(tx.date).toLocaleDateString('pt-BR')}</span>
                                        {tx.category && (
                                            <>
                                                <Tag className="w-3 h-3 ml-2" />
                                                <span>{tx.category}</span>
                                            </>
                                        )}
                                    </div>
                                </div>

                                <div className="text-right">
                                    <p className={`font-bold ${tx.type === TransactionType.INCOME
                                        ? 'text-emerald-600'
                                        : 'text-slate-900 dark:text-white'
                                        }`}>
                                        {tx.type === TransactionType.INCOME ? '+' : '-'}{formatCurrency(tx.amount, 'BRL')}
                                    </p>
                                </div>

                                {isSelected && (
                                    <ArrowRight className="w-4 h-4 text-indigo-500" />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Footer */}
                {!query && (
                    <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                        <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">↑↓</kbd>
                                navegar
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">Enter</kbd>
                                selecionar
                            </span>
                            <span className="flex items-center gap-1">
                                <kbd className="px-1.5 py-0.5 bg-slate-200 dark:bg-slate-700 rounded">Esc</kbd>
                                fechar
                            </span>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
