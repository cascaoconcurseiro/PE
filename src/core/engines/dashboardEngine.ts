
import { Transaction, Account, TransactionType, AccountType } from '../../types';
import { shouldShowTransaction } from '../../utils/transactionFilters';
import { isForeignTransaction } from '../../utils/transactionUtils';
import { isSameMonth } from '../../utils';
import { convertToBRL } from '../../services/currencyService';
import { calculateEffectiveTransactionValue } from './financialLogic';

/**
 * Filter transactions for the dashboard based on strict rules:
 * - Not deleted
 * - Not foreign (unless account/context allows) -> Actually dashboard is BRL only usually.
 * - Exclude Foreign Trips context if needed.
 */
export const filterDashboardTransactions = (
    transactions: Transaction[],
    accounts: Account[],
    trips?: import('../../types').Trip[]
): Transaction[] => {
    return transactions.filter(t => {
        if (t.deleted) return false;
        if (isForeignTransaction(t, accounts)) return false;

        // STRICT TRIP CHECK: If tx belongs to a Foreign Trip, exclude it from BRL Dashboard
        if (t.tripId && trips) {
            const trip = trips.find(tr => tr.id === t.tripId);
            if (trip && trip.currency && trip.currency !== 'BRL') return false;
        }

        // Redundant Safety Check
        if (t.accountId) {
            const acc = accounts.find(a => a.id === t.accountId);
            if (acc && acc.currency && acc.currency !== 'BRL') return false;
        }
        return true;
    });
};

/**
 * Calculate Net Worth for Dashboard
 * Assets = Cash Accounts + Receivables (BRL)
 * Liabilities = Credit Cards (Negative Balance) + Payables (BRL)
 * Note: User requested Cash Basis (ignoring future payables for now?) 
 * Actually code says: "Net Worth = Current Cash Balance only".
 */
export const calculateDashboardNetWorth = (
    accounts: Account[],
    dashboardTransactions: Transaction[], // Already filtered for BRL
    trips?: import('../../types').Trip[]
): number => {
    // 1. Bank Balances
    const cashBalance = accounts.reduce((acc, curr) => {
        // STRICT CURRENCY CHECK
        if (curr.currency && curr.currency !== 'BRL') return acc;

        const safeBalance = (curr.balance !== undefined && curr.balance !== null && !isNaN(curr.balance)) ? curr.balance : 0;

        if (curr.type === AccountType.CREDIT_CARD) {
            return acc - Math.abs(safeBalance);
        }
        return acc + safeBalance;
    }, 0);

    // Logic for Receivables/Payables was commented out or restricted in original hook.
    // "Net Worth = Current Cash Balance only"
    return cashBalance;
};

/**
 * Calculate Upcoming Bills (Top 3)
 */
export const getUpcomingBills = (
    dashboardTransactions: Transaction[]
): Transaction[] => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return dashboardTransactions
        .filter(shouldShowTransaction)
        .filter(t => t.enableNotification && t.type === TransactionType.EXPENSE && !t.isRefund)
        .filter(t => {
            const targetDateStr = t.notificationDate || t.date;
            const tDate = new Date(targetDateStr);
            return tDate >= today || (tDate < today && isSameMonth(targetDateStr, today));
        })
        .sort((a, b) => {
            const dateA = new Date(a.notificationDate || a.date).getTime();
            const dateB = new Date(b.notificationDate || b.date).getTime();
            return dateA - dateB;
        })
        .slice(0, 3);
};

/**
 * Prepare Spending Chart Data
 */
export const calculateSpendingChartData = (
    monthlyTransactions: Transaction[],
    accounts: Account[],
    spendingView: 'CATEGORY' | 'SOURCE'
) => {
    const chartTxs = monthlyTransactions.filter(t => t.type === TransactionType.EXPENSE);

    if (spendingView === 'CATEGORY') {
        return Object.entries(
            chartTxs.reduce((acc, t) => {
                const account = accounts.find(a => a.id === t.accountId);

                let expenseValue = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
                if (t.isShared && t.payerId && t.payerId !== 'me') {
                    expenseValue = calculateEffectiveTransactionValue(t);
                }

                const amountBRL = convertToBRL(expenseValue, account?.currency || 'BRL');
                const amount = t.isRefund ? -amountBRL : amountBRL;
                const catKey = String(t.category);
                acc[catKey] = (acc[catKey] || 0) + (amount as number);
                return acc;
            }, {} as Record<string, number>)
        )
            .filter(([_, val]) => (val as number) > 0)
            .map(([name, value]) => ({ name, value: value as number }))
            .sort((a, b) => b.value - a.value);
    } else {
        return Object.entries(
            chartTxs.reduce((acc, t) => {
                const account = accounts.find(a => a.id === t.accountId);

                let expenseValue = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
                if (t.isShared && t.payerId && t.payerId !== 'me') {
                    expenseValue = calculateEffectiveTransactionValue(t);
                }

                const amountBRL = convertToBRL(expenseValue, account?.currency || 'BRL');
                const amount = t.isRefund ? -amountBRL : amountBRL;

                let sourceLabel = 'Outros';
                if (account) {
                    if (account.type === AccountType.CREDIT_CARD) sourceLabel = 'Cartão de Crédito';
                    else if (account.type === AccountType.CHECKING || account.type === AccountType.SAVINGS) sourceLabel = 'Conta Bancária';
                    else if (account.type === AccountType.CASH) sourceLabel = 'Dinheiro';
                    else sourceLabel = account.type;
                }

                acc[sourceLabel] = (acc[sourceLabel] || 0) + (amount as number);
                return acc;
            }, {} as Record<string, number>)
        )
            .filter(([_, val]) => (val as number) > 0)
            .map(([name, value]) => ({ name, value: value as number }))
            .sort((a, b) => b.value - a.value);
    }
};
