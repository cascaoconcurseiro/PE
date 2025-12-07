import { useMemo } from 'react';
import { Transaction, TransactionType } from '../types';
import { isSameMonth } from '../utils';
import { calculateMyExpense } from '../utils/expenseUtils';
import { shouldShowTransaction } from '../utils/transactionFilters';

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
        filteredTxs.forEach(t => {
            if (t.type === TransactionType.INCOME) inc += t.isRefund ? -t.amount : t.amount;
            else if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                exp += t.isRefund ? -myVal : myVal;
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
