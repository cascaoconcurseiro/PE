
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

                // 1. Check Helper
                let isForeign = isForeignTransaction(t, accounts);

                // 2. Redundant Inline Check (Safety Net)
                if (!isForeign && t.accountId) {
                    const acc = accounts.find(a => a.id === t.accountId);
                    if (acc && acc.currency && acc.currency !== 'BRL') {
                        isForeign = true;
                    }
                }

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
                let expenseVal = 0;

                // CASH FLOW LOGIC: If I am Payer, I spent the FULL amount.
                // If I am NOT Payer (Shared with me), I spent only my effective share.
                if (t.isShared && t.payerId && t.payerId !== 'me') {
                    expenseVal = calculateMyExpense(t);
                } else {
                    // Payer (me) or Regular Expense -> Full Amount
                    expenseVal = t.amount;
                }

                // Convert if needed (though usually processed in BRL)
                // Note: calculateMyExpense returns share of ORIGINAL amount.
                // t.amount is ORIGINAL amount.
                // so expenseVal is in ORIGINAL currency.
                // effectively we need to convert expenseVal to displayCurrency (BRL most likely)

                // Re-using the conversion logic from lines 63-80 via 'toBRL' concept, 
                // but we need to do it manually here since 'val' variable above was naive.

                // Actually, let's look at how 'val' was calculated above: it used toBRL(t.amount).
                // We should apply the same logic to expenseVal.

                let finalVal = 0;
                if (displayCurrency !== 'BRL' && (t.currency || 'BRL') === displayCurrency) {
                    finalVal = expenseVal;
                } else {
                    // Assuming expenseVal is proportional to t.amount, we can use exchange rate
                    if (t.exchangeRate && t.exchangeRate > 0) finalVal = expenseVal * t.exchangeRate;
                    else finalVal = convertToBRL(expenseVal, t.currency || 'BRL');
                }

                exp += t.isRefund ? -finalVal : finalVal;
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

    return { filteredTxs, groupedTxs, income, expense, balance, currency };
};
