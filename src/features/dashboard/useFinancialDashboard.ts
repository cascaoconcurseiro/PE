import { useMemo, useState, useEffect } from 'react';
import { Account, Transaction, TransactionType, AccountType, Category, Trip } from '../../types';
import { isSameMonth } from '../../utils';
import { convertToBRL } from '../../services/currencyService';
import {
    calculateProjectedBalance,
    analyzeFinancialHealth,
    calculateCashFlowData,
    calculateSparklineData,
    calculateEffectiveTransactionValue
} from '../../core/engines/financialLogic';
import {
    filterDashboardTransactions,
    calculateDashboardNetWorth,
    getUpcomingBills,
    calculateSpendingChartData
} from '../../core/engines/dashboardEngine';
import { SafeFinancialCalculator } from '../../utils/SafeFinancialCalculator';
import { FinancialErrorDetector } from '../../utils/FinancialErrorDetector';

interface UseFinancialDashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    trips?: Trip[];
    projectedAccounts?: Account[];
    currentDate: Date;
    spendingView: 'CATEGORY' | 'SOURCE';
}

export const useFinancialDashboard = ({
    accounts,
    transactions,
    trips,
    projectedAccounts,
    currentDate,
    spendingView
}: UseFinancialDashboardProps) => {

    const selectedYear = currentDate.getFullYear();

    // 0. GLOBAL FILTER: Dashboard is checking/local only.
    const dashboardTransactions = useMemo(() =>
        filterDashboardTransactions(transactions, accounts, trips),
        [transactions, accounts, trips]);

    const dashboardAccounts = useMemo(() =>
        accounts.filter(a => !a.currency || a.currency === 'BRL'),
        [accounts]);

    // PREPARE PROJECTED ACCOUNTS
    const dashboardProjectedAccounts = useMemo(() =>
        (projectedAccounts || accounts).filter(a => !a.currency || a.currency === 'BRL'),
        [projectedAccounts, accounts]);

    // 1. Calculate Projection
    const { currentBalance, projectedBalance, pendingIncome, pendingExpenses } = useMemo(() =>
        calculateProjectedBalance(dashboardProjectedAccounts, dashboardTransactions, currentDate),
        [dashboardProjectedAccounts, dashboardTransactions, currentDate]);

    // 2. Filter Transactions for Charts (Monthly)
    const monthlyTransactions = useMemo(() =>
        dashboardTransactions
            .filter(t => isSameMonth(t.date, currentDate)),
        [dashboardTransactions, currentDate]);

    // 3. Realized Totals
    const monthlyIncome = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.INCOME)
        .reduce((acc, t) => {
            const account = accounts.find(a => a.id === t.accountId);
            const safeAmount = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
            const amount = t.isRefund ? -safeAmount : safeAmount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    const monthlyExpense = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => {
            // Skip unpaid debts (someone else paid and I haven't settled yet)
            // These should not appear as expenses until they are actually paid/settled
            if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
                return acc; // Skip this transaction - it's an unpaid debt, not an expense
            }

            const account = accounts.find(a => a.id === t.accountId);

            // Calculate effective value (handling splits/shared)
            let expenseValue = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
            if (t.isShared && t.payerId && t.payerId !== 'me') {
                expenseValue = calculateEffectiveTransactionValue(t);
            }

            const amount = t.isRefund ? -expenseValue : expenseValue;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    // 4. Financial Health Check
    const healthStatus = analyzeFinancialHealth(monthlyIncome + pendingIncome, monthlyExpense + pendingExpenses);

    // 5. Total Net Worth
    const netWorth = useMemo(() =>
        calculateDashboardNetWorth(accounts, dashboardTransactions, trips),
        [accounts, dashboardTransactions, trips]);

    // Annual Cash Flow Data
    const cashFlowData = useMemo(() => {
        return calculateCashFlowData(dashboardTransactions, accounts, selectedYear);
    }, [dashboardTransactions, selectedYear, accounts]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0 || d.Acumulado !== 0), [cashFlowData]);

    // Sparkline Data
    const incomeSparkline = useMemo(() => {
        return calculateSparklineData(dashboardTransactions, TransactionType.INCOME);
    }, [dashboardTransactions]);

    const expenseSparkline = useMemo(() => {
        return calculateSparklineData(dashboardTransactions, TransactionType.EXPENSE);
    }, [dashboardTransactions]);

    // Upcoming Bills
    const upcomingBills = useMemo(() => {
        return getUpcomingBills(dashboardTransactions);
    }, [dashboardTransactions]);

    // Spending Chart Data
    const spendingChartData = useMemo(() => {
        return calculateSpendingChartData(monthlyTransactions, accounts, spendingView);
    }, [monthlyTransactions, accounts, spendingView]);

    return {
        dashboardTransactions,
        currentBalance: SafeFinancialCalculator.toSafeNumber(currentBalance, 0),
        projectedBalance: SafeFinancialCalculator.toSafeNumber(projectedBalance, 0),
        pendingIncome: SafeFinancialCalculator.toSafeNumber(pendingIncome, 0),
        pendingExpenses: SafeFinancialCalculator.toSafeNumber(pendingExpenses, 0),
        healthStatus,
        netWorth: SafeFinancialCalculator.toSafeNumber(netWorth, 0),
        monthlyIncome: SafeFinancialCalculator.toSafeNumber(monthlyIncome, 0),
        monthlyExpense: SafeFinancialCalculator.toSafeNumber(monthlyExpense, 0),
        cashFlowData,
        hasCashFlowData,
        incomeSparkline: incomeSparkline.map(v => SafeFinancialCalculator.toSafeNumber(v, 0)),
        expenseSparkline: expenseSparkline.map(v => SafeFinancialCalculator.toSafeNumber(v, 0)),
        upcomingBills,
        spendingChartData
    };
};
