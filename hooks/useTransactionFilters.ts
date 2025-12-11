```typescript
import { useMemo } from 'react';
import { Transaction, TransactionType, Account } from '../types';
import { isSameMonth } from '../utils';
import { calculateMyExpense } from '../utils/expenseUtils';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { convertToBRL } from '../services/currencyService';
import { isForeignTransaction } from '../utils/transactionUtils';

interface UseTransactionFiltersProps {
    transactions: Transaction[];
    accounts: Account[]; // NEW: Required for foreign check
    currentDate: Date;
    searchTerm: string;
    activeTab: 'REGULAR' | 'TRAVEL';
}

export const useTransactionFilters = ({ transactions, accounts, currentDate, searchTerm, activeTab }: UseTransactionFiltersProps) => {

    const filteredTxs = useMemo(() => {
        return transactions
            .filter(shouldShowTransaction) // Filter out unpaid debts
            .filter(t => {
                const matchesDate = isSameMonth(t.date, currentDate);
                const matchesSearch = searchTerm ? t.description.toLowerCase().includes(searchTerm.toLowerCase()) : true;

                const isForeign = isForeignTransaction(t, accounts);

                if (activeTab === 'REGULAR') {
                    // Regular: Must match date, search, AND NOT be foreign
                    return matchesDate && matchesSearch && !isForeign;
                } else {
                    // Travel Tab: Show foreign transactions
                    return matchesDate && matchesSearch && isForeign;
                }
            })
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [transactions, accounts, currentDate, searchTerm, activeTab]);

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
