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
        currentBalance: isNaN(currentBalance) ? 0 : currentBalance,
        projectedBalance: isNaN(projectedBalance) ? 0 : projectedBalance,
        pendingIncome: isNaN(pendingIncome) ? 0 : pendingIncome,
        pendingExpenses: isNaN(pendingExpenses) ? 0 : pendingExpenses,
        healthStatus,
        netWorth: isNaN(netWorth) ? 0 : netWorth,
        monthlyIncome: isNaN(monthlyIncome) ? 0 : monthlyIncome,
        monthlyExpense: isNaN(monthlyExpense) ? 0 : monthlyExpense,
        cashFlowData,
        hasCashFlowData,
        incomeSparkline,
        expenseSparkline,
        upcomingBills,
        spendingChartData
    };
};
