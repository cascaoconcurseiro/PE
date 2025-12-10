import { Transaction } from '../types';

/**
 * Determines if a transaction should be visible in lists, extracts, and reports.
 * 
 * Filters out:
 * 1. Deleted transactions
 * 2. Unpaid debts (when someone else paid for me and I haven't settled yet)
 */
export const shouldShowTransaction = (t: Transaction): boolean => {
    // Filter deleted transactions
    if (t.deleted) return false;

    // Filter unpaid debts (someone else paid, I owe them)
    // These should ONLY appear in the "Shared" module until settled
    if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
        return false;
    }

    // Filter transactions without account (Pending/Shadow/Orphan)
    // These should not appear in the main ledger until linked to an account
    if (!t.accountId) return false;

    return true;
};

/**
 * Returns only transactions that should be visible to the user.
 * Use this instead of raw transaction arrays for displays, reports, and calculations.
 */
export const getVisibleTransactions = (transactions: Transaction[]): Transaction[] => {
    return transactions.filter(shouldShowTransaction);
};

/**
 * Checks if a transaction represents an unpaid debt (someone paid for me).
 * These transactions exist in the database but should not appear in regular views.
 */
export const isUnpaidDebt = (t: Transaction): boolean => {
    return !!(t.payerId && t.payerId !== 'me' && !t.isSettled);
};
