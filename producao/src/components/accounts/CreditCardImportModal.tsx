import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, DollarSign, ChevronLeft, ChevronRight, Tag } from 'lucide-react';
import { Account, Transaction, TransactionType, Category } from '../../types';
import { Button } from '../ui/Button';
import { EXPENSE_CATEGORIES } from '../../utils/categoryConstants';

interface CreditCardImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account;
    onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
}

export const CreditCardImportModal: React.FC<CreditCardImportModalProps> = ({ isOpen, onClose, account, onImport }) => {
    const [year, setYear] = useState(new Date().getFullYear());
    const [category, setCategory] = useState<Category>(Category.OPENING_BALANCE);
    // Add isPast to state structure
    const [months, setMonths] = useState<{ date: string; label: string; amount: string; isPast: boolean }[]>([]);

    useEffect(() => {
        if (isOpen) {
            const nextMonths = [];
            const today = new Date();
            // Create a date for the 1st of the current month to compare against
            // Anything strictly smaller than this is "past month"
            const currentMonthStart = new Date(today.getFullYear(), today.getMonth(), 1);

            for (let i = 0; i < 12; i++) {
                // Criar data com dia 1 do mês i do ano selecionado
                const targetDate = new Date(year, i, 1);

                // Check if past
                // Note: We compare timestamps or date objects. 
                // targetDate is 00:00:00 of the 1st of that month.
                const isPast = targetDate < currentMonthStart;

                // Format label (e.g., "Janeiro")
                const monthName = targetDate.toLocaleDateString('pt-BR', { month: 'long' });
                const label = `${monthName} ${year}`;

                // Formatar data manualmente
                const y = targetDate.getFullYear();
                const m = String(targetDate.getMonth() + 1).padStart(2, '0');
                const d = String(targetDate.getDate()).padStart(2, '0');
                const dateStr = `${y}-${m}-${d}`;

                nextMonths.push({
                    date: dateStr,
                    label: label.charAt(0).toUpperCase() + label.slice(1),
                    amount: '',
                    isPast
                });
            }

            setMonths(nextMonths);
        }
    }, [isOpen, year, account]);

    const handleAmountChange = (index: number, value: string) => {
        // Prevent editing if somehow triggered
        if (months[index].isPast) return;

        const newMonths = [...months];
        newMonths[index].amount = value;
        setMonths(newMonths);
    };

    const handleSave = () => {
        const transactionsToCreate: Omit<Transaction, 'id'>[] = months
            .filter(m => m.amount && parseFloat(m.amount) > 0)
            .map(m => ({
                date: m.date,
                amount: parseFloat(m.amount),
                type: TransactionType.EXPENSE,
                category: category,
                description: `Fatura Importada - ${m.label}`,
                accountId: account.id,
                isSettled: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deleted: false
            }));

        if (transactionsToCreate.length === 0) {
            return;
        }

        onImport(transactionsToCreate);
        onClose();
        
        // Mostrar toast informativo sobre navegação
        // Note: addToast would need to be imported from useToast hook
        // For now, we'll rely on the parent component's success message
    };

    // Helper to format date string (yyyy-mm-dd) to pt-BR (dd/mm/yyyy) without timezone shift
    const formatDisplayDate = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        // Map m to month name
        const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
        return date.toLocaleDateString('pt-BR');
    };

    // Helper: Manual day check since formatDisplayDate might still shift if new Date() is used with implied midnight
    // We already have Y M D.
    // Let's just use a map for month names if we want "31 de Março".
    // Or just "01/01/2026"
    // The previous code had "Vence em 31/12/2025" because of timezone.
    // Our dateStr IS "2026-01-01". We want to show "01/01/2026".
    const formatDateSimple = (dateStr: string) => {
        const [y, m, d] = dateStr.split('-');
        return `${d}/${m}/${y}`;
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Importar Faturas</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Preencha os valores para {account.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                {/* Year Selector & Category */}
                <div className="px-6 py-4 bg-slate-50 dark:bg-slate-800/30 flex flex-col sm:flex-row items-center justify-between gap-4 border-b border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setYear(y => y - 1)}
                            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                        >
                            <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </button>
                        <span className="text-lg font-bold text-slate-800 dark:text-white tabular-nums">
                            {year}
                        </span>
                        <button
                            onClick={() => setYear(y => y + 1)}
                            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-full transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Tag className="w-4 h-4 text-slate-400" />
                        <select 
                            value={category} 
                            onChange={e => setCategory(e.target.value as Category)}
                            className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm font-bold text-slate-700 dark:text-slate-300"
                        >
                            {EXPENSE_CATEGORIES.map((group, index) => (
                                <optgroup key={index} label={group.label}>
                                    {group.options.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    {/* Info Banner */}
                    <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700/50 rounded-xl">
                        <p className="text-sm text-blue-900 dark:text-blue-100 font-medium">
                            💡 <strong>Dica:</strong> Após importar, use as setas (← →) no topo da tela para navegar até o mês da fatura importada.
                        </p>
                    </div>
                    
                    <div className="grid gap-4">
                        {months.map((month, index) => (
                            <div key={month.date} className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3 w-full sm:w-1/3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 shrink-0">
                                        <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-slate-700 dark:text-slate-300 capitalize text-sm">{month.label}</p>
                                        <p className="text-[10px] text-slate-500 dark:text-slate-400">Vence em {formatDateSimple(month.date)}</p>
                                    </div>
                                </div>
                                <div className="flex-1 relative">
                                    <DollarSign className={`absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 ${month.isPast ? 'text-slate-200 dark:text-slate-700' : 'text-slate-400'}`} />
                                    {month.isPast ? (
                                        <div className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-100 dark:border-slate-800 bg-slate-100 dark:bg-slate-800/50 text-slate-400 dark:text-slate-600 font-bold text-sm flex items-center select-none">
                                            Mês encerrado
                                        </div>
                                    ) : (
                                        <input
                                            type="number"
                                            placeholder="0,00"
                                            value={month.amount}
                                            onChange={(e) => handleAmountChange(index, e.target.value)}
                                            className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                        />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="p-6 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 rounded-b-2xl flex justify-end gap-3 shrink-0">
                    <Button variant="secondary" onClick={onClose}>Cancelar</Button>
                    <Button onClick={handleSave} disabled={!months.some(m => m.amount && parseFloat(m.amount) > 0)}>
                        <Save className="w-4 h-4 mr-2" />
                        Salvar Faturas
                    </Button>
                </div>
            </div>
        </div>
    );
};
