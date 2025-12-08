import { Account, Transaction, TransactionType, Category } from '../types';
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

    // UX FIX: If Closing Day is early (e.g. 1st-5th), selecting "May 1st" usually implies wanting to see May's spending.
    // Standard logic would give "May 1st" closing (which is April's spending).
    // We force a shift forward if both days are small to show the "Spending Month" (May 2 - Jun 1)

    // If the reference day is before/on closing day, this cycle ends in the current month
    let closingDate: Date;
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

        // 1. Strict Date Range Check (Standard)
        const inRange = t.date >= startStr && t.date <= endStr;
        if (inRange) return true;

        // 2. Fallback for Installments & Imports (Force Show if Month Matches)
        // This fixes issues where an installment or imported bill falls exactly on a boundary
        // or shift logic hides it.
        const isSpecialType = t.isInstallment || t.category === Category.OPENING_BALANCE;

        if (isSpecialType) {
            const tDate = new Date(t.date);
            // Use UTC parts to avoid timezone shifts affecting month check
            const tMonth = parseInt(t.date.split('-')[1]) - 1; // 0-indexed
            const tYear = parseInt(t.date.split('-')[0]);

            // Match with Closing Date Month/Year
            if (tMonth === closingDate.getMonth() && tYear === closingDate.getFullYear()) {
                return true;
            }
        }

        return false;
    });

    // Opening Balances Logic merged above, but let's keep specific Opening Balance check 
    // just in case 'isSpecialType' logic missed something (redundancy is fine here if unique)
    // Actually, the above logic covers it better. Let's simplify.

    const finalTxs = txs.sort((a, b) => b.date.localeCompare(a.date));

    const total = finalTxs.reduce((acc, t) => {
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
        transactions: finalTxs,
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

export const calculateHistoricalBalance = (account: Account, transactions: Transaction[], referenceDate: Date) => {
    // 1. Determine the cutoff date (End of the selected month)
    const year = referenceDate.getFullYear();
    const month = referenceDate.getMonth();
    // Day 0 of next month is the last day of this month
    const endOfPeriod = new Date(year, month + 1, 0);
    const endStr = endOfPeriod.toISOString().split('T')[0];

    // 2. Filter transactions: specific account, not deleted, date <= endOfPeriod
    const activeTransactions = transactions.filter(shouldShowTransaction);

    // Transactions where this account is the source
    const accountTxs = activeTransactions.filter(t => t.accountId === account.id && t.date <= endStr);

    // Transactions where this account is the destination (Transfers)
    const incomingTxs = activeTransactions.filter(t => t.destinationAccountId === account.id && t.date <= endStr);

    // 3. Sum up Source Transactions (Expenses reduce, Incomes increase)
    const balanceChange = accountTxs.reduce((acc, t) => {
        if (t.type === TransactionType.EXPENSE) return acc - t.amount;
        if (t.type === TransactionType.INCOME) return acc + t.amount;
        // Refunds on expenses: Increase balance (reverse expense)
        if (t.isRefund) return acc + t.amount;

        // Transfer Out: Reduces balance
        if (t.type === TransactionType.TRANSFER) return acc - t.amount;

        return acc;
    }, 0);

    // 4. Sum up Incoming Transactions (Transfers In increase balance)
    const incomingTotal = incomingTxs.reduce((acc, t) => {
        return acc + (t.destinationAmount || t.amount);
    }, 0);

    // 5. Add Initial Balance
    // Initial Balance is the starting point.
    // If we assume initialBalance is "at start of time", this works.
    return (account.initialBalance || 0) + balanceChange + incomingTotal;
};

export const getBankExtract = (accountId: string, transactions: Transaction[], referenceDate?: Date) => {
    // Filter out deleted transactions and unpaid debts
    let txs = transactions
        .filter(t => shouldShowTransaction(t) && t.accountId === accountId);

    if (referenceDate) {
        // Filter by month/year of referenceDate
        const targetMonth = referenceDate.getMonth();
        const targetYear = referenceDate.getFullYear();

        txs = txs.filter(t => {
            const tDate = new Date(t.date);
            // Use local date parts to match user expectation (avoid timezone shifts)
            // Ideally we should use ISO strings or a utility like isSameMonth
            // But here raw date parts usually work since inputs are YYYY-MM-DD
            // Let's use string checks for safety against timezone shifts
            const [y, m] = t.date.split('-').map(Number);
            return y === targetYear && (m - 1) === targetMonth; // m is 1-indexed in split
        });
    }

    return txs.sort((a, b) => b.date.localeCompare(a.date));
};