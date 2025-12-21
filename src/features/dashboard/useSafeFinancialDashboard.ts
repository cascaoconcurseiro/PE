import { useMemo } from 'react';
import { Account, Transaction, TransactionType, AccountType, Trip } from '../../types';
import { isSameMonth } from '../../utils';
import { 
  calculateSafeProjectedBalance, 
  calculateSafeMonthlyTotals,
  analyzeSafeFinancialHealth,
  calculateSafeSum,
  calculateSafeAverage
} from '../../utils/SafeFinancialCalculations';
import { SafeFinancialCalculator } from '../../utils/SafeFinancialCalculator';
import { FinancialErrorDetector } from '../../utils/FinancialErrorDetector';
import { validateFinancialData } from '../../utils/FinancialDataValidation';
import {
  filterDashboardTransactions,
  calculateDashboardNetWorth,
  getUpcomingBills,
  calculateSpendingChartData
} from '../../core/engines/dashboardEngine';
import { 
  calculateCashFlowData,
  calculateSparklineData
} from '../../core/engines/financialLogic';

interface UseSafeFinancialDashboardProps {
  accounts: Account[];
  transactions: Transaction[];
  trips?: Trip[];
  projectedAccounts?: Account[];
  currentDate: Date;
  spendingView: 'CATEGORY' | 'SOURCE';
}

interface SafeFinancialDashboardResult {
  // Dados principais
  dashboardTransactions: Transaction[];
  currentBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  healthStatus: 'POSITIVE' | 'WARNING' | 'CRITICAL';
  netWorth: number;
  monthlyIncome: number;
  monthlyExpense: number;
  
  // Dados de gráficos
  cashFlowData: any[];
  hasCashFlowData: boolean;
  incomeSparkline: number[];
  expenseSparkline: number[];
  upcomingBills: any[];
  spendingChartData: any[];
  
  // Informações de validação
  validationSummary: {
    totalAccounts: number;
    validAccounts: number;
    totalTransactions: number;
    validTransactions: number;
    errorsDetected: number;
    dataQualityScore: number;
  };
  
  // Relatório de saúde financeira
  healthReport: any;
}

/**
 * Hook seguro para dashboard financeiro com validação abrangente e proteção contra NaN
 * 
 * Este hook substitui o useFinancialDashboard original com:
 * - Validação defensiva de todos os dados de entrada
 * - Cálculos seguros que nunca retornam NaN
 * - Detecção e logging automático de erros
 * - Relatórios de qualidade de dados
 * - Fallbacks seguros para todos os cenários
 */
export const useSafeFinancialDashboard = ({
  accounts,
  transactions,
  trips,
  projectedAccounts,
  currentDate,
  spendingView
}: UseSafeFinancialDashboardProps): SafeFinancialDashboardResult => {

  // Validação e sanitização de dados de entrada
  const { sanitizedAccounts, sanitizedTransactions, validationSummary } = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => {
        // Validar dados de entrada
        const validation = validateFinancialData({
          accounts: accounts || [],
          transactions: transactions || []
        });

        // Sanitizar dados
        const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
        const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(transactions || []);

        // Log de problemas encontrados
        if (!validation.overallValid) {
          FinancialErrorDetector.logError(
            'INVALID_INPUT',
            'useSafeFinancialDashboard',
            'input_validation',
            [accounts, transactions],
            `Dados inválidos detectados: ${validation.summary.totalErrors} erros`,
            'MEDIUM',
            { validationSummary: validation.summary }
          );
        }

        return {
          sanitizedAccounts: safeAccounts,
          sanitizedTransactions: safeTransactions,
          validationSummary: {
            totalAccounts: validation.summary.totalAccounts,
            validAccounts: validation.summary.validAccounts,
            totalTransactions: validation.summary.totalTransactions,
            validTransactions: validation.summary.validTransactions,
            errorsDetected: validation.summary.totalErrors,
            dataQualityScore: validation.overallValid ? 100 : Math.max(0, 100 - (validation.summary.totalErrors * 10))
          }
        };
      },
      'useSafeFinancialDashboard',
      'input_sanitization',
      [accounts, transactions],
      {
        sanitizedAccounts: [],
        sanitizedTransactions: [],
        validationSummary: {
          totalAccounts: 0,
          validAccounts: 0,
          totalTransactions: 0,
          validTransactions: 0,
          errorsDetected: 1,
          dataQualityScore: 0
        }
      }
    ).result;
  }, [accounts, transactions]);

  // Filtrar transações para o dashboard (apenas BRL)
  const dashboardTransactions = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => filterDashboardTransactions(sanitizedTransactions, sanitizedAccounts, trips),
      'useSafeFinancialDashboard',
      'filter_dashboard_transactions',
      [sanitizedTransactions, sanitizedAccounts, trips],
      []
    ).result;
  }, [sanitizedTransactions, sanitizedAccounts, trips]);

  // Filtrar contas para o dashboard (apenas BRL)
  const dashboardAccounts = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => sanitizedAccounts.filter(a => !a.currency || a.currency === 'BRL'),
      'useSafeFinancialDashboard',
      'filter_dashboard_accounts',
      [sanitizedAccounts],
      []
    ).result;
  }, [sanitizedAccounts]);

  // Preparar contas projetadas
  const dashboardProjectedAccounts = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => {
        const accountsToUse = projectedAccounts || sanitizedAccounts;
        return accountsToUse.filter(a => !a.currency || a.currency === 'BRL');
      },
      'useSafeFinancialDashboard',
      'prepare_projected_accounts',
      [projectedAccounts, sanitizedAccounts],
      []
    ).result;
  }, [projectedAccounts, sanitizedAccounts]);

  // Calcular projeção de saldo
  const projectionData = useMemo(() => {
    const safeCurrentDate = currentDate instanceof Date ? currentDate : new Date();
    return calculateSafeProjectedBalance(
      dashboardProjectedAccounts,
      dashboardTransactions,
      safeCurrentDate
    );
  }, [dashboardProjectedAccounts, dashboardTransactions, currentDate]);

  // Calcular totais mensais
  const monthlyData = useMemo(() => {
    const safeCurrentDate = currentDate instanceof Date ? currentDate : new Date();
    
    // Filtrar transações do mês atual com validação de data
    const monthlyTransactions = dashboardTransactions.filter(t => {
      try {
        if (!t.date) return false;
        const tDate = new Date(t.date);
        if (isNaN(tDate.getTime())) return false;
        return isSameMonth(tDate, safeCurrentDate);
      } catch (error) {
        FinancialErrorDetector.logError(
          'INVALID_INPUT',
          'useSafeFinancialDashboard',
          'date_validation',
          [t],
          `Invalid date in transaction: ${t.date}`,
          'LOW'
        );
        return false;
      }
    });
    
    return calculateSafeMonthlyTotals(
      monthlyTransactions,
      dashboardAccounts,
      safeCurrentDate
    );
  }, [dashboardTransactions, dashboardAccounts, currentDate]);

  // Análise de saúde financeira
  const healthStatus = useMemo(() => {
    const totalIncome = SafeFinancialCalculator.safeSum([monthlyData.income, projectionData.pendingIncome]);
    const totalExpenses = SafeFinancialCalculator.safeSum([monthlyData.expenses, projectionData.pendingExpenses]);
    
    return analyzeSafeFinancialHealth(totalIncome, totalExpenses);
  }, [monthlyData, projectionData]);

  // Patrimônio líquido total
  const netWorth = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => calculateDashboardNetWorth(sanitizedAccounts, dashboardTransactions, trips),
      'useSafeFinancialDashboard',
      'calculate_net_worth',
      [sanitizedAccounts, dashboardTransactions, trips],
      0
    ).result;
  }, [sanitizedAccounts, dashboardTransactions, trips]);

  // Dados de fluxo de caixa anual
  const cashFlowData = useMemo(() => {
    const selectedYear = currentDate instanceof Date ? currentDate.getFullYear() : new Date().getFullYear();
    
    return FinancialErrorDetector.safeCalculate(
      () => calculateCashFlowData(dashboardTransactions, sanitizedAccounts, selectedYear),
      'useSafeFinancialDashboard',
      'calculate_cash_flow_data',
      [dashboardTransactions, sanitizedAccounts, selectedYear],
      []
    ).result;
  }, [dashboardTransactions, sanitizedAccounts, currentDate]);

  // Verificar se há dados de fluxo de caixa
  const hasCashFlowData = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => cashFlowData.some(d => d.Receitas > 0 || d.Despesas > 0 || d.Acumulado !== 0),
      'useSafeFinancialDashboard',
      'check_cash_flow_data',
      [cashFlowData],
      false
    ).result;
  }, [cashFlowData]);

  // Dados de sparkline
  const incomeSparkline = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => {
        const sparklineData = calculateSparklineData(dashboardTransactions, TransactionType.INCOME);
        return sparklineData.map(value => SafeFinancialCalculator.toSafeNumber(value, 0));
      },
      'useSafeFinancialDashboard',
      'calculate_income_sparkline',
      [dashboardTransactions],
      []
    ).result;
  }, [dashboardTransactions]);

  const expenseSparkline = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => {
        const sparklineData = calculateSparklineData(dashboardTransactions, TransactionType.EXPENSE);
        return sparklineData.map(value => SafeFinancialCalculator.toSafeNumber(value, 0));
      },
      'useSafeFinancialDashboard',
      'calculate_expense_sparkline',
      [dashboardTransactions],
      []
    ).result;
  }, [dashboardTransactions]);

  // Contas próximas do vencimento
  const upcomingBills = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => getUpcomingBills(dashboardTransactions),
      'useSafeFinancialDashboard',
      'get_upcoming_bills',
      [dashboardTransactions],
      []
    ).result;
  }, [dashboardTransactions]);

  // Dados do gráfico de gastos
  const spendingChartData = useMemo(() => {
    return FinancialErrorDetector.safeCalculate(
      () => {
        const safeCurrentDate = currentDate instanceof Date ? currentDate : new Date();
        
        const monthlyTransactions = dashboardTransactions.filter(t => {
          try {
            if (!t.date) return false;
            const tDate = new Date(t.date);
            if (isNaN(tDate.getTime())) return false;
            return isSameMonth(tDate, safeCurrentDate);
          } catch (error) {
            return false;
          }
        });
        
        return calculateSpendingChartData(monthlyTransactions, sanitizedAccounts, spendingView);
      },
      'useSafeFinancialDashboard',
      'calculate_spending_chart_data',
      [dashboardTransactions, sanitizedAccounts, spendingView],
      []
    ).result;
  }, [dashboardTransactions, sanitizedAccounts, spendingView, currentDate]);

  // Relatório de saúde financeira
  const healthReport = useMemo(() => {
    return FinancialErrorDetector.getHealthReport(24); // Últimas 24 horas
  }, [projectionData, monthlyData]); // Recalcular quando dados principais mudarem

  // Garantir que todos os valores numéricos sejam seguros
  const safeResult: SafeFinancialDashboardResult = useMemo(() => {
    return {
      dashboardTransactions,
      currentBalance: SafeFinancialCalculator.toSafeNumber(projectionData.currentBalance, 0),
      projectedBalance: SafeFinancialCalculator.toSafeNumber(projectionData.projectedBalance, 0),
      pendingIncome: SafeFinancialCalculator.toSafeNumber(projectionData.pendingIncome, 0),
      pendingExpenses: SafeFinancialCalculator.toSafeNumber(projectionData.pendingExpenses, 0),
      healthStatus,
      netWorth: SafeFinancialCalculator.toSafeNumber(netWorth, 0),
      monthlyIncome: SafeFinancialCalculator.toSafeNumber(monthlyData.income, 0),
      monthlyExpense: SafeFinancialCalculator.toSafeNumber(monthlyData.expenses, 0),
      cashFlowData,
      hasCashFlowData,
      incomeSparkline,
      expenseSparkline,
      upcomingBills,
      spendingChartData,
      validationSummary,
      healthReport
    };
  }, [
    dashboardTransactions,
    projectionData,
    healthStatus,
    netWorth,
    monthlyData,
    cashFlowData,
    hasCashFlowData,
    incomeSparkline,
    expenseSparkline,
    upcomingBills,
    spendingChartData,
    validationSummary,
    healthReport
  ]);

  // Log de resumo de execução
  useMemo(() => {
    if (validationSummary.errorsDetected > 0) {
      FinancialErrorDetector.logError(
        'DATA_CORRUPTION',
        'useSafeFinancialDashboard',
        'execution_summary',
        [],
        `Dashboard executado com ${validationSummary.errorsDetected} erros detectados. Qualidade dos dados: ${validationSummary.dataQualityScore}%`,
        validationSummary.dataQualityScore < 50 ? 'HIGH' : 'MEDIUM',
        {
          validationSummary,
          healthReport: {
            errorRate: healthReport.summary.errorRate,
            dataQualityScore: healthReport.dataQualityScore
          }
        }
      );
    }
  }, [validationSummary, healthReport]);

  return safeResult;
};

/**
 * Hook de compatibilidade que mantém a interface original mas usa implementação segura
 * 
 * Este hook pode ser usado como drop-in replacement para o useFinancialDashboard original
 */
export const useFinancialDashboardSafe = (props: UseSafeFinancialDashboardProps) => {
  const result = useSafeFinancialDashboard(props);
  
  // Retornar apenas os campos que existiam no hook original para compatibilidade
  return {
    dashboardTransactions: result.dashboardTransactions,
    currentBalance: result.currentBalance,
    projectedBalance: result.projectedBalance,
    pendingIncome: result.pendingIncome,
    pendingExpenses: result.pendingExpenses,
    healthStatus: result.healthStatus,
    netWorth: result.netWorth,
    monthlyIncome: result.monthlyIncome,
    monthlyExpense: result.monthlyExpense,
    cashFlowData: result.cashFlowData,
    hasCashFlowData: result.hasCashFlowData,
    incomeSparkline: result.incomeSparkline,
    expenseSparkline: result.expenseSparkline,
    upcomingBills: result.upcomingBills,
    spendingChartData: result.spendingChartData
  };
};