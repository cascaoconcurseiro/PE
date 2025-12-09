import { useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { isSameMonth } from '../utils';
import { calculateMyExpense } from '../utils/expenseUtils';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { convertToBRL } from '../services/currencyService';

interface UseTransactionFiltersProps {
    transactions: Transaction[];
    currentDate: Date;
    searchTerm: string;
    activeTab: 'REGULAR' | 'TRAVEL';
}

export const useTransactionFilters = ({ transactions, currentDate, searchTerm, activeTab }: UseTransactionFiltersProps) => {

    const filteredTxs = useMemo(() => {
        return transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts
            .filter(t => {
                const matchesDate = isSameMonth(t.date, currentDate);
                const matchesSearch = searchTerm ? t.description.toLowerCase().includes(searchTerm.toLowerCase()) : true;

                // Logic: Regular = BRL only. Travel = Foreign Currency.
                const isForeign = t.currency && t.currency !== 'BRL';

                if (activeTab === 'REGULAR') {
                    return matchesDate && matchesSearch && !isForeign;
                } else {
                    // Travel Tab: Show foreign currency transactions.
                    return matchesDate && matchesSearch && isForeign;
                }
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, currentDate, searchTerm, activeTab]);

    const { income, expense, balance } = useMemo(() => {
        let inc = 0;
        let exp = 0;

        const toBRL = (val: number, t: Transaction) => {
            if (t.exchangeRate && t.exchangeRate > 0) return val * t.exchangeRate;
            return convertToBRL(val, t.currency || 'BRL');
        };

        filteredTxs.forEach(t => {
            if (t.type === TransactionType.INCOME) {
                const val = toBRL(t.amount, t);
                inc += t.isRefund ? -val : val;
            } else if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                const valBRL = toBRL(myVal, t);
                exp += t.isRefund ? -valBRL : valBRL;
            }
        });
        return { income: inc, expense: exp, balance: inc - exp };
    }, [filteredTxs]);

    const groupedTxs = useMemo(() => {
        const groups: Record<string, Transaction[]> = {};
        filteredTxs.forEach(t => {
            const dateStr = t.date;
            if (!groups[dateStr]) groups[dateStr] = [];
            groups[dateStr].push(t);
        });
        return groups;
    }, [filteredTxs]);

    return { filteredTxs, groupedTxs, income, expense, balance };
};
