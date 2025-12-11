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
                    // Regular: Must match date, search, NOT be foreign, AND NOT be part of a trip.
                    return matchesDate && matchesSearch && !isForeign && !t.tripId;
                } else {
                    // Travel Tab: Show foreign currency transactions OR transactions linked to a trip.
                    // If local currency but has tripId, show here? Yes, user says "any trip transaction".
                    return matchesDate && matchesSearch && (isForeign || !!t.tripId);
                }
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, currentDate, searchTerm, activeTab]);

    const { income, expense, balance, currency } = useMemo(() => {
        let inc = 0;
        let exp = 0;

        // Determine dominant currency
        // If all filtered transactions have the same currency (and it's not empty), use it.
        // Otherwise default to BRL.
        const currencies = new Set(filteredTxs.map(t => t.currency || 'BRL'));
        const dominantCurrency = currencies.size === 1 ? Array.from(currencies)[0] : 'BRL';

        // Only switch display currency if not BRL and we are in TRAVEL mode or searching explicitly
        // Actually, if we have a single currency context, we should respect it.
        const displayCurrency = dominantCurrency;

        const toBRL = (val: number, t: Transaction) => {
            if (t.exchangeRate && t.exchangeRate > 0) return val * t.exchangeRate;
            return convertToBRL(val, t.currency || 'BRL');
        };

        filteredTxs.forEach(t => {
            let val = 0;

            if (displayCurrency !== 'BRL' && (t.currency || 'BRL') === displayCurrency) {
                // Same currency, no conversion needed
                val = t.amount;
            } else {
                // Different currency or BRL target, force conversion (fallback)
                // If we are in USD mode but have a BRL transaction, we need to convert BRL to USD? 
                // Complex. simpler: if mixed, force BRL (handled by dominantCurrency check above).
                // So if we are here, dominantCurrency IS BRL.
                val = toBRL(t.amount, t);
            }

            if (t.type === TransactionType.INCOME) {
                inc += t.isRefund ? -val : val;
            } else if (t.type === TransactionType.EXPENSE) {
                const myVal = calculateMyExpense(t);
                // IF we are displaying in foreign currency, calculateMyExpense logic (splits) 
                // might need to ensure it returns portion in ORIGINAL currency.
                // calculateMyExpense usually returns proportion of t.amount. YES.

                exp += t.isRefund ? -myVal : myVal;
            }
        });

        return { income: inc, expense: exp, balance: inc - exp, currency: displayCurrency };
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
