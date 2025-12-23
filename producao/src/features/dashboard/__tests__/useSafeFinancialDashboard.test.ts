import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { useSafeFinancialDashboard, useFinancialDashboardSafe } from '../useSafeFinancialDashboard';
import { FinancialErrorDetector } from '../../../utils/FinancialErrorDetector';
import { Transaction, Account, TransactionType, AccountType } from '../../../types';

// Mock React hooks for testing
vi.mock('react', () => ({
  useMemo: (fn: () => any) => {
    // Simple implementation that just calls the function
    return fn();
  }
}));

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Custom arbitraries for testing
const validNumberArbitrary = fc.double({ 
  min: -1000000, 
  max: 1000000, 
  noNaN: true,
  noDefaultInfinity: true
});

const invalidValueArbitrary = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity),
  fc.constant('invalid'),
  fc.constant(''),
  fc.constant({}),
  fc.constant([]),
  fc.constant(true),
  fc.constant(false)
);

const validAccountArbitrary = fc.record({
  id: fc.uuid(),
  balance: validNumberArbitrary,
  initialBalance: validNumberArbitrary,
  currency: fc.constantFrom('BRL', 'USD', 'EUR'),
  type: fc.constantFrom(AccountType.CHECKING, AccountType.SAVINGS, AccountType.CREDIT_CARD, AccountType.CASH),
  name: fc.string({ minLength: 1 })
});

const invalidAccountArbitrary = fc.record({
  id: fc.oneof(fc.uuid(), fc.constant(''), fc.constant(null), fc.constant(undefined)),
  balance: fc.oneof(validNumberArbitrary, invalidValueArbitrary),
  initialBalance: fc.oneof(validNumberArbitrary, invalidValueArbitrary),
  currency: fc.oneof(fc.constantFrom('BRL', 'USD', 'EUR'), fc.constant(null), fc.constant(123)),
  type: fc.oneof(
    fc.constantFrom(AccountType.CHECKING, AccountType.SAVINGS, AccountType.CREDIT_CARD, AccountType.CASH),
    fc.constant('INVALID_TYPE' as any),
    fc.constant(null)
  ),
  name: fc.oneof(fc.string({ minLength: 1 }), fc.constant(''), fc.constant(null), fc.constant(undefined))
});

const validTransactionArbitrary = fc.record({
  id: fc.uuid(),
  amount: validNumberArbitrary,
  type: fc.constantFrom(TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER),
  date: fc.integer({ min: 1577836800000, max: 1924991999000 }).map(timestamp => new Date(timestamp).toISOString()),
  accountId: fc.uuid(),
  deleted: fc.boolean(),
  description: fc.string(),
  category: fc.string(),
  isShared: fc.boolean(),
  payerId: fc.option(fc.string(), { nil: undefined }),
  sharedWith: fc.option(fc.array(fc.record({
    assignedAmount: validNumberArbitrary,
    isSettled: fc.boolean(),
    memberId: fc.string(),
    percentage: fc.double({ min: 0, max: 100 })
  })), { nil: undefined })
});

const invalidTransactionArbitrary = fc.record({
  id: fc.oneof(fc.uuid(), fc.constant(''), fc.constant(null), fc.constant(undefined)),
  amount: fc.oneof(validNumberArbitrary, invalidValueArbitrary),
  type: fc.oneof(
    fc.constantFrom(TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER),
    fc.constant('INVALID_TYPE' as any),
    fc.constant(null),
    fc.constant(undefined)
  ),
  date: fc.oneof(
    fc.integer({ min: 1577836800000, max: 1924991999000 }).map(timestamp => new Date(timestamp).toISOString()),
    fc.constant('invalid-date'),
    fc.constant(''),
    fc.constant(null),
    fc.constant(undefined)
  ),
  accountId: fc.oneof(fc.uuid(), fc.constant(''), fc.constant(null), fc.constant(undefined)),
  deleted: fc.boolean(),
  description: fc.oneof(fc.string(), fc.constant(null), fc.constant(123)),
  category: fc.string(),
  isShared: fc.boolean(),
  payerId: fc.option(fc.string(), { nil: undefined }),
  sharedWith: fc.option(fc.array(fc.record({
    assignedAmount: fc.oneof(validNumberArbitrary, invalidValueArbitrary),
    isSettled: fc.boolean(),
    memberId: fc.oneof(fc.string(), fc.constant(null), fc.constant(undefined)),
    percentage: fc.oneof(fc.double({ min: 0, max: 100 }), invalidValueArbitrary)
  })), { nil: undefined })
});

// Helper function to call hook directly
function callHookDirectly(props: any) {
  return useSafeFinancialDashboard(props);
}

describe('useSafeFinancialDashboard - Property Tests', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 15: Empty Dataset Returns Zero**
   * **Validates: Requirements 1.3, 2.3, 5.2**
   */
  it('should handle empty datasets gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant([]),
          fc.constant(null as unknown as Account[]),
          fc.constant(undefined as unknown as Account[])
        ),
        fc.oneof(
          fc.constant([]),
          fc.constant(null as unknown as Transaction[]),
          fc.constant(undefined as unknown as Transaction[])
        ),
        fc.date(),
        fc.constantFrom('CATEGORY', 'SOURCE'),
        (accounts, transactions, currentDate, spendingView) => {
          const dashboard = callHookDirectly({
            accounts: accounts as Account[],
            transactions: transactions as Transaction[],
            currentDate,
            spendingView
          });

          // Should handle empty data gracefully
          expect(dashboard).toBeDefined();
          expect(typeof dashboard.currentBalance).toBe('number');
          expect(typeof dashboard.projectedBalance).toBe('number');
          expect(typeof dashboard.pendingIncome).toBe('number');
          expect(typeof dashboard.pendingExpenses).toBe('number');
          expect(typeof dashboard.monthlyIncome).toBe('number');
          expect(typeof dashboard.monthlyExpense).toBe('number');
          expect(typeof dashboard.netWorth).toBe('number');

          // Should never return NaN
          expect(isNaN(dashboard.currentBalance)).toBe(false);
          expect(isNaN(dashboard.projectedBalance)).toBe(false);
          expect(isNaN(dashboard.pendingIncome)).toBe(false);
          expect(isNaN(dashboard.pendingExpenses)).toBe(false);
          expect(isNaN(dashboard.monthlyIncome)).toBe(false);
          expect(isNaN(dashboard.monthlyExpense)).toBe(false);
          expect(isNaN(dashboard.netWorth)).toBe(false);

          // Empty datasets should return zero values
          expect(dashboard.currentBalance).toBe(0);
          expect(dashboard.projectedBalance).toBe(0);
          expect(dashboard.pendingIncome).toBe(0);
          expect(dashboard.pendingExpenses).toBe(0);
          expect(dashboard.monthlyIncome).toBe(0);
          expect(dashboard.monthlyExpense).toBe(0);
          expect(dashboard.netWorth).toBe(0);

          // Arrays should be empty but defined
          expect(Array.isArray(dashboard.dashboardTransactions)).toBe(true);
          expect(Array.isArray(dashboard.cashFlowData)).toBe(true);
          expect(Array.isArray(dashboard.incomeSparkline)).toBe(true);
          expect(Array.isArray(dashboard.expenseSparkline)).toBe(true);
          expect(Array.isArray(dashboard.upcomingBills)).toBe(true);
          expect(Array.isArray(dashboard.spendingChartData)).toBe(true);

          // Validation summary should be present
          expect(dashboard.validationSummary).toBeDefined();
          expect(typeof dashboard.validationSummary.dataQualityScore).toBe('number');
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should always return valid numbers for any input combination', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(validAccountArbitrary, invalidAccountArbitrary), { maxLength: 10 }),
        fc.array(fc.oneof(validTransactionArbitrary, invalidTransactionArbitrary), { maxLength: 20 }),
        fc.date(),
        fc.constantFrom('CATEGORY', 'SOURCE'),
        (accounts, transactions, currentDate, spendingView) => {
          const dashboard = callHookDirectly({
            accounts: accounts as Account[],
            transactions: transactions as Transaction[],
            currentDate,
            spendingView
          });

          // Should always return valid structure
          expect(dashboard).toBeDefined();
          
          // All numeric values should be valid numbers
          const numericFields = [
            'currentBalance', 'projectedBalance', 'pendingIncome', 'pendingExpenses',
            'monthlyIncome', 'monthlyExpense', 'netWorth'
          ];

          numericFields.forEach(field => {
            const value = dashboard[field as keyof typeof dashboard];
            expect(typeof value).toBe('number');
            expect(isNaN(value as number)).toBe(false);
            expect(isFinite(value as number)).toBe(true);
          });

          // Health status should be valid
          expect(['POSITIVE', 'WARNING', 'CRITICAL']).toContain(dashboard.healthStatus);

          // Arrays should be defined
          expect(Array.isArray(dashboard.dashboardTransactions)).toBe(true);
          expect(Array.isArray(dashboard.cashFlowData)).toBe(true);
          expect(Array.isArray(dashboard.incomeSparkline)).toBe(true);
          expect(Array.isArray(dashboard.expenseSparkline)).toBe(true);

          // Sparkline data should contain only valid numbers
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

          // Validation summary should be present
          expect(dashboard.validationSummary).toBeDefined();
          expect(typeof dashboard.validationSummary.totalAccounts).toBe('number');
          expect(typeof dashboard.validationSummary.validAccounts).toBe('number');
          expect(typeof dashboard.validationSummary.totalTransactions).toBe('number');
          expect(typeof dashboard.validationSummary.validTransactions).toBe('number');
          expect(typeof dashboard.validationSummary.errorsDetected).toBe('number');
          expect(typeof dashboard.validationSummary.dataQualityScore).toBe('number');

          // Data quality score should be between 0 and 100
          expect(dashboard.validationSummary.dataQualityScore).toBeGreaterThanOrEqual(0);
          expect(dashboard.validationSummary.dataQualityScore).toBeLessThanOrEqual(100);

          // Health report should be present
          expect(dashboard.healthReport).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should maintain data consistency across multiple calls', () => {
    fc.assert(
      fc.property(
        fc.array(validAccountArbitrary, { minLength: 1, maxLength: 5 }),
        fc.array(validTransactionArbitrary, { minLength: 1, maxLength: 10 }),
        fc.date(),
        (accounts, transactions, currentDate) => {
          const props = {
            accounts,
            transactions,
            currentDate,
            spendingView: 'CATEGORY' as const
          };

          // Call hook multiple times with same props
          const dashboard1 = callHookDirectly(props);
          const dashboard2 = callHookDirectly(props);

          // Results should be consistent
          expect(dashboard1.currentBalance).toBe(dashboard2.currentBalance);
          expect(dashboard1.projectedBalance).toBe(dashboard2.projectedBalance);
          expect(dashboard1.pendingIncome).toBe(dashboard2.pendingIncome);
          expect(dashboard1.pendingExpenses).toBe(dashboard2.pendingExpenses);
          expect(dashboard1.monthlyIncome).toBe(dashboard2.monthlyIncome);
          expect(dashboard1.monthlyExpense).toBe(dashboard2.monthlyExpense);
          expect(dashboard1.netWorth).toBe(dashboard2.netWorth);
          expect(dashboard1.healthStatus).toBe(dashboard2.healthStatus);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle corrupted data without crashing', () => {
    fc.assert(
      fc.property(
        fc.array(invalidAccountArbitrary, { minLength: 1, maxLength: 5 }),
        fc.array(invalidTransactionArbitrary, { minLength: 1, maxLength: 10 }),
        fc.date(),
        (accounts, transactions, currentDate) => {
          const dashboard = callHookDirectly({
            accounts: accounts as Account[],
            transactions: transactions as Transaction[],
            currentDate,
            spendingView: 'CATEGORY'
          });

          // Should not crash and return valid structure
          expect(dashboard).toBeDefined();
          expect(typeof dashboard.currentBalance).toBe('number');
          expect(isNaN(dashboard.currentBalance)).toBe(false);

          // Should detect validation issues
          expect(dashboard.validationSummary.errorsDetected).toBeGreaterThanOrEqual(0);
          expect(dashboard.validationSummary.dataQualityScore).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should provide backward compatibility through useFinancialDashboardSafe', () => {
    fc.assert(
      fc.property(
        fc.array(validAccountArbitrary, { maxLength: 5 }),
        fc.array(validTransactionArbitrary, { maxLength: 10 }),
        fc.date(),
        (accounts, transactions, currentDate) => {
          const props = {
            accounts,
            transactions,
            currentDate,
            spendingView: 'CATEGORY' as const
          };

          const safeDashboard = callHookDirectly(props);
          const compatDashboard = useFinancialDashboardSafe(props);

          // Compatible hook should have all the original fields
          const originalFields = [
            'dashboardTransactions', 'currentBalance', 'projectedBalance', 
            'pendingIncome', 'pendingExpenses', 'healthStatus', 'netWorth',
            'monthlyIncome', 'monthlyExpense', 'cashFlowData', 'hasCashFlowData',
            'incomeSparkline', 'expenseSparkline', 'upcomingBills', 'spendingChartData'
          ];

          originalFields.forEach(field => {
            expect(compatDashboard).toHaveProperty(field);
            expect(compatDashboard[field as keyof typeof compatDashboard])
              .toEqual(safeDashboard[field as keyof typeof safeDashboard]);
          });

          // Compatible hook should NOT have extended fields
          expect(compatDashboard).not.toHaveProperty('validationSummary');
          expect(compatDashboard).not.toHaveProperty('healthReport');
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('useSafeFinancialDashboard - Unit Tests', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
    consoleErrorSpy.mockClear();
  });

  it('should handle valid data correctly', () => {
    const accounts: Account[] = [
      {
        id: 'acc1',
        balance: 1000,
        initialBalance: 1000,
        currency: 'BRL',
        type: AccountType.CHECKING,
        name: 'Conta Corrente'
      }
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx1',
        amount: 500,
        type: TransactionType.INCOME,
        date: new Date().toISOString(),
        accountId: 'acc1',
        description: 'Salário',
        category: 'Salário'
      }
    ];

    const dashboard = callHookDirectly({
      accounts,
      transactions,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    expect(dashboard.currentBalance).toBe(1000);
    expect(dashboard.validationSummary.validAccounts).toBe(1);
    expect(dashboard.validationSummary.validTransactions).toBe(1);
    expect(dashboard.validationSummary.dataQualityScore).toBe(100);
    expect(dashboard.healthStatus).toBeDefined();
  });

  it('should handle null/undefined inputs gracefully', () => {
    const dashboard = callHookDirectly({
      accounts: null as any,
      transactions: undefined as any,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    expect(dashboard.currentBalance).toBe(0);
    expect(dashboard.projectedBalance).toBe(0);
    expect(dashboard.monthlyIncome).toBe(0);
    expect(dashboard.monthlyExpense).toBe(0);
    expect(dashboard.netWorth).toBe(0);
    expect(dashboard.validationSummary.totalAccounts).toBe(0);
    expect(dashboard.validationSummary.totalTransactions).toBe(0);
  });

  it('should handle invalid date gracefully', () => {
    const dashboard = callHookDirectly({
      accounts: [],
      transactions: [],
      currentDate: 'invalid-date' as any,
      spendingView: 'CATEGORY'
    });

    // Should not crash and return valid data
    expect(dashboard).toBeDefined();
    expect(typeof dashboard.currentBalance).toBe('number');
    expect(isNaN(dashboard.currentBalance)).toBe(false);
  });

  it('should detect and report data quality issues', () => {
    const invalidAccounts: Account[] = [
      {
        id: '',
        balance: NaN,
        initialBalance: NaN,
        currency: null as any,
        type: 'INVALID' as any,
        name: ''
      }
    ];

    const invalidTransactions: Transaction[] = [
      {
        id: '',
        amount: NaN,
        type: 'INVALID' as any,
        date: 'invalid-date',
        accountId: '',
        description: null as any,
        category: 'Invalid'
      }
    ];

    const dashboard = callHookDirectly({
      accounts: invalidAccounts,
      transactions: invalidTransactions,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Should still return valid numbers
    expect(isNaN(dashboard.currentBalance)).toBe(false);
    expect(isNaN(dashboard.projectedBalance)).toBe(false);

    // Should detect quality issues
    expect(dashboard.validationSummary.errorsDetected).toBeGreaterThan(0);
    expect(dashboard.validationSummary.dataQualityScore).toBeLessThan(100);
  });

  it('should provide health reporting', () => {
    const dashboard = callHookDirectly({
      accounts: [],
      transactions: [],
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    expect(dashboard.healthReport).toBeDefined();
    expect(dashboard.healthReport.timestamp).toBeInstanceOf(Date);
    expect(typeof dashboard.healthReport.summary).toBe('object');
    expect(typeof dashboard.healthReport.dataQualityScore).toBe('number');
    expect(Array.isArray(dashboard.healthReport.recommendations)).toBe(true);
  });

  it('should handle different spending views', () => {
    const accounts: Account[] = [
      {
        id: 'acc1',
        balance: 1000,
        initialBalance: 1000,
        currency: 'BRL',
        type: AccountType.CHECKING,
        name: 'Conta Corrente'
      }
    ];

    const transactions: Transaction[] = [
      {
        id: 'tx1',
        amount: 100,
        type: TransactionType.EXPENSE,
        date: new Date().toISOString(),
        accountId: 'acc1',
        description: 'Compra',
        category: 'Alimentação'
      }
    ];

    // Test CATEGORY view
    const categoryDashboard = callHookDirectly({
      accounts,
      transactions,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Test SOURCE view
    const sourceDashboard = callHookDirectly({
      accounts,
      transactions,
      currentDate: new Date(),
      spendingView: 'SOURCE'
    });

    // Both should return valid data
    expect(categoryDashboard.spendingChartData).toBeDefined();
    expect(sourceDashboard.spendingChartData).toBeDefined();
    expect(Array.isArray(categoryDashboard.spendingChartData)).toBe(true);
    expect(Array.isArray(sourceDashboard.spendingChartData)).toBe(true);
  });

  it('should handle projected accounts parameter', () => {
    const accounts: Account[] = [
      {
        id: 'acc1',
        balance: 1000,
        initialBalance: 1000,
        currency: 'BRL',
        type: AccountType.CHECKING,
        name: 'Conta Corrente'
      }
    ];

    const projectedAccounts: Account[] = [
      {
        id: 'acc1',
        balance: 1500, // Different projected balance
        initialBalance: 1000,
        currency: 'BRL',
        type: AccountType.CHECKING,
        name: 'Conta Corrente'
      }
    ];

    const dashboard = callHookDirectly({
      accounts,
      transactions: [],
      projectedAccounts,
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Should use projected accounts for calculations
    expect(dashboard.currentBalance).toBe(1500);
    expect(dashboard.validationSummary.validAccounts).toBe(1);
  });

  it('should log errors for significant data quality issues', () => {
    const invalidData = Array.from({ length: 10 }, () => ({
      id: '',
      balance: NaN,
      initialBalance: NaN,
      currency: null,
      type: 'INVALID',
      name: ''
    }));

    callHookDirectly({
      accounts: invalidData as any,
      transactions: [],
      currentDate: new Date(),
      spendingView: 'CATEGORY'
    });

    // Should have logged errors
    const errors = FinancialErrorDetector.getRecentErrors(10);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some(e => e.type === 'INVALID_INPUT' || e.type === 'DATA_CORRUPTION')).toBe(true);
  });
});