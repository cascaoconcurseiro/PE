import React, { useState, useEffect } from 'react';
import { X, Save, Calendar, DollarSign } from 'lucide-react';
import { Account, Transaction, TransactionType, Category } from '../../types';
import { Button } from '../ui/Button';

interface CreditCardImportModalProps {
    isOpen: boolean;
    onClose: () => void;
    account: Account;
    onImport: (transactions: Omit<Transaction, 'id'>[]) => void;
}

export const CreditCardImportModal: React.FC<CreditCardImportModalProps> = ({ isOpen, onClose, account, onImport }) => {
    const [months, setMonths] = useState<{ date: string; label: string; amount: string }[]>([]);

    useEffect(() => {
        if (isOpen) {
            const nextMonths = [];
            const today = new Date();

            // FIX: Usar o dia de vencimento como referência para garantir que
            // a fatura caia no ciclo correto
            const dueDay = account.dueDay || 10;

            for (let i = 0; i < 12; i++) {
                // Calcular o mês/ano correto
                const targetMonth = today.getMonth() + i;
                const targetYear = today.getFullYear() + Math.floor(targetMonth / 12);
                const finalMonth = targetMonth % 12;

                // Criar data com dia 1 primeiro
                const d = new Date(targetYear, finalMonth, 1);

                // Format label (e.g., "Novembro 2025")
                const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });

                // Usar o dia de vencimento como data da transação
                const daysInMonth = new Date(targetYear, finalMonth + 1, 0).getDate();
                const targetDate = new Date(targetYear, finalMonth, Math.min(dueDay, daysInMonth));

                nextMonths.push({
                    date: targetDate.toISOString().split('T')[0],
                    label: label.charAt(0).toUpperCase() + label.slice(1),
                    amount: ''
                });
            }
            setMonths(nextMonths);
        }
    }, [isOpen, account]);

    const handleAmountChange = (index: number, value: string) => {
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
                category: Category.OPENING_BALANCE,
                description: `Fatura Importada - ${m.label}`,
                accountId: account.id,
                isSettled: false,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                deleted: false
            }));

        onImport(transactionsToCreate);
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-in fade-in zoom-in duration-200">
                <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-slate-800 dark:text-white">Importar Faturas</h2>
                        <p className="text-sm text-slate-500 dark:text-slate-400">Preencha os valores das faturas futuras para {account.name}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full transition-colors">
                        <X className="w-5 h-5 text-slate-500" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
                    <div className="grid gap-4">
                        {months.map((month, index) => (
                            <div key={month.date} className="flex items-center gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-200 dark:border-slate-700">
                                <div className="flex items-center gap-3 w-1/3">
                                    <div className="p-2 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700">
                                        <Calendar className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                                    </div>
                                    <div>
                                        <p className="font-bold text-slate-700 dark:text-slate-300 capitalize text-sm">{month.label}</p>
                                        <p className="text-[10px] text-slate-500">Vence em {new Date(month.date).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                </div>
                                <div className="flex-1 relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                    <input
                                        type="number"
                                        placeholder="0,00"
                                        value={month.amount}
                                        onChange={(e) => handleAmountChange(index, e.target.value)}
                                        className="w-full pl-9 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-bold outline-none focus:ring-2 focus:ring-violet-500 transition-all"
                                    />
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
