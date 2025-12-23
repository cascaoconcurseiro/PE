
import { useState, useMemo } from 'react';
import { Transaction, TransactionType, Category } from '../../types';
import { shouldShowTransaction } from '../../utils/transactionFilters';

export const useTransactionFilters = (transactions: Transaction[], currentDate: Date) => {
    // Basic Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
    const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
    const [accountFilter, setAccountFilter] = useState<string>('ALL');

    // Advanced Filters
    const [showReconciled, setShowReconciled] = useState(true); // "Exibir conferidos" defaults to true or user preference?

    // Derived: Filtered Transactions
    const filteredTransactions = useMemo(() => {
        if (!transactions) return [];

        return transactions.filter(t => {
            // 0. Base visibility (Deleted/Unpaid/Orphan) - centralized utility
            if (!shouldShowTransaction(t)) return false;

            // 1. Month Filter (Strict)
            const tDate = new Date(t.date);
            // Handling Timezone offset for strict date comparison? 
            // Usually we compare Month/Year of t.date string vs currentDate
            // The transactions date is YYYY-MM-DD string usually.
            // Let's rely on the input props.

            // Check if transaction falls in current Month/Year
            // Using UTC to avoid timezone shifts on the edge
            // t.date is YYYY-MM-DD
            const [tYear, tMonth] = t.date.split('-').map(Number);
            const currentYear = currentDate.getFullYear();
            const currentMonth = currentDate.getMonth() + 1;

            if (tYear !== currentYear || tMonth !== currentMonth) {
                return false;
            }

            // 2. Search Term
            if (searchTerm) {
                const searchLower = searchTerm.toLowerCase();
                const matchesDesc = t.description.toLowerCase().includes(searchLower);
                // Maybe match category or amount too?
                const matchesAmount = t.amount.toString().includes(searchLower);
                if (!matchesDesc && !matchesAmount) return false;
            }

            // 3. Type Filter
            if (typeFilter !== 'ALL' && t.type !== typeFilter) return false;

            // 4. Category Filter
            if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;

            // 5. Account Filter
            if (accountFilter !== 'ALL' && t.accountId !== accountFilter) return false;

            return true;
        });
    }, [transactions, currentDate, searchTerm, typeFilter, categoryFilter, accountFilter]);

    return {
        // State
        searchTerm, setSearchTerm,
        typeFilter, setTypeFilter,
        categoryFilter, setCategoryFilter,
        accountFilter, setAccountFilter,
        showReconciled, setShowReconciled,

        // Result
        filteredTransactions
    };
};
