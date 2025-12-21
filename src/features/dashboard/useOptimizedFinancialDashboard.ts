import { useMemo, useState, useEffect, useCallback, startTransition } from 'react';
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

interface UseOptimizedFinancialDashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    trips?: Trip[];
    projectedAccounts?: Account[];
    currentDate: Date;
    spendingView: 'CATEGORY' | 'SOURCE';
}

// Cache para evitar recálculos desnecessários
const calculationCache = new Map<string, any>();

// Função para gerar chave de cache
const getCacheKey = (prefix: string, ...deps: any[]): string => {
  return `${prefix}_${JSON.stringify(deps)}`;
};

// Hook personalizado para debounce
const useDebounce = <T>(value: T, delay: number): T => {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(handler);
    };
  }, [value, delay]);

  return debouncedValue;
};

export const useOptimizedFinancialDashboard = ({
    accounts,
    transactions,
    trips,
    projectedAccounts,
    currentDate,
    spendingView
}: UseOptimizedFinancialDashboardProps) => {

    // Debounce da data para evitar cálculos excessivos durante navegação rápida
    const debouncedCurrentDate = useDebounce(currentDate, 100);
    
    // Estados para controlar loading de diferentes seções
    const [isCalculatingProjection, setIsCalculatingProjection] = useState(false);
    const [isCalculatingCharts, setIsCalculatingCharts] = useState(false);

    const selectedYear = debouncedCurrentDate.getFullYear();
    const monthKey = `${debouncedCurrentDate.getFullYear()}-${debouncedCurrentDate.getMonth()}`;

    // 1. FILTROS BÁSICOS (Mais leves, executam primeiro)
    const dashboardTransactions = useMemo(() => {
        const cacheKey = getCacheKey('dashboardTx', transactions.length, accounts.length, trips?.length);
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        const result = filterDashboardTransactions(transactions, accounts, trips);
        calculationCache.set(cacheKey, result);
        return result;
    }, [transactions, accounts, trips]);

    const dashboardAccounts = useMemo(() => {
        const cacheKey = getCacheKey('dashboardAcc', accounts.length);
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        const result = accounts.filter(a => !a.currency || a.currency === 'BRL');
        calculationCache.set(cacheKey, result);
        return result;
    }, [accounts]);

    const dashboardProjectedAccounts = useMemo(() => {
        const cacheKey = getCacheKey('projectedAcc', projectedAccounts?.length || accounts.length);
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        const result = (projectedAccounts || accounts).filter(a => !a.currency || a.currency === 'BRL');
        calculationCache.set(cacheKey, result);
        return result;
    }, [projectedAccounts, accounts]);

    // 2. TRANSAÇÕES MENSAIS (Dependem da data, mas são mais leves)
    const monthlyTransactions = useMemo(() => {
        const cacheKey = getCacheKey('monthlyTx', dashboardTransactions.length, monthKey);
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        const result = dashboardTransactions.filter((t: Transaction) => isSameMonth(t.date, debouncedCurrentDate));
        calculationCache.set(cacheKey, result);
        return result;
    }, [dashboardTransactions, monthKey]);

    // 3. CÁLCULOS CRÍTICOS (Projeção - executam com prioridade)
    const projectionData = useMemo(() => {
        const cacheKey = getCacheKey('projection', dashboardProjectedAccounts.length, dashboardTransactions.length, monthKey);
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        setIsCalculatingProjection(true);
        
        const result = calculateProjectedBalance(dashboardProjectedAccounts, dashboardTransactions, debouncedCurrentDate);
        
        calculationCache.set(cacheKey, result);
        setIsCalculatingProjection(false);
        
        return result;
    }, [dashboardProjectedAccounts, dashboardTransactions, monthKey]);

    // 4. TOTAIS MENSAIS (Críticos para o dashboard)
    const monthlyTotals = useMemo(() => {
        const cacheKey = getCacheKey('monthlyTotals', monthlyTransactions.length, accounts.length, debouncedCurrentDate.getTime());
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        // Determinar data de referência para separar realizadas vs pendentes
        const now = new Date();
        const isViewingCurrentMonth = debouncedCurrentDate.getMonth() === now.getMonth() && 
                                    debouncedCurrentDate.getFullYear() === now.getFullYear();
        
        let referenceDate: Date;
        if (isViewingCurrentMonth) {
            referenceDate = now;
        } else if (debouncedCurrentDate > now) {
            // Mês futuro: usar data real atual
            referenceDate = now;
        } else {
            // Mês passado: usar data atual daquele mês
            referenceDate = new Date(debouncedCurrentDate.getFullYear(), debouncedCurrentDate.getMonth(), now.getDate());
        }
        referenceDate.setHours(0, 0, 0, 0);

        // Separar transações realizadas (até referenceDate) das pendentes (após referenceDate)
        const realizedTransactions = monthlyTransactions.filter((t: Transaction) => {
            const tDate = new Date(t.date);
            tDate.setHours(0, 0, 0, 0);
            return tDate <= referenceDate;
        });

        const monthlyIncome = realizedTransactions
            .filter((t: Transaction) => t.type === TransactionType.INCOME)
            .reduce((acc: number, t: Transaction) => {
                const account = accounts.find(a => a.id === t.accountId);
                const safeAmount = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
                const amount = t.isRefund ? -safeAmount : safeAmount;
                return acc + convertToBRL(amount, account?.currency || 'BRL');
            }, 0);

        const monthlyExpense = realizedTransactions
            .filter((t: Transaction) => t.type === TransactionType.EXPENSE)
            .reduce((acc: number, t: Transaction) => {
                // Skip unpaid debts
                if (t.payerId && t.payerId !== 'me' && !t.isSettled) {
                    return acc;
                }

                const account = accounts.find(a => a.id === t.accountId);
                let expenseValue = (t.amount !== undefined && t.amount !== null && !isNaN(t.amount)) ? t.amount : 0;
                
                if (t.isShared && t.payerId && t.payerId !== 'me') {
                    expenseValue = calculateEffectiveTransactionValue(t);
                }

                const amount = t.isRefund ? -expenseValue : expenseValue;
                return acc + convertToBRL(amount, account?.currency || 'BRL');
            }, 0);

        const result = { monthlyIncome, monthlyExpense };
        calculationCache.set(cacheKey, result);
        return result;
    }, [monthlyTransactions, accounts, debouncedCurrentDate]);

    // 5. CÁLCULOS PESADOS (Executam em background com startTransition)
    const [heavyCalculations, setHeavyCalculations] = useState<{
        netWorth: number;
        cashFlowData: Array<{ date: Date, month: string, year: number, monthIndex: number, Receitas: number, Despesas: number, Acumulado: number | null }>;
        hasCashFlowData: boolean;
        incomeSparkline: number[];
        expenseSparkline: number[];
        upcomingBills: Transaction[];
        spendingChartData: Array<{ name: string; value: number }>;
    }>({
        netWorth: 0,
        cashFlowData: [],
        hasCashFlowData: false,
        incomeSparkline: [],
        expenseSparkline: [],
        upcomingBills: [],
        spendingChartData: []
    });

    // Executar cálculos pesados em background
    useEffect(() => {
        const cacheKey = getCacheKey('heavy', dashboardAccounts.length, dashboardTransactions.length, selectedYear, spendingView);
        
        if (calculationCache.has(cacheKey)) {
            setHeavyCalculations(calculationCache.get(cacheKey));
            return;
        }

        setIsCalculatingCharts(true);

        // Usar startTransition para não bloquear a UI
        startTransition(() => {
            const netWorth = calculateDashboardNetWorth(dashboardAccounts, dashboardTransactions, trips);
            
            const cashFlowData = calculateCashFlowData(dashboardTransactions, dashboardAccounts, selectedYear);
            const hasCashFlowData = cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0 || d.Acumulado !== 0);
            
            const incomeSparkline = calculateSparklineData(dashboardTransactions, TransactionType.INCOME);
            const expenseSparkline = calculateSparklineData(dashboardTransactions, TransactionType.EXPENSE);
            
            const upcomingBills = getUpcomingBills(dashboardTransactions);
            
            const spendingChartData = calculateSpendingChartData(monthlyTransactions, dashboardAccounts, spendingView);

            const result = {
                netWorth: SafeFinancialCalculator.toSafeNumber(netWorth, 0),
                cashFlowData,
                hasCashFlowData,
                incomeSparkline: incomeSparkline.map(v => SafeFinancialCalculator.toSafeNumber(v, 0)),
                expenseSparkline: expenseSparkline.map(v => SafeFinancialCalculator.toSafeNumber(v, 0)),
                upcomingBills,
                spendingChartData
            };

            calculationCache.set(cacheKey, result);
            setHeavyCalculations(result);
            setIsCalculatingCharts(false);
        });
    }, [dashboardAccounts, dashboardTransactions, monthlyTransactions, selectedYear, spendingView, trips]);

    // 6. ANÁLISE DE SAÚDE FINANCEIRA
    const healthStatus = useMemo(() => {
        return analyzeFinancialHealth(
            monthlyTotals.monthlyIncome + projectionData.pendingIncome, 
            monthlyTotals.monthlyExpense + projectionData.pendingExpenses
        );
    }, [monthlyTotals, projectionData]);

    // Limpar cache quando necessário (evitar memory leaks)
    useEffect(() => {
        const cleanup = () => {
            if (calculationCache.size > 50) { // Limite de cache
                calculationCache.clear();
            }
        };

        const interval = setInterval(cleanup, 30000); // Limpar a cada 30s
        return () => clearInterval(interval);
    }, []);

    return {
        dashboardTransactions,
        currentBalance: SafeFinancialCalculator.toSafeNumber(projectionData.currentBalance, 0),
        projectedBalance: SafeFinancialCalculator.toSafeNumber(projectionData.projectedBalance, 0),
        pendingIncome: SafeFinancialCalculator.toSafeNumber(projectionData.pendingIncome, 0),
        pendingExpenses: SafeFinancialCalculator.toSafeNumber(projectionData.pendingExpenses, 0),
        healthStatus,
        netWorth: heavyCalculations.netWorth,
        monthlyIncome: SafeFinancialCalculator.toSafeNumber(monthlyTotals.monthlyIncome, 0),
        monthlyExpense: SafeFinancialCalculator.toSafeNumber(monthlyTotals.monthlyExpense, 0),
        cashFlowData: heavyCalculations.cashFlowData,
        hasCashFlowData: heavyCalculations.hasCashFlowData,
        incomeSparkline: heavyCalculations.incomeSparkline,
        expenseSparkline: heavyCalculations.expenseSparkline,
        upcomingBills: heavyCalculations.upcomingBills,
        spendingChartData: heavyCalculations.spendingChartData,
        
        // Estados de loading para feedback visual
        isCalculatingProjection,
        isCalculatingCharts
    };
};