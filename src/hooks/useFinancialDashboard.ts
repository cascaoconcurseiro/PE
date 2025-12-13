import { useMemo, useState, useEffect } from 'react';
import { Account, Transaction, TransactionType, AccountType, Category } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue } from '../services/financialLogic';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { isForeignTransaction } from '../utils/transactionUtils';
import { supabaseService } from '../services/supabaseService';

interface UseFinancialDashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    projectedAccounts?: Account[];
    currentDate: Date;
    spendingView: 'CATEGORY' | 'SOURCE';
}

export const useFinancialDashboard = ({
    accounts,
    transactions,
    projectedAccounts,
    currentDate,
    spendingView
}: UseFinancialDashboardProps) => {

    const selectedYear = currentDate.getFullYear();
    const [rpcCashflow, setRpcCashflow] = useState<{ month: number, income: number, expense: number }[]>([]);

    // 0. GLOBAL FILTER: Dashboard is checking/local only.
    const dashboardTransactions = useMemo(() =>
        transactions.filter(t => {
            if (isForeignTransaction(t, accounts)) return false;
            // Redundant Safety Check
            if (t.accountId) {
                const acc = accounts.find(a => a.id === t.accountId);
                if (acc && acc.currency && acc.currency !== 'BRL') return false;
            }
            return true;
        }),
        [transactions, accounts]);

    const dashboardAccounts = useMemo(() =>
        accounts.filter(a => !a.currency || a.currency === 'BRL'),
        [accounts]);

    // PREPARE PROJECTED ACCOUNTS
    const dashboardProjectedAccounts = useMemo(() =>
        (projectedAccounts || accounts).filter(a => !a.currency || a.currency === 'BRL'),
        [projectedAccounts, accounts]);

    // Fetch Monthly Cashflow (RPC) for Annual Chart
    useEffect(() => {
        let active = true;
        const fetchCashflow = async () => {
            try {
                const data = await supabaseService.getMonthlyCashflow(selectedYear);
                if (active) setRpcCashflow(data);
            } catch (error) {
                console.error("Failed to fetch cashflow", error);
            }
        };
        fetchCashflow();
        return () => { active = false; };
    }, [selectedYear, transactions]); // Re-fetch on transaction updates

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
            const effectiveAmount = calculateEffectiveTransactionValue(t);
            const amount = t.isRefund ? -effectiveAmount : effectiveAmount;
            return acc + convertToBRL(amount, account?.currency || 'BRL');
        }, 0), [monthlyTransactions, accounts]);

    // 4. Financial Health Check
    const healthStatus = analyzeFinancialHealth(monthlyIncome + pendingIncome, monthlyExpense + pendingExpenses);

    // 5. Total Net Worth
    const netWorth = useMemo(() => {
        return dashboardAccounts.reduce((acc, curr) => {
            if (curr.type === AccountType.CREDIT_CARD) {
                return acc - Math.abs(convertToBRL(curr.balance, curr.currency || 'BRL'));
            }
            return acc + convertToBRL(curr.balance, curr.currency || 'BRL');
        }, 0);
    }, [dashboardAccounts]);

    // Annual Cash Flow Data (FROM RPC)
    const cashFlowData = useMemo(() => {
        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(selectedYear, i, 1);
            const monthNum = i + 1;
            const rpcData = rpcCashflow.find(r => r.month === monthNum);

            return {
                date: date,
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
                year: selectedYear,
                monthIndex: i,
                Receitas: rpcData ? Number(rpcData.income) : 0,
                Despesas: rpcData ? Number(rpcData.expense) : 0
            };
        });
        return data;
    }, [rpcCashflow, selectedYear]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas < 0), [cashFlowData]);

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
            .filter(t => t.category !== Category.OPENING_BALANCE);

        if (spendingView === 'CATEGORY') {
            return Object.entries(
                chartTxs.reduce((acc, t) => {
                    const account = accounts.find(a => a.id === t.accountId);
                    const effectiveAmount = calculateEffectiveTransactionValue(t);
                    const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');
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
                    const effectiveAmount = calculateEffectiveTransactionValue(t);
                    const amountBRL = convertToBRL(effectiveAmount, account?.currency || 'BRL');
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
