import { useMemo } from 'react';
import { Account, Transaction, TransactionType, AccountType, Trip } from '../types';
import { isSameMonth } from '../utils';
import { convertToBRL } from '../services/currencyService';
import { calculateProjectedBalance, analyzeFinancialHealth, calculateEffectiveTransactionValue, calculateTotalReceivables, calculateTotalPayables } from '../services/financialLogic';
import { shouldShowTransaction } from '../utils/transactionFilters';
import { isCreditCard } from '../utils/accountTypeUtils';

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
    


    // 0. GLOBAL FILTER: Dashboard is checking/local only.
    // Filtrar transações nacionais (BRL)
    const dashboardTransactions = useMemo(() => {
        // Criar Set de IDs de trips estrangeiras para lookup O(1)
        const foreignTripIds = new Set(
            trips?.filter(tr => tr.currency && tr.currency !== 'BRL').map(tr => tr.id) || []
        );
        
        // Criar Set de IDs de contas estrangeiras para lookup O(1)
        const foreignAccountIds = new Set(
            accounts.filter(a => a.currency && a.currency !== 'BRL').map(a => a.id)
        );
        
        return transactions.filter(t => {
            if (t.deleted) return false;
            if (t.tripId && foreignTripIds.has(t.tripId)) return false;
            if (t.accountId && foreignAccountIds.has(t.accountId)) return false;
            return true;
        });
    }, [transactions, accounts, trips]);

    // Filtrar contas nacionais (BRL)
    const dashboardAccounts = useMemo(() => {
        return accounts.filter(a => !a.currency || a.currency === 'BRL');
    }, [accounts]);

    // PREPARE PROJECTED ACCOUNTS
    const dashboardProjectedAccounts = useMemo(() =>
        (projectedAccounts || accounts).filter(a => !a.currency || a.currency === 'BRL'),
        [projectedAccounts, accounts]);



    // 1. Calculate Projection
    // IMPORTANTE: Passar TODAS as contas (incluindo cartões) para calcular fatura
    const { currentBalance, projectedBalance, pendingIncome, pendingExpenses } = useMemo(() => {
        return calculateProjectedBalance(dashboardAccounts, dashboardTransactions, currentDate);
    }, [dashboardAccounts, dashboardTransactions, currentDate]);

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

            if (isCreditCard(curr.type)) {
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

    // Annual Cash Flow Data (OPTIMIZED - Single pass through transactions)
    const cashFlowData = useMemo(() => {
        // Pre-compute account map for O(1) lookups
        const accountMap = new Map(accounts.map(a => [a.id, a]));
        
        // Initialize 12 months with pre-computed month names
        const monthNames = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];
        const data = monthNames.map((month, i) => ({
            date: new Date(selectedYear, i, 1),
            month,
            year: selectedYear,
            monthIndex: i,
            Receitas: 0,
            Despesas: 0,
            Acumulado: 0
        }));

        // Pre-filter transactions for the year
        const startOfYearStr = `${selectedYear}-01-01`;
        const endOfYearStr = `${selectedYear}-12-31`;
        
        // Track min date for masking empty months
        let minDateStr = '9999-12-31';
        
        // Single pass: aggregate monthly data
        for (const t of dashboardTransactions) {
            if (!shouldShowTransaction(t)) continue;
            
            const dateStr = t.date.split('T')[0];
            
            // Track min date
            if (dateStr < minDateStr) minDateStr = dateStr;
            
            // Only process transactions from selected year
            if (dateStr < startOfYearStr || dateStr > endOfYearStr) continue;
            
            const account = accountMap.get(t.accountId);
            
            // Skip non-BRL accounts
            if (account && account.currency && account.currency !== 'BRL') continue;
            
            // Calculate effective amount
            let amount = t.amount;
            if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
                amount = calculateEffectiveTransactionValue(t);
            }
            const amountBRL = convertToBRL(amount, account?.currency || 'BRL');
            
            // Extract month index from date string (YYYY-MM-DD)
            const monthIndex = parseInt(dateStr.substring(5, 7)) - 1;
            
            if (t.type === TransactionType.INCOME) {
                if (t.isRefund) {
                    data[monthIndex].Despesas -= amountBRL;
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
        }

        // Calculate starting balance (Jan 1st of selected year)
        // Current balance - all transactions from Jan 1st until today
        const todayStr = new Date().toISOString().split('T')[0];
        let startingBalance = dashboardAccounts.reduce((sum, a) => {
            const val = convertToBRL(a.balance, a.currency || 'BRL');
            if (isCreditCard(a.type)) {
                return sum - Math.abs(val);
            }
            return sum + val;
        }, 0);
        
        // Reverse all transactions from start of year until today to get Jan 1st balance
        for (const t of dashboardTransactions) {
            if (!shouldShowTransaction(t)) continue;
            
            const dateStr = t.date.split('T')[0];
            
            // Only reverse transactions from Jan 1st of selected year until today
            if (dateStr < startOfYearStr || dateStr > todayStr) continue;
            
            const account = accountMap.get(t.accountId);
            if (account && account.currency && account.currency !== 'BRL') continue;
            
            let amount = t.amount;
            if (t.type === TransactionType.EXPENSE && t.isShared && t.payerId && t.payerId !== 'me') {
                amount = calculateEffectiveTransactionValue(t);
            }
            const amountBRL = convertToBRL(amount, account?.currency || 'BRL');
            
            // Reverse the effect: Income added to balance, so subtract. Expense subtracted, so add.
            if (t.type === TransactionType.INCOME) {
                startingBalance -= t.isRefund ? -amountBRL : amountBRL;
            } else if (t.type === TransactionType.EXPENSE) {
                startingBalance += t.isRefund ? -amountBRL : amountBRL;
            }
        }

        // Compute accumulated balance for each month
        let accumulated = startingBalance;
        for (const d of data) {
            const monthResult = d.Receitas - d.Despesas;
            accumulated += monthResult;
            d.Acumulado = accumulated;
        }

        // Mask months before first transaction
        const minDate = new Date(minDateStr === '9999-12-31' ? Date.now() : minDateStr);
        minDate.setDate(1);
        
        return data.map(d => {
            if (d.date < minDate && d.year <= minDate.getFullYear()) {
                return { ...d, Receitas: 0, Despesas: 0, Acumulado: null };
            }
            return d;
        });
    }, [dashboardTransactions, selectedYear, accounts, dashboardAccounts]);

    const hasCashFlowData = useMemo(() => cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0 || d.Acumulado !== 0), [cashFlowData]);

    // Sparkline Data (OPTIMIZED - Single pass for both)
    const { incomeSparkline, expenseSparkline } = useMemo(() => {
        const days = 7;
        const incomeData: number[] = Array(days).fill(0);
        const expenseData: number[] = Array(days).fill(0);
        
        // Pre-compute date strings for the last 7 days
        const dateStrings: string[] = [];
        const dateIndexMap = new Map<string, number>();
        for (let i = days - 1; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            const dateStr = d.toISOString().split('T')[0];
            dateStrings.push(dateStr);
            dateIndexMap.set(dateStr, days - 1 - i);
        }
        
        // Single pass through transactions
        for (const t of dashboardTransactions) {
            const txDateStr = t.date.split('T')[0];
            const idx = dateIndexMap.get(txDateStr);
            if (idx === undefined) continue;
            
            if (t.type === TransactionType.INCOME) {
                incomeData[idx] += t.amount;
            } else if (t.type === TransactionType.EXPENSE) {
                expenseData[idx] += t.amount;
            }
        }
        
        return { incomeSparkline: incomeData, expenseSparkline: expenseData };
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
                        if (isCreditCard(account.type)) sourceLabel = 'Cartão de Crédito';
                        else if (account.type === AccountType.CHECKING || account.type === AccountType.SAVINGS) sourceLabel = 'Conta Bancária';
                        else if (account.type === AccountType.CASH) sourceLabel = 'Dinheiro';
                        else sourceLabel = String(account.type);
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
