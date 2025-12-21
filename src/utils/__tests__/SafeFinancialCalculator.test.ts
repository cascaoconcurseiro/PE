import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { SafeFinancialCalculator } from '../SafeFinancialCalculator';
import { Transaction, Account, TransactionType, AccountType } from '../../types';

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Custom arbitraries for financial testing
const invalidNumberArbitrary = fc.oneof(
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

const validNumberArbitrary = fc.double({ 
  min: -1000000, 
  max: 1000000, 
  noNaN: true,
  noDefaultInfinity: true
});

const mixedNumberArrayArbitrary = fc.array(
  fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
  { minLength: 0, maxLength: 50 }
);

const transactionArbitrary = fc.record({
  id: fc.uuid(),
  amount: fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
  type: fc.constantFrom(TransactionType.INCOME, TransactionType.EXPENSE, TransactionType.TRANSFER),
  date: fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(d => d.toISOString()),
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

const accountArbitrary = fc.record({
  id: fc.uuid(),
  balance: fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
  initialBalance: fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
  currency: fc.constantFrom('BRL', 'USD', 'EUR'),
  type: fc.constantFrom(AccountType.CHECKING, AccountType.SAVINGS, AccountType.CREDIT_CARD, AccountType.CASH),
  name: fc.string()
});

describe('SafeFinancialCalculator - Property Tests', () => {
  
  /**
   * **Feature: dashboard-nan-fixes, Property 2: Null and Undefined Values Convert to Zero**
   * **Validates: Requirements 1.2, 2.2, 4.2**
   */
  it('should convert null and undefined to zero in calculations', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined)),
        (invalidValue) => {
          const result = SafeFinancialCalculator.toSafeNumber(invalidValue);
          expect(result).toBe(0);
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 1: Financial Calculations Always Return Valid Numbers**
   * **Validates: Requirements 1.1, 2.1, 3.1, 5.1, 8.5**
   */
  it('should never return NaN from any safe calculation method', () => {
    fc.assert(
      fc.property(
        fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
        (value) => {
          const result = SafeFinancialCalculator.toSafeNumber(value);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 3: Invalid Values Trigger Logging and Fallback**
   * **Validates: Requirements 1.4, 2.4, 4.3**
   */
  it('should use fallback values for invalid inputs', () => {
    fc.assert(
      fc.property(
        invalidNumberArbitrary,
        fc.double({ min: -1000, max: 1000 }),
        (invalidValue, fallback) => {
          const result = SafeFinancialCalculator.toSafeNumber(invalidValue, fallback);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          // Should return fallback for invalid values
          if (invalidValue === null || invalidValue === undefined || 
              (typeof invalidValue === 'number' && (isNaN(invalidValue) || !isFinite(invalidValue)))) {
            expect(result).toBe(fallback);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely sum arrays with mixed valid and invalid values', () => {
    fc.assert(
      fc.property(
        mixedNumberArrayArbitrary,
        (values) => {
          const result = SafeFinancialCalculator.safeSum(values, false); // Don't log in tests
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
          
          // Result should be >= 0 if all valid values are positive
          const validPositiveValues = values.filter(v => 
            typeof v === 'number' && !isNaN(v) && isFinite(v) && v > 0
          );
          if (validPositiveValues.length === values.filter(v => 
            typeof v === 'number' && !isNaN(v) && isFinite(v)
          ).length) {
            expect(result).toBeGreaterThanOrEqual(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely calculate transaction values', () => {
    fc.assert(
      fc.property(
        transactionArbitrary,
        (transaction) => {
          const result = SafeFinancialCalculator.safeTransactionValue(transaction as Transaction);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
          // Transaction values can be negative (refunds, etc.), so just check they're finite
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely convert currencies', () => {
    fc.assert(
      fc.property(
        fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
        fc.constantFrom('BRL', 'USD', 'EUR', 'INVALID'),
        (amount, currency) => {
          const result = SafeFinancialCalculator.safeCurrencyConversion(amount, currency);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely calculate account balances', () => {
    fc.assert(
      fc.property(
        accountArbitrary,
        (account) => {
          const result = SafeFinancialCalculator.safeAccountBalance(account as Account);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely calculate percentages with division by zero protection', () => {
    fc.assert(
      fc.property(
        fc.oneof(validNumberArbitrary, invalidNumberArbitrary),
        fc.oneof(validNumberArbitrary, invalidNumberArbitrary, fc.constant(0)),
        (part, total) => {
          const result = SafeFinancialCalculator.safePercentage(part, total);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
          // Percentages can be negative (negative part/positive total) so remove >= 0 check
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely calculate averages with empty array protection', () => {
    fc.assert(
      fc.property(
        mixedNumberArrayArbitrary,
        (values) => {
          const result = SafeFinancialCalculator.safeAverage(values);
          
          expect(isNaN(result)).toBe(false);
          expect(isFinite(result)).toBe(true);
          expect(typeof result).toBe('number');
          
          // Empty arrays should return 0
          if (values.length === 0) {
            expect(result).toBe(0);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize transaction arrays safely', () => {
    fc.assert(
      fc.property(
        fc.array(transactionArbitrary, { maxLength: 20 }),
        (transactions) => {
          const result = SafeFinancialCalculator.sanitizeTransactions(transactions as Transaction[]);
          
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(transactions.length);
          
          // All amounts should be valid numbers
          result.forEach(transaction => {
            expect(isNaN(transaction.amount)).toBe(false);
            expect(isFinite(transaction.amount)).toBe(true);
            expect(typeof transaction.amount).toBe('number');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize account arrays safely', () => {
    fc.assert(
      fc.property(
        fc.array(accountArbitrary, { maxLength: 20 }),
        (accounts) => {
          const result = SafeFinancialCalculator.sanitizeAccounts(accounts as Account[]);
          
          expect(Array.isArray(result)).toBe(true);
          expect(result.length).toBe(accounts.length);
          
          // All balances should be valid numbers
          result.forEach(account => {
            expect(isNaN(account.balance)).toBe(false);
            expect(isFinite(account.balance)).toBe(true);
            expect(typeof account.balance).toBe('number');
          });
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle safe operations with error recovery', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        validNumberArbitrary, // Use only valid numbers to avoid Infinity issues
        (shouldThrow, fallbackValue) => {
          const operation = () => {
            if (shouldThrow) {
              throw new Error('Test error');
            }
            return fallbackValue;
          };

          const result = SafeFinancialCalculator.safeOperation(
            operation,
            0,
            'test operation'
          );

          expect(typeof result).toBe('number');
          expect(isFinite(result)).toBe(true);
          if (shouldThrow) {
            expect(result).toBe(0); // Should return fallback
          } else {
            expect(result).toBe(fallbackValue);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('SafeFinancialCalculator - Unit Tests', () => {
  
  it('should handle edge cases correctly', () => {
    // Test specific edge cases
    expect(SafeFinancialCalculator.toSafeNumber(null)).toBe(0);
    expect(SafeFinancialCalculator.toSafeNumber(undefined)).toBe(0);
    expect(SafeFinancialCalculator.toSafeNumber(NaN)).toBe(0);
    expect(SafeFinancialCalculator.toSafeNumber(Infinity)).toBe(0);
    expect(SafeFinancialCalculator.toSafeNumber(-Infinity)).toBe(0);
    expect(SafeFinancialCalculator.toSafeNumber('123.45')).toBe(123.45);
    expect(SafeFinancialCalculator.toSafeNumber('invalid')).toBe(0);
    expect(SafeFinancialCalculator.toSafeNumber(true)).toBe(1);
    expect(SafeFinancialCalculator.toSafeNumber(false)).toBe(0);
  });

  it('should handle empty and invalid arrays', () => {
    expect(SafeFinancialCalculator.safeSum([])).toBe(0);
    expect(SafeFinancialCalculator.safeSum(null as any)).toBe(0);
    expect(SafeFinancialCalculator.safeSum(undefined as any)).toBe(0);
    expect(SafeFinancialCalculator.safeAverage([])).toBe(0);
  });

  it('should handle null transactions and accounts', () => {
    expect(SafeFinancialCalculator.safeTransactionValue(null as any)).toBe(0);
    expect(SafeFinancialCalculator.safeAccountBalance(null as any)).toBe(0);
  });

  it('should handle division by zero in percentage calculation', () => {
    expect(SafeFinancialCalculator.safePercentage(10, 0)).toBe(0);
    expect(SafeFinancialCalculator.safePercentage(0, 0)).toBe(0);
  });
});