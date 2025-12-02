import { Account, Transaction, TransactionType } from '../types';
import { shouldShowTransaction } from '../utils/transactionFilters';


export const getInvoiceData = (account: Account, transactions: Transaction[], referenceDate: Date) => {
    // Default fallback
    if (!account.closingDay || !account.limit) {
        return {
            invoiceTotal: 0,
            transactions: [],
            status: 'OPEN',
            daysToClose: 0,
            closingDate: new Date(),
            dueDate: new Date()
        };
    }

    // Create Date objects relative to the reference date (avoiding time shifts)
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    const currentDay = referenceDate.getDate();
    const closingDay = account.closingDay;

    // Determine the closing date for the CURRENT view's cycle
    // Logic: If we are viewing 'May 10th' and closing is '5th', we are in the cycle that ends 'June 5th'.
    // If we are viewing 'May 1st' and closing is '5th', we are in the cycle that ends 'May 5th'.

    let closingDate: Date;

    // If the reference day is before/on closing day, this cycle ends in the current month
    if (currentDay <= closingDay) {
        closingDate = new Date(year, month, closingDay);
    } else {
        // If reference day is after closing day, this cycle ends in the next month
        closingDate = new Date(year, month + 1, closingDay);
    }

    // Calculate Start Date (Closing Date of previous month + 1 day)
    const startDate = new Date(closingDate);
    startDate.setMonth(startDate.getMonth() - 1);
    startDate.setDate(closingDay + 1);

    // Calculate Due Date
    const dueDate = new Date(closingDate);
    dueDate.setDate(account.dueDay || 10);
    // If due day is smaller than closing day, it usually means next month (e.g. Close 25, Due 5)
    if (account.dueDay && account.dueDay < closingDay) {
        // FIX: Set to day 1 first to prevent month skipping
        dueDate.setDate(1);
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(account.dueDay);
    } else if (dueDate < closingDate) {
        // Safety check: Due date can't be before closing date
        dueDate.setDate(1);
        dueDate.setMonth(dueDate.getMonth() + 1);
        dueDate.setDate(account.dueDay || 10);
    }

    // Filter Transactions using String Comparison (YYYY-MM-DD) to avoid Timezone issues
    // We convert boundaries to YYYY-MM-DD strings for reliable comparison
    const startStr = startDate.toISOString().split('T')[0];
    const endStr = closingDate.toISOString().split('T')[0];

    // Filter out deleted transactions and unpaid debts first
    const activeTransactions = transactions.filter(shouldShowTransaction);

    const txs = activeTransactions.filter(t => {
        if (t.accountId !== account.id) return false;
        // Simple string comparison works for ISO dates (YYYY-MM-DD)
        return t.date >= startStr && t.date <= endStr;
    }).sort((a, b) => b.date.localeCompare(a.date)); // Sort Newest First

    const total = txs.reduce((acc, t) => {
        if (t.isRefund) return acc - t.amount;
        if (t.type === TransactionType.EXPENSE) return acc + t.amount;
        if (t.type === TransactionType.INCOME) return acc - t.amount; // Payment/Credit
        return acc;
    }, 0);

    const now = new Date();
    // Reset hours for fair comparison
    const nowZero = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const closingZero = new Date(closingDate.getFullYear(), closingDate.getMonth(), closingDate.getDate());

    const daysToClose = Math.ceil((closingZero.getTime() - nowZero.getTime()) / (1000 * 3600 * 24));
    const status = closingZero < nowZero ? 'CLOSED' : 'OPEN';

    return {
        invoiceTotal: total,
        transactions: txs,
        status,
        daysToClose,
        closingDate,
        dueDate
    };
};

export const getCommittedBalance = (account: Account, transactions: Transaction[]) => {
    // Filter out deleted transactions and unpaid debts
    const activeTransactions = transactions.filter(shouldShowTransaction);

    const accountTxs = activeTransactions.filter(t => t.accountId === account.id);
    const incomingTxs = activeTransactions.filter(t => t.destinationAccountId === account.id);

    const totalDebt = accountTxs.reduce((acc, t) => {
        if (t.isRefund) return acc + t.amount;
        if (t.type === TransactionType.EXPENSE) return acc - t.amount;
        if (t.type === TransactionType.INCOME) return acc + t.amount;
        if (t.type === TransactionType.TRANSFER) return acc - t.amount;
        return acc;
    }, 0);

    const totalPayments = incomingTxs.reduce((acc, t) => acc + (t.destinationAmount || t.amount), 0);

    return totalDebt + totalPayments + (account.initialBalance || 0);
};

export const getBankExtract = (accountId: string, transactions: Transaction[]) => {
    // Filter out deleted transactions and unpaid debts
    return transactions
        .filter(t => shouldShowTransaction(t) && t.accountId === accountId)
        .sort((a, b) => b.date.localeCompare(a.date));
};