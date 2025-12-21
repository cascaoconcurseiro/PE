
import { Transaction, Account, TransactionType, AccountType } from '../../types';
import { shouldShowTransaction } from '../../utils/transactionFilters';
import { isForeignTransaction } from '../../utils/transactionUtils';
import { isSameMonth } from '../../utils';
import { convertToBRL } from '../../services/currencyService';
import { calculateEffectiveTransactionValue } from './financialLogic';
import { SafeFinancialCalculator } from '../../utils/SafeFinancialCalculator';
import { FinancialErrorDetector } from '../../utils/FinancialErrorDetector';

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
    return FinancialErrorDetector.safeCalculate(
        () => {
            // Sanitizar dados de entrada
            const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
            
            // 1. Bank Balances
            const cashBalance = SafeFinancialCalculator.safeOperation(
                () => safeAccounts.reduce((acc, curr) => {
                    // STRICT CURRENCY CHECK
                    if (curr.currency && curr.currency !== 'BRL') return acc;

                    const safeBalance = SafeFinancialCalculator.toSafeNumber(curr.balance, 0);

                    if (curr.type === AccountType.CREDIT_CARD) {
                        return acc - Math.abs(safeBalance);
                    }
                    return acc + safeBalance;
                }, 0),
                0,
                'cash_balance_calculation'
            );

            // Logic for Receivables/Payables was commented out or restricted in original hook.
            // "Net Worth = Current Cash Balance only"
            return cashBalance;
        },
        'calculateDashboardNetWorth',
        'net_worth_calculation',
        [accounts, dashboardTransactions, trips],
        0
    ).result;
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
    return FinancialErrorDetector.safeCalculate(
        () => {
            // Sanitizar dados de entrada
            const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(monthlyTransactions || []);
            const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
            
            const chartTxs = safeTransactions.filter(t => {
                // Only include expenses that are not unpaid debts
                if (t.type !== TransactionType.EXPENSE) return false;
                
                // Skip unpaid debts (someone else paid and I haven't settled yet)
                if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
                    return false; // Skip unpaid debts - they shouldn't appear in spending charts
                }
                
                return true;
            });

            if (spendingView === 'CATEGORY') {
                return Object.entries(
                    chartTxs.reduce((acc, t) => {
                        const account = safeAccounts.find(a => a.id === t.accountId);

                        let expenseValue = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
                        if (t.isShared && t.payerId && t.payerId !== 'me') {
                            expenseValue = SafeFinancialCalculator.safeOperation(
                                () => calculateEffectiveTransactionValue(t),
                                expenseValue,
                                'effective_transaction_value'
                            );
                        }

                        const amountBRL = SafeFinancialCalculator.safeCurrencyConversion(
                            expenseValue, 
                            account?.currency || 'BRL'
                        );
                        const amount = t.isRefund ? -amountBRL : amountBRL;
                        const catKey = String(t.category || 'Outros');
                        acc[catKey] = SafeFinancialCalculator.safeSum([acc[catKey] || 0, amount]);
                        return acc;
                    }, {} as Record<string, number>)
                )
                    .filter(([_, val]) => SafeFinancialCalculator.toSafeNumber(val, 0) > 0)
                    .map(([name, value]) => ({ 
                        name, 
                        value: SafeFinancialCalculator.toSafeNumber(value, 0) 
                    }))
                    .sort((a, b) => b.value - a.value);
            } else {
                return Object.entries(
                    chartTxs.reduce((acc, t) => {
                        const account = safeAccounts.find(a => a.id === t.accountId);

                        let expenseValue = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
                        if (t.isShared && t.payerId && t.payerId !== 'me') {
                            expenseValue = SafeFinancialCalculator.safeOperation(
                                () => calculateEffectiveTransactionValue(t),
                                expenseValue,
                                'effective_transaction_value'
                            );
                        }

                        const amountBRL = SafeFinancialCalculator.safeCurrencyConversion(
                            expenseValue, 
                            account?.currency || 'BRL'
                        );
                        const amount = t.isRefund ? -amountBRL : amountBRL;

                        let sourceLabel = 'Outros';
                        if (account) {
                            if (account.type === AccountType.CREDIT_CARD) sourceLabel = 'Cartão de Crédito';
                            else if (account.type === AccountType.CHECKING || account.type === AccountType.SAVINGS) sourceLabel = 'Conta Bancária';
                            else if (account.type === AccountType.CASH) sourceLabel = 'Dinheiro';
                            else sourceLabel = account.type;
                        }

                        acc[sourceLabel] = SafeFinancialCalculator.safeSum([acc[sourceLabel] || 0, amount]);
                        return acc;
                    }, {} as Record<string, number>)
                )
                    .filter(([_, val]) => SafeFinancialCalculator.toSafeNumber(val, 0) > 0)
                    .map(([name, value]) => ({ 
                        name, 
                        value: SafeFinancialCalculator.toSafeNumber(value, 0) 
                    }))
                    .sort((a, b) => b.value - a.value);
            }
        },
        'calculateSpendingChartData',
        'spending_chart_calculation',
        [monthlyTransactions, accounts, spendingView],
        []
    ).result;
};
