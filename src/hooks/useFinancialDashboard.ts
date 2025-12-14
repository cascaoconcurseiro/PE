import { useMemo, useState, useEffect } from 'react';
import { Account, Transaction, TransactionType, AccountType, Category, Trip } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue, calculateTotalReceivables } from '../services/financialLogic';
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
            const amount = t.isRefund ? -t.amount : t.amount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    const monthlyExpense = useMemo(() => monthlyTransactions
        .filter(t => t.type === TransactionType.EXPENSE)
        .reduce((acc, t) => {
            const account = accounts.find(a => a.id === t.accountId);

            // CASH FLOW LOGIC: If I paid, count FULL amount. Only check effective/split if I didn't pay.
            let expenseValue = t.amount;
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
            if (curr.type === AccountType.CREDIT_CARD) {
                return acc - Math.abs(convertToBRL(curr.balance, curr.currency || 'BRL'));
            }
            return acc + convertToBRL(curr.balance, curr.currency || 'BRL');
        }, 0);

        // 2. Receivables (Credits from Shared Transactions)
        // STRICT FIX: Use 'dashboardTransactions' to ensure we ONLY sum BRL receivables.
        // This prevents foreign currency amounts (e.g. USD 50) from being mixed into BRL Net Worth.
        const receivables = calculateTotalReceivables(dashboardTransactions);

        return cashBalance + receivables;
    }, [dashboardAccounts, transactions]);

    // Annual Cash Flow Data (LOCAL CALCULATION - Ensures consistency with Widgets)
    const cashFlowData = useMemo(() => {
        // Initialize 12 months
        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(selectedYear, i, 1);
            return {
                date: date,
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
                year: selectedYear,
                monthIndex: i,
                Receitas: 0,
                Despesas: 0
            };
        });

        // Aggregate locally
        dashboardTransactions.forEach(t => {
            const tYear = new Date(t.date).getFullYear();
            if (tYear !== selectedYear) return;
            if (!shouldShowTransaction(t)) return;

            const monthIndex = new Date(t.date).getMonth();
            const account = accounts.find(a => a.id === t.accountId);

            // CASH FLOW LOGIC
            let amount = t.amount;
            // For Expenses, handle Split Logic (Payer = Full)
            if (t.type === TransactionType.EXPENSE) {
                if (t.isShared && t.payerId && t.payerId !== 'me') {
                    // I didn't pay, so only count my effective share
                    amount = calculateEffectiveTransactionValue(t);
                }
                // If I paid, amount remains t.amount (FULL)
            }

            const amountBRL = convertToBRL(amount, account?.currency || 'BRL');

            if (t.type === TransactionType.INCOME) {
                // Refunds subtract from Income? No, usually Refunds are positive Income or negative Expense.
                // In this app, Refund is usually flagged on Expense to reverse it, or Income.
                // Let's stick to standard Type check. 
                // If it is a Refund Transaction (type=INCOME?), add to Income.
                // If it is Expense Refund, it reduces Expense.
                if (t.isRefund) {
                    data[monthIndex].Despesas -= amountBRL; // Refund reduces expense
                } else {
                    data[monthIndex].Receitas += amountBRL;
                }
            } else if (t.type === TransactionType.EXPENSE) {
                if (t.isRefund) {
                    data[monthIndex].Receitas -= amountBRL; // Negative Expense? Treat as Income deduction or just negative expense.
                    // Actually isRefund on Expense usually means money back.
                    // Let's assume standard behavior: Expense = Outflow.
                    data[monthIndex].Despesas -= amountBRL;
                } else {
                    data[monthIndex].Despesas += amountBRL;
                }
            }
        });

        return data;
    }, [dashboardTransactions, selectedYear, accounts]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0), [cashFlowData]);

    // Sparkline Data
    const incomeSparkline = useMemo(() => {
        const days = 7;
        const data: number[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayTotal = dashboardTransactions
                .filter(t => t.date.startsWith(dateStr) && t.type === TransactionType.INCOME)
                .reduce((sum, t) => sum + t.amount, 0);
            data.push(dayTotal);
        }
        return data;
    }, [dashboardTransactions]);

    const expenseSparkline = useMemo(() => {
        const days = 7;
        const data: number[] = [];
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            const dayTotal = dashboardTransactions
                .filter(t => t.date.startsWith(dateStr) && t.type === TransactionType.EXPENSE)
                .reduce((sum, t) => sum + t.amount, 0);
            data.push(dayTotal);
        }
        return data;
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
                    let expenseValue = t.amount;
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
                    let expenseValue = t.amount;
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
        currentBalance,
        projectedBalance,
        pendingIncome,
        pendingExpenses,
        healthStatus,
        netWorth,
        monthlyIncome,
        monthlyExpense,
        cashFlowData,
        hasCashFlowData,
        incomeSparkline,
        expenseSparkline,
        upcomingBills,
        spendingChartData
    };
};
