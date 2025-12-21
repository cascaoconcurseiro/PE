import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useSafeFinancialDashboard } from '../useSafeFinancialDashboard';
import { FinancialErrorDetector } from '../../../utils/FinancialErrorDetector';
import { Transaction, Account, TransactionType, AccountType } from '../../../types';
import { formatCurrency } from '../../../utils';

// Mock React hooks for testing
vi.mock('react', () => ({
  useMemo: (fn: () => any) => {
    return fn();
  }
}));

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Helper function to call hook directly
function callHookDirectly(props: any) {
  return useSafeFinancialDashboard(props);
}

// Generate corrupted data for testing
const generateCorruptedAccounts = (): Account[] => [
  {
    id: '',
    balance: NaN,
    initialBalance: Infinity,
    currency: null as any,
    type: 'INVALID' as any,
    name: ''
  },
  {
    id: 'valid-id',
    balance: -Infinity,
    initialBalance: undefined as any,
    currency: 'INVALID_CURRENCY',
    type: AccountType.CHECKING,
    name: null as any
  },
  {
    id: null as any,
    balance: 'not-a-number' as any,
    initialBalance: NaN,
    currency: 'BRL',
    type: AccountType.SAVINGS,
    name: 'Valid Account'
  }
];

const generateCorruptedTransactions = (): Transaction[] => [
  {
    id: '',
    amount: NaN,
    type: 'INVALID' as any,
    date: 'invalid-date',
    accountId: '',
    description: null as any,
    category: 'Invalid'
  },
  {
    id: 'valid-id',
    amount: Infinity,
    type: TransactionType.INCOME,
    date: undefined as any,
    accountId: 'non-existent',
    description: 'Valid Description',
    category: 'Salary'
  },
  {
    id: null as any,
    amount: 'not-a-number' as any,
    type: TransactionType.EXPENSE,
    date: new Date().toISOString(),
    accountId: 'valid-account',
    description: 'Valid Expense',
    category: null as any
  }
];

describe('Dashboard Integration Tests - NaN Elimination', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  /**
   * **Feature: dashboard-nan-fixes, Task 14.1: Testar dashboard com dados corrompidos**
   * **Validates: Requirements 1.1, 2.1, 3.1, 5.1**
   */
  it('should never display NaN values in dashboard with corrupted data', () => {
    const corruptedAccounts = generateCorruptedAccounts();
    const corruptedTransactions = generateCorruptedTransactions();

    const dashboard = callHookDirectly({
      accounts: corruptedAccounts,
      transactions: corruptedTransactions,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Verify all numeric fields are valid numbers
    const numericFields = [
      'currentBalance', 'projectedBalance', 'pendingIncome', 'pendingExpenses',
      'monthlyIncome', 'monthlyExpense', 'netWorth'
    ];

    numericFields.forEach(field => {
      const value = dashboard[field as keyof typeof dashboard];
      expect(typeof value).toBe('number');
      expect(isNaN(value as number)).toBe(false);
      expect(isFinite(value as number)).toBe(true);
      
      // Test currency formatting of the value
      const formatted = formatCurrency(value as number);
      expect(typeof formatted).toBe('string');
      expect(formatted).not.toContain('NaN');
      expect(formatted).not.toContain('Infinity');
    });

    // Verify arrays contain only valid data
    expect(Array.isArray(dashboard.dashboardTransactions)).toBe(true);
    expect(Array.isArray(dashboard.cashFlowData)).toBe(true);
    expect(Array.isArray(dashboard.incomeSparkline)).toBe(true);
    expect(Array.isArray(dashboard.expenseSparkline)).toBe(true);

    // Verify sparkline data contains only valid numbers
    dashboard.incomeSparkline.forEach((value, index) => {
      expect(typeof value).toBe('number');
      expect(isNaN(value)).toBe(false);
      expect(isFinite(value)).toBe(true);
    });

    dashboard.expenseSparkline.forEach((value, index) => {
      expect(typeof value).toBe('number');
      expect(isNaN(value)).toBe(false);
      expect(isFinite(value)).toBe(true);
    });

    // Verify cash flow data contains only valid numbers
    dashboard.cashFlowData.forEach((dataPoint, index) => {
      expect(typeof dataPoint.Receitas).toBe('number');
      expect(typeof dataPoint.Despesas).toBe('number');
      expect(isNaN(dataPoint.Receitas)).toBe(false);
      expect(isNaN(dataPoint.Despesas)).toBe(false);
      expect(isFinite(dataPoint.Receitas)).toBe(true);
      expect(isFinite(dataPoint.Despesas)).toBe(true);
      
      if (dataPoint.Acumulado !== null) {
        expect(typeof dataPoint.Acumulado).toBe('number');
        expect(isNaN(dataPoint.Acumulado)).toBe(false);
        expect(isFinite(dataPoint.Acumulado)).toBe(true);
      }
    });

    // Verify spending chart data contains only valid numbers
    dashboard.spendingChartData.forEach((item, index) => {
      expect(typeof item.value).toBe('number');
      expect(isNaN(item.value)).toBe(false);
      expect(isFinite(item.value)).toBe(true);
      expect(item.value).toBeGreaterThanOrEqual(0);
    });

    // Verify validation summary
    expect(dashboard.validationSummary.errorsDetected).toBeGreaterThan(0);
    expect(dashboard.validationSummary.dataQualityScore).toBeLessThan(100);
    expect(dashboard.validationSummary.dataQualityScore).toBeGreaterThanOrEqual(0);

    // Verify health status is valid
    expect(['POSITIVE', 'WARNING', 'CRITICAL']).toContain(dashboard.healthStatus);
  });

  /**
   * **Feature: dashboard-nan-fixes, Task 14.2: Testar componentes individuais com dados inválidos**
   * **Validates: Requirements 4.5, 7.1, 7.2, 7.3**
   */
  it('should format all dashboard values correctly even with invalid inputs', () => {
    const corruptedAccounts = generateCorruptedAccounts();
    const corruptedTransactions = generateCorruptedTransactions();

    const dashboard = callHookDirectly({
      accounts: corruptedAccounts,
      transactions: corruptedTransactions,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Test formatting of all numeric values
    const formattedCurrentBalance = formatCurrency(dashboard.currentBalance);
    const formattedProjectedBalance = formatCurrency(dashboard.projectedBalance);
    const formattedPendingIncome = formatCurrency(dashboard.pendingIncome);
    const formattedPendingExpenses = formatCurrency(dashboard.pendingExpenses);
    const formattedMonthlyIncome = formatCurrency(dashboard.monthlyIncome);
    const formattedMonthlyExpense = formatCurrency(dashboard.monthlyExpense);
    const formattedNetWorth = formatCurrency(dashboard.netWorth);

    // All formatted values should be valid strings
    [
      formattedCurrentBalance,
      formattedProjectedBalance,
      formattedPendingIncome,
      formattedPendingExpenses,
      formattedMonthlyIncome,
      formattedMonthlyExpense,
      formattedNetWorth
    ].forEach((formatted, index) => {
      expect(typeof formatted).toBe('string');
      expect(formatted.length).toBeGreaterThan(0);
      expect(formatted).not.toContain('NaN');
      expect(formatted).not.toContain('Infinity');
      expect(formatted).not.toContain('undefined');
      expect(formatted).not.toContain('null');
      expect(formatted).toMatch(/R\$/); // Should contain currency symbol
    });

    // Test formatting of sparkline values
    dashboard.incomeSparkline.forEach(value => {
      const formatted = formatCurrency(value);
      expect(typeof formatted).toBe('string');
      expect(formatted).not.toContain('NaN');
    });

    dashboard.expenseSparkline.forEach(value => {
      const formatted = formatCurrency(value);
      expect(typeof formatted).toBe('string');
      expect(formatted).not.toContain('NaN');
    });

    // Test formatting of cash flow data
    dashboard.cashFlowData.forEach(dataPoint => {
      const formattedReceitas = formatCurrency(dataPoint.Receitas);
      const formattedDespesas = formatCurrency(dataPoint.Despesas);
      
      expect(formattedReceitas).not.toContain('NaN');
      expect(formattedDespesas).not.toContain('NaN');
      
      if (dataPoint.Acumulado !== null) {
        const formattedAcumulado = formatCurrency(dataPoint.Acumulado);
        expect(formattedAcumulado).not.toContain('NaN');
      }
    });

    // Test formatting of spending chart data
    dashboard.spendingChartData.forEach(item => {
      const formatted = formatCurrency(item.value);
      expect(formatted).not.toContain('NaN');
      expect(formatted).toMatch(/R\$/);
    });
  });

  it('should handle property-based testing with random corrupted data', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          id: fc.oneof(fc.uuid(), fc.constant(''), fc.constant(null)),
          balance: fc.oneof(fc.double(), fc.constant(NaN), fc.constant(Infinity)),
          initialBalance: fc.oneof(fc.double(), fc.constant(NaN), fc.constant(undefined)),
          currency: fc.oneof(fc.constantFrom('BRL', 'USD'), fc.constant(null), fc.constant('INVALID')),
          type: fc.oneof(
            fc.constantFrom(AccountType.CHECKING, AccountType.SAVINGS),
            fc.constant('INVALID' as any)
          ),
          name: fc.oneof(fc.string(), fc.constant(''), fc.constant(null))
        }), { maxLength: 5 }),
        fc.array(fc.record({
          id: fc.oneof(fc.uuid(), fc.constant(''), fc.constant(null)),
          amount: fc.oneof(fc.double(), fc.constant(NaN), fc.constant(Infinity)),
          type: fc.oneof(
            fc.constantFrom(TransactionType.INCOME, TransactionType.EXPENSE),
            fc.constant('INVALID' as any)
          ),
          date: fc.oneof(fc.date().map(d => d.toISOString()), fc.constant('invalid')),
          accountId: fc.oneof(fc.uuid(), fc.constant(''), fc.constant(null)),
          description: fc.oneof(fc.string(), fc.constant(null)),
          category: fc.string()
        }), { maxLength: 10 }),
        (accounts, transactions) => {
          const dashboard = callHookDirectly({
            accounts: accounts as Account[],
            transactions: transactions as Transaction[],
            currentDate: new Date(),
            spendingView: 'CATEGORY'
          });

          // Should never crash and always return valid structure
          expect(dashboard).toBeDefined();
          
          // All numeric values should be valid
          expect(typeof dashboard.currentBalance).toBe('number');
          expect(typeof dashboard.projectedBalance).toBe('number');
          expect(typeof dashboard.pendingIncome).toBe('number');
          expect(typeof dashboard.pendingExpenses).toBe('number');
          expect(typeof dashboard.monthlyIncome).toBe('number');
          expect(typeof dashboard.monthlyExpense).toBe('number');
          expect(typeof dashboard.netWorth).toBe('number');

          // No NaN values allowed
          expect(isNaN(dashboard.currentBalance)).toBe(false);
          expect(isNaN(dashboard.projectedBalance)).toBe(false);
          expect(isNaN(dashboard.pendingIncome)).toBe(false);
          expect(isNaN(dashboard.pendingExpenses)).toBe(false);
          expect(isNaN(dashboard.monthlyIncome)).toBe(false);
          expect(isNaN(dashboard.monthlyExpense)).toBe(false);
          expect(isNaN(dashboard.netWorth)).toBe(false);

          // All values should be finite
          expect(isFinite(dashboard.currentBalance)).toBe(true);
          expect(isFinite(dashboard.projectedBalance)).toBe(true);
          expect(isFinite(dashboard.pendingIncome)).toBe(true);
          expect(isFinite(dashboard.pendingExpenses)).toBe(true);
          expect(isFinite(dashboard.monthlyIncome)).toBe(true);
          expect(isFinite(dashboard.monthlyExpense)).toBe(true);
          expect(isFinite(dashboard.netWorth)).toBe(true);

          // Arrays should be defined and contain valid data
          expect(Array.isArray(dashboard.incomeSparkline)).toBe(true);
          expect(Array.isArray(dashboard.expenseSparkline)).toBe(true);
          
          dashboard.incomeSparkline.forEach(value => {
            expect(typeof value).toBe('number');
            expect(isNaN(value)).toBe(false);
            expect(isFinite(value)).toBe(true);
          });

          dashboard.expenseSparkline.forEach(value => {
            expect(typeof value).toBe('number');
            expect(isNaN(value)).toBe(false);
            expect(isFinite(value)).toBe(true);
          });

          // Health status should be valid
          expect(['POSITIVE', 'WARNING', 'CRITICAL']).toContain(dashboard.healthStatus);

          // Validation summary should be present and valid
          expect(typeof dashboard.validationSummary.dataQualityScore).toBe('number');
          expect(dashboard.validationSummary.dataQualityScore).toBeGreaterThanOrEqual(0);
          expect(dashboard.validationSummary.dataQualityScore).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should log errors appropriately for corrupted data', () => {
    const corruptedAccounts = generateCorruptedAccounts();
    const corruptedTransactions = generateCorruptedTransactions();

    callHookDirectly({
      accounts: corruptedAccounts,
      transactions: corruptedTransactions,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Should have detected and logged errors
    const errors = FinancialErrorDetector.getRecentErrors(20);
    expect(errors.length).toBeGreaterThan(0);

    // Should have various types of errors
    const errorTypes = new Set(errors.map(e => e.type));
    expect(errorTypes.size).toBeGreaterThan(0);

    // Should have logged data corruption or invalid input errors
    const hasDataErrors = errors.some(e => 
      e.type === 'DATA_CORRUPTION' || 
      e.type === 'INVALID_INPUT' ||
      e.type === 'NaN_DETECTED'
    );
    expect(hasDataErrors).toBe(true);
  });

  it('should maintain performance with large amounts of corrupted data', () => {
    const largeCorruptedAccounts = Array.from({ length: 100 }, (_, i) => ({
      id: i % 2 === 0 ? `account-${i}` : '',
      balance: i % 3 === 0 ? NaN : Math.random() * 10000,
      initialBalance: i % 4 === 0 ? Infinity : Math.random() * 10000,
      currency: i % 5 === 0 ? 'INVALID' : 'BRL',
      type: i % 6 === 0 ? 'INVALID' as any : AccountType.CHECKING,
      name: i % 7 === 0 ? '' : `Account ${i}`
    }));

    const largeCorruptedTransactions = Array.from({ length: 500 }, (_, i) => ({
      id: i % 2 === 0 ? `tx-${i}` : '',
      amount: i % 3 === 0 ? NaN : Math.random() * 1000,
      type: i % 4 === 0 ? 'INVALID' as any : (i % 2 === 0 ? TransactionType.INCOME : TransactionType.EXPENSE),
      date: i % 5 === 0 ? 'invalid-date' : new Date().toISOString(),
      accountId: i % 6 === 0 ? '' : `account-${i % 100}`,
      description: i % 7 === 0 ? null as any : `Transaction ${i}`,
      category: `Category ${i % 10}`
    }));

    const startTime = performance.now();
    
    const dashboard = callHookDirectly({
      accounts: largeCorruptedAccounts as Account[],
      transactions: largeCorruptedTransactions as Transaction[],
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    const endTime = performance.now();
    const executionTime = endTime - startTime;

    // Should complete within reasonable time (less than 5 seconds)
    expect(executionTime).toBeLessThan(5000);

    // Should still return valid results
    expect(dashboard).toBeDefined();
    expect(typeof dashboard.currentBalance).toBe('number');
    expect(isNaN(dashboard.currentBalance)).toBe(false);
    expect(isFinite(dashboard.currentBalance)).toBe(true);

    // Should have processed the data and detected errors
    expect(dashboard.validationSummary.errorsDetected).toBeGreaterThan(0);
    expect(dashboard.validationSummary.dataQualityScore).toBeLessThan(100);
  });
});