import { useMemo, useRef } from 'react';
import { Account, Transaction, TransactionType, AccountType, Category, Trip } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue, calculateTotalReceivables, calculateTotalPayables } from '../services/financialLogic';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { isForeignTransaction } from '../utils/transactionUtils';

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
    trips,
    projectedAccounts,
    currentDate,
    spendingView
}: UseFinancialDashboardProps) => {

    const selectedYear = currentDate.getFullYear();
    const selectedMonth = currentDate.getMonth();
    
    // Cache para evitar recálculos desnecessários
    const cacheRef = useRef<{
        txHash: string;
        accHash: string;
        dashboardTxs?: Transaction[];
        dashboardAccs?: Account[];
    }>({ txHash: '', accHash: '' });

    // Gerar hash simples para detectar mudanças reais
    const txHash = `${transactions.length}-${transactions[0]?.id || ''}-${transactions[transactions.length - 1]?.id || ''}`;
    const accHash = `${accounts.length}-${accounts.reduce((s, a) => s + a.balance, 0).toFixed(2)}`;

    // 0. GLOBAL FILTER: Dashboard is checking/local only.
    // OTIMIZADO: Usar cache para evitar filtros repetidos
    const dashboardTransactions = useMemo(() => {
        if (cacheRef.current.txHash === txHash && cacheRef.current.dashboardTxs) {
            return cacheRef.current.dashboardTxs;
        }
        
        // Criar Set de IDs de trips estrangeiras para lookup O(1)
        const foreignTripIds = new Set(
            trips?.filter(tr => tr.currency && tr.currency !== 'BRL').map(tr => tr.id) || []
        );
        
        // Criar Set de IDs de contas estrangeiras para lookup O(1)
        const foreignAccountIds = new Set(
            accounts.filter(a => a.currency && a.currency !== 'BRL').map(a => a.id)
        );
        
        const filtered = transactions.filter(t => {
            if (t.deleted) return false;
            if (t.tripId && foreignTripIds.has(t.tripId)) return false;
            if (t.accountId && foreignAccountIds.has(t.accountId)) return false;
            return true;
        });
        
        cacheRef.current.txHash = txHash;
        cacheRef.current.dashboardTxs = filtered;
        return filtered;
    }, [transactions, accounts, trips, txHash]);

    const dashboardAccounts = useMemo(() => {
        if (cacheRef.current.accHash === accHash && cacheRef.current.dashboardAccs) {
            return cacheRef.current.dashboardAccs;
        }
        const filtered = accounts.filter(a => !a.currency || a.currency === 'BRL');
        cacheRef.current.accHash = accHash;
        cacheRef.current.dashboardAccs = filtered;
        return filtered;
    }, [accounts, accHash]);

    // PREPARE PROJECTED ACCOUNTS
    const dashboardProjectedAccounts = useMemo(() =>
        (projectedAccounts || accounts).filter(a => !a.currency || a.currency === 'BRL'),
        [projectedAccounts, accounts]);



    // 1. Calculate Projection
    const { currentBalance, projectedBalance, pendingIncome, pendingExpenses } = useMemo(() =>
        calculateProjectedBalance(dashboardProjectedAccounts, dashboardTransactions, currentDate),
        [dashboardProjectedAccounts, dashboardTransactions, currentDate]);

    // 2. Filter Transactions for Charts - OTIMIZADO
    const monthlyTransactions = useMemo(() => {
        // Pré-calcular range do mês para comparação rápida
        const monthStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`;
        const monthEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-31`;
        
        return dashboardTransactions.filter(t => {
            if (!shouldShowTransaction(t)) return false;
            // Comparação de string é mais rápida que criar Date objects
            return t.date >= monthStart && t.date <= monthEnd;
        });
    }, [dashboardTransactions, selectedYear, selectedMonth]);

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
            // STRICT CURRENCY CHECK: Omit if not BRL (or empty/null which implies Default)
            if (curr.currency && curr.currency !== 'BRL') return acc;

            if (curr.type === AccountType.CREDIT_CARD) {
                return acc - Math.abs(curr.balance);
            }
            return acc + curr.balance;
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
        // 1. Get Current Liquid Balance (The Anchor)
        // 1. Get Current Net Worth Balance (The Anchor) - Sum of ALL Accounts
        // This ensures that "Acumulado" matches the "Net Worth" concept, which is consistent with
        // the Chart showing Income/Expense from ALL sources (Investments, etc).
        let accumulated = dashboardAccounts.reduce((sum, a) => {
            const val = convertToBRL(a.balance, a.currency || 'BRL');
            if (a.type === AccountType.CREDIT_CARD) {
                return sum - Math.abs(val); // Debt reduces accumulated
            }
            return sum + val;
        }, 0);

        // 2. Adjust Balance to reach Jan 1st of Selected Year
        // We travel in time from 'currentDate' (Today) to 'Jan 1st selectedYear'
        const startOfYear = new Date(selectedYear, 0, 1);
        startOfYear.setHours(0, 0, 0, 0);

        const now = new Date();
        now.setHours(0, 0, 0, 0);

        dashboardTransactions.forEach(t => {
            if (!shouldShowTransaction(t)) return;
            const tDate = new Date(t.date);
            tDate.setHours(0, 0, 0, 0);

            let amount = t.amount;
            if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
                amount = calculateEffectiveTransactionValue(t);
            }

            // STRICT FILTER REMOVED: Now we include ALL transactions in the time-travel
            // to insure the "Acumulado" consistently represents the Net Worth evolution.
            const account = accounts.find(a => a.id === t.accountId);
            // Safety check for currency
            if (account && account.currency && account.currency !== 'BRL') return;

            const amountBRL = convertToBRL(amount, account?.currency || 'BRL');

            // CASE A: Future View (e.g. Viewing 2026, Today is 2025)
            // We need to ADD everything happenning between Now and Start of 2026
            if (startOfYear > now) {
                if (tDate >= now && tDate < startOfYear) {
                    if (t.type === TransactionType.INCOME) accumulated += amountBRL;
                    if (t.type === TransactionType.EXPENSE) accumulated -= amountBRL;
                }
            }
            // CASE B: Past/Current View (e.g. Viewing 2025, Today is Dec 2025)
            // We need to SUBTRACT everything that happened between Start of 2025 and Now (Reverse Engineering)
            else {
                if (tDate >= startOfYear && tDate <= now) {
                    // Reverse logic to go back in time
                    if (t.type === TransactionType.INCOME) accumulated -= amountBRL;
                    if (t.type === TransactionType.EXPENSE) accumulated += amountBRL;
                }
            }
        });

        // Now 'accumulated' represents the projected/historical balance at Jan 1st 00:00 of selectedYear.

        // Initialize 12 months
        const data = Array.from({ length: 12 }, (_, i) => {
            const date = new Date(selectedYear, i, 1);
            return {
                date: date,
                month: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '').toUpperCase(),
                year: selectedYear,
                monthIndex: i,
                Receitas: 0,
                Despesas: 0,
                Acumulado: 0
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
                if (t.isRefund) {
                    data[monthIndex].Despesas -= amountBRL; // Refund reduces expense
                } else {
                    data[monthIndex].Receitas += amountBRL;
                }
            } else if (t.type === TransactionType.EXPENSE) {
                if (t.isRefund) {
                    data[monthIndex].Despesas -= amountBRL;
                } else {
                    data[monthIndex].Despesas += amountBRL;
                }
            }
        });

        // Compute accumulated
        data.forEach(d => {
            const result = d.Receitas - d.Despesas;
            accumulated += result;
            d.Acumulado = accumulated;
        });

        // FIX: Mask months before the first transaction text to prevent confusing historical data
        const minDate = dashboardTransactions.length > 0
            ? new Date(Math.min(...dashboardTransactions.map(t => new Date(t.date).getTime())))
            : new Date();

        minDate.setDate(1); // Start of start month
        minDate.setHours(0, 0, 0, 0);

        return data.map(d => {
            if (d.date < minDate && d.year <= minDate.getFullYear()) {
                // If this month is historically before our first transaction, it shouldn't show data
                return { ...d, Receitas: 0, Despesas: 0, Acumulado: null }; // null forces Recharts to break line or show empty
            }
            return d;
        });
    }, [dashboardTransactions, selectedYear, accounts, dashboardAccounts]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0 || d.Acumulado !== 0), [cashFlowData]);

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
