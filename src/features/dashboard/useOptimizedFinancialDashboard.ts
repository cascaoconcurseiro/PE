import { useMemo, useState, useEffect, startTransition, useDeferredValue } from 'react';
import { Account, Transaction, TransactionType, Trip } from '../../types';
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
import { LRUCache } from '../../utils/LRUCache';

interface UseOptimizedFinancialDashboardProps {
    accounts: Account[];
    transactions: Transaction[];
    trips?: Trip[];
    projectedAccounts?: Account[];
    currentDate: Date;
    spendingView: 'CATEGORY' | 'SOURCE';
}

// LRU Cache para evitar recálculos desnecessários
const calculationCache = new LRUCache<string, any>(20);

// Função para gerar chave de cache simples (sem JSON.stringify)
const getCacheKey = (prefix: string, ...deps: (string | number)[]): string => {
  return `${prefix}:${deps.join(':')}`;
};

export const useOptimizedFinancialDashboard = ({
    accounts,
    transactions,
    trips,
    projectedAccounts,
    currentDate,
    spendingView
}: UseOptimizedFinancialDashboardProps) => {
    
    // Estados para controlar loading de diferentes seções
    const [isCalculatingProjection, setIsCalculatingProjection] = useState(false);
    const [isCalculatingCharts, setIsCalculatingCharts] = useState(false);

    const selectedYear = currentDate.getFullYear();
    const monthKey = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;

    // 1. FILTROS BÁSICOS (Mais leves, executam primeiro)
    const dashboardTransactions = useMemo(() => {
        const cacheKey = getCacheKey('dashboardTx', transactions.length, accounts.length, trips?.length || 0);
        
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

        const result = dashboardTransactions.filter((t: Transaction) => isSameMonth(t.date, currentDate));
        calculationCache.set(cacheKey, result);
        return result;
    }, [dashboardTransactions, monthKey, currentDate]);

    // 3. CÁLCULOS CRÍTICOS (Projeção - executam com prioridade)
    const projectionData = useMemo(() => {
        const cacheKey = getCacheKey('projection', dashboardProjectedAccounts.length, dashboardTransactions.length, monthKey);
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        setIsCalculatingProjection(true);
        
        try {
            const result = calculateProjectedBalance(dashboardProjectedAccounts, dashboardTransactions, currentDate);
            
            calculationCache.set(cacheKey, result);
            setIsCalculatingProjection(false);
            
            return result;
        } catch (error) {
            console.error('Error calculating projection:', error);
            setIsCalculatingProjection(false);
            
            // Return safe default values
            return {
                currentBalance: 0,
                projectedBalance: 0,
                pendingIncome: 0,
                pendingExpenses: 0
            };
        }
    }, [dashboardProjectedAccounts, dashboardTransactions, monthKey, currentDate]);

    // 4. TOTAIS MENSAIS (Críticos para o dashboard)
    const monthlyTotals = useMemo(() => {
        const cacheKey = getCacheKey('monthlyTotals', monthlyTransactions.length, accounts.length, currentDate.getTime());
        
        if (calculationCache.has(cacheKey)) {
            return calculationCache.get(cacheKey);
        }

        // Determinar data de referência para separar realizadas vs pendentes
        const now = new Date();
        const isViewingCurrentMonth = currentDate.getMonth() === now.getMonth() && 
                                    currentDate.getFullYear() === now.getFullYear();
        
        let referenceDate: Date;
        if (isViewingCurrentMonth) {
            referenceDate = now;
        } else if (currentDate > now) {
            // Mês futuro: usar data real atual
            referenceDate = now;
        } else {
            // Mês passado: usar data atual daquele mês
            referenceDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), now.getDate());
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
    }, [monthlyTransactions, accounts, currentDate]);

    // Usar useDeferredValue apenas para spendingView (não para ano, pois causa dessincronia)
    const deferredSpendingView = useDeferredValue(spendingView);

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

    // Executar cálculos pesados em background usando valores deferred
    useEffect(() => {
        const cacheKey = getCacheKey('heavy', dashboardAccounts.length, dashboardTransactions.length, selectedYear, deferredSpendingView);
        
        if (calculationCache.has(cacheKey)) {
            setHeavyCalculations(calculationCache.get(cacheKey));
            setIsCalculatingCharts(false);
            return;
        }

        setIsCalculatingCharts(true);

        // Usar startTransition para não bloquear a UI
        startTransition(() => {
            try {
                const netWorth = calculateDashboardNetWorth(dashboardAccounts, dashboardTransactions, trips);
                
                const cashFlowData = calculateCashFlowData(dashboardTransactions, dashboardAccounts, selectedYear);
                const hasCashFlowData = cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0 || d.Acumulado !== 0);
                
                const incomeSparkline = calculateSparklineData(dashboardTransactions, TransactionType.INCOME);
                const expenseSparkline = calculateSparklineData(dashboardTransactions, TransactionType.EXPENSE);
                
                const upcomingBills = getUpcomingBills(dashboardTransactions);
                
                const spendingChartData = calculateSpendingChartData(monthlyTransactions, dashboardAccounts, deferredSpendingView);

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
            } catch (error) {
                console.error('Error calculating heavy data:', error);
                setIsCalculatingCharts(false);
                // Keep previous data on error - don't update heavyCalculations
            }
        });
    }, [dashboardAccounts, dashboardTransactions, monthlyTransactions, selectedYear, deferredSpendingView, trips]);

    // 6. ANÁLISE DE SAÚDE FINANCEIRA
    const healthStatus = useMemo(() => {
        return analyzeFinancialHealth(
            monthlyTotals.monthlyIncome + projectionData.pendingIncome, 
            monthlyTotals.monthlyExpense + projectionData.pendingExpenses
        );
    }, [monthlyTotals, projectionData]);

    // Limpar cache quando necessário (evitar memory leaks)
    // LRU Cache já gerencia o tamanho automaticamente, mas mantemos limpeza periódica
    useEffect(() => {
        const cleanup = () => {
            // LRU Cache já limita o tamanho, mas podemos limpar tudo se necessário
            if (calculationCache.size > 15) {
                // Não limpar tudo, apenas deixar o LRU fazer seu trabalho
                // O cache já remove automaticamente os itens menos usados
            }
        };

        const interval = setInterval(cleanup, 60000); // Verificar a cada 60s
        return () => clearInterval(interval);
    }, []);

    // 7. PREFETCHING DE MESES ADJACENTES (em background)
    useEffect(() => {
        // Apenas fazer prefetch se não estamos calculando
        if (isCalculatingProjection || isCalculatingCharts) {
            return;
        }

        // Usar requestIdleCallback ou setTimeout para não bloquear
        const prefetchTimeout = setTimeout(() => {
            // Calcular mês anterior
            const prevMonth = new Date(currentDate);
            prevMonth.setMonth(prevMonth.getMonth() - 1);
            const prevMonthKey = `${prevMonth.getFullYear()}-${prevMonth.getMonth()}`;
            
            // Calcular próximo mês
            const nextMonth = new Date(currentDate);
            nextMonth.setMonth(nextMonth.getMonth() + 1);
            const nextMonthKey = `${nextMonth.getFullYear()}-${nextMonth.getMonth()}`;

            // Prefetch mês anterior se não estiver em cache
            const prevCacheKey = getCacheKey('monthlyTx', dashboardTransactions.length, prevMonthKey);
            if (!calculationCache.has(prevCacheKey)) {
                const prevMonthTx = dashboardTransactions.filter((t: Transaction) => isSameMonth(t.date, prevMonth));
                calculationCache.set(prevCacheKey, prevMonthTx);
            }

            // Prefetch próximo mês se não estiver em cache
            const nextCacheKey = getCacheKey('monthlyTx', dashboardTransactions.length, nextMonthKey);
            if (!calculationCache.has(nextCacheKey)) {
                const nextMonthTx = dashboardTransactions.filter((t: Transaction) => isSameMonth(t.date, nextMonth));
                calculationCache.set(nextCacheKey, nextMonthTx);
            }
        }, 500); // Aguardar 500ms após renderização

        return () => clearTimeout(prefetchTimeout);
    }, [currentDate, dashboardTransactions, isCalculatingProjection, isCalculatingCharts]);

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