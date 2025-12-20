import { useMemo, useState, useEffect } from 'react';
import { Account, Transaction, TransactionType, AccountType, Category, Trip } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import {
    calculateProjectedBalance,
    analyzeFinancialHealth,
    calculateEffectiveTransactionValue,
    calculateCashFlowData,
    calculateSparklineData
} from '../services/financialLogic';
import { calculateTotalReceivables, calculateTotalPayables } from '../services/balanceEngine';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { isForeignTransaction } from '../utils/transactionUtils';
import { supabaseService } from '../services/supabaseService';

interface UseFinancialDashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    trips?: Trip[]; // NEW
    projectedAccounts?: Account[];
    currentDate: Date;
    spendingView: 'CATEGORY' | 'SOURCE';
}

export const useFinancialDashboard = ({
    accounts,
    transactions,
    trips, // NEW
    projectedAccounts,
    currentDate,
    spendingView
}: UseFinancialDashboardProps) => {

    const selectedYear = currentDate.getFullYear();


    // 0. GLOBAL FILTER: Dashboard is checking/local only.
    const dashboardTransactions = useMemo(() =>
        transactions.filter(t => {
            if (t.deleted) return false;
            if (isForeignTransaction(t, accounts)) return false;

            // STRICT TRIP CHECK: If tx belongs to a Foreign Trip, exclude it from BRL Dashboard
            // (Even if tx itself has no currency set, the Context is Foreign)
            if (t.tripId && trips) {
                const trip = trips.find(tr => tr.id === t.tripId);
                // If trip exists and is NOT BRL, exclude this transaction
                if (trip && trip.currency && trip.currency !== 'BRL') return false;
            }

            // Redundant Safety Check
            if (t.accountId) {
                const acc = accounts.find(a => a.id === t.accountId);
                if (acc && acc.currency && acc.currency !== 'BRL') return false;
            }
            return true;
        }),
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

    // 2. Filter Transactions for Charts
    const monthlyTransactions = useMemo(() =>
        dashboardTransactions
            .filter(shouldShowTransaction)
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

            // CASH FLOW LOGIC: If I paid, count FULL amount. Only check effective/split if I didn't pay.
            let expenseValue = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
            if (t.isShared && t.payerId && t.payerId !== 'me') {
                expenseValue = calculateEffectiveTransactionValue(t);
            }

            const amount = t.isRefund ? -expenseValue : expenseValue;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    // 4. Financial Health Check
    const healthStatus = analyzeFinancialHealth(monthlyIncome + pendingIncome, monthlyExpense + pendingExpenses);

    // 5. Total Net Worth (Assets - Liabilities)
    // Assets = Cash Accounts + Investments + Receivables (Credits owed to me)
    // Liabilities = Credit Card Debt + Payables (Debts I owe) - But user requested Cash Basis for debts.
    const netWorth = useMemo(() => {
        // 1. Bank Balances
        const cashBalance = dashboardAccounts.reduce((acc, curr) => {
            // STRICT CURRENCY CHECK: Omit if not BRL (or empty/null which implies Default)
            if (curr.currency && curr.currency !== 'BRL') return acc;

            const safeBalance = (curr.balance !== undefined && curr.balance !== null && !isNaN(curr.balance)) ? curr.balance : 0;

            if (curr.type === AccountType.CREDIT_CARD) {
                return acc - Math.abs(safeBalance);
            }
            return acc + safeBalance;
        }, 0);

        // 2. Receivables (Credits from Shared Transactions)
        // STRICT FIX: Use 'dashboardTransactions' (already filtered) AND double check currency if available
        const bRlReceivables = dashboardTransactions.filter(t => {
            // Extra safety: Check if this specific tx is linked to a non-BRL account or Trip
            const acc = accounts.find(a => a.id === t.accountId);
            if (acc && acc.currency && acc.currency !== 'BRL') return false;

            // Check trip context again (redundant but safe)
            if (t.tripId && trips) {
                const tr = trips.find(trip => trip.id === t.tripId);
                if (tr && tr.currency && tr.currency !== 'BRL') return false;
            }
            return true;
        });

        const receivables = calculateTotalReceivables(bRlReceivables);

        // 3. Payables (Debts I owe to others)
        // Also apply BRL filter strictness
        const bRlPayables = dashboardTransactions.filter(t => {
            // Redundant checks again to be safe
            if (t.tripId && trips) {
                const tr = trips.find(trip => trip.id === t.tripId);
                if (tr && tr.currency && tr.currency !== 'BRL') return false;
            }
            return true;
        });
        const payables = calculateTotalPayables(bRlPayables);

        // USER REQUEST 2025-12-15: "Não deveria ainda afetar o patrimonio liquido"
        // Net Worth = Current Cash Balance only (Assets - Liabilities [Credit Cards])
        // We exclude Future/Pending Shared Debts from this metric.
        return cashBalance; // + receivables - payables;
    }, [dashboardAccounts, transactions, trips, dashboardTransactions, accounts]);

    // Annual Cash Flow Data (LOCAL CALCULATION - Ensures consistency with Widgets)
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
    }, [dashboardTransactions]);

    // Spending Chart Data
    const spendingChartData = useMemo(() => {
        const chartTxs = monthlyTransactions
            .filter(t => t.type === TransactionType.EXPENSE)

        if (spendingView === 'CATEGORY') {
            return Object.entries(
                chartTxs.reduce((acc, t) => {
                    const account = accounts.find(a => a.id === t.accountId);

                    // CASH FLOW CHART LOGIC:
                    let expenseValue = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
                    if (t.isShared && t.payerId && t.payerId !== 'me') {
                        expenseValue = calculateEffectiveTransactionValue(t);
                    }

                    const amountBRL = convertToBRL(expenseValue, account?.currency || 'BRL');
                    const amount = t.isRefund ? -amountBRL : amountBRL;
                    // Use 'category' string key, assuming t.category is string
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

                    // CASH FLOW CHART LOGIC:
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
