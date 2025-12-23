import { describe, it, expect, vi } from 'vitest';
import * as fc from 'fast-check';
import { 
  validateTransaction, 
  validateAccount, 
  validateTransactionArray,
  validateAccountArray,
  validateFinancialData,
  isSafeForCalculation
} from '../FinancialDataValidation';
import { Transaction, Account, TransactionType, AccountType } from '../../types';

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

// Custom arbitraries for validation testing
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

const validNumberArbitrary = fc.double({ 
  min: -1000000, 
  max: 1000000, 
  noNaN: true,
  noDefaultInfinity: true
});

const validTransactionArbitrary = fc.record({
  id: fc.uuid(),
  amount: validNumberArbitrary,
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
    fc.date({ min: new Date(2020, 0, 1), max: new Date(2030, 11, 31) }).map(d => d.toISOString()),
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

describe('FinancialDataValidation - Property Tests', () => {
  
  /**
   * **Feature: dashboard-nan-fixes, Property 3: Invalid Values Trigger Logging and Fallback**
   * **Validates: Requirements 1.4, 2.4, 4.3**
   */
  it('should always return validation results for any transaction input', () => {
    fc.assert(
      fc.property(
        fc.oneof(validTransactionArbitrary, invalidTransactionArbitrary, fc.constant(null), fc.constant(undefined)),
        (transaction) => {
          const result = validateTransaction(transaction as Transaction);
          
          // Should always return a result object
          expect(result).toBeDefined();
          expect(typeof result.isValid).toBe('boolean');
          expect(Array.isArray(result.errors)).toBe(true);
          
          // If invalid, should have errors
          if (!result.isValid) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
          
          // If sanitized transaction exists, it should have safe values
          if (result.sanitizedTransaction) {
            expect(typeof result.sanitizedTransaction.amount).toBe('number');
            expect(isNaN(result.sanitizedTransaction.amount)).toBe(false);
            expect(isFinite(result.sanitizedTransaction.amount)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should always return validation results for any account input', () => {
    fc.assert(
      fc.property(
        fc.oneof(validAccountArbitrary, invalidAccountArbitrary, fc.constant(null), fc.constant(undefined)),
        (account) => {
          const result = validateAccount(account as Account);
          
          // Should always return a result object
          expect(result).toBeDefined();
          expect(typeof result.isValid).toBe('boolean');
          expect(Array.isArray(result.errors)).toBe(true);
          
          // If invalid, should have errors
          if (!result.isValid) {
            expect(result.errors.length).toBeGreaterThan(0);
          }
          
          // If sanitized account exists, it should have safe values
          if (result.sanitizedAccount) {
            expect(typeof result.sanitizedAccount.balance).toBe('number');
            expect(isNaN(result.sanitizedAccount.balance)).toBe(false);
            expect(isFinite(result.sanitizedAccount.balance)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should correctly identify safe values for calculations', () => {
    fc.assert(
      fc.property(
        fc.oneof(validNumberArbitrary, invalidValueArbitrary),
        (value) => {
          const isSafe = isSafeForCalculation(value);
          
          if (isSafe) {
            // If marked as safe, should be usable in calculations
            expect(typeof value === 'number' || typeof value === 'string').toBe(true);
            if (typeof value === 'number') {
              expect(isNaN(value)).toBe(false);
              expect(isFinite(value)).toBe(true);
            }
            if (typeof value === 'string') {
              const parsed = parseFloat(value);
              expect(isNaN(parsed)).toBe(false);
              expect(isFinite(parsed)).toBe(true);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle transaction arrays safely', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.array(validTransactionArbitrary, { maxLength: 20 }),
          fc.array(invalidTransactionArbitrary, { maxLength: 20 }),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('not-an-array' as any)
        ),
        (transactions) => {
          const result = validateTransactionArray(transactions as Transaction[]);
          
          expect(result).toBeDefined();
          expect(typeof result.isValid).toBe('boolean');
          expect(typeof result.totalCount).toBe('number');
          expect(typeof result.validCount).toBe('number');
          expect(typeof result.invalidCount).toBe('number');
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.sanitizedTransactions)).toBe(true);
          
          // Counts should add up
          if (Array.isArray(transactions)) {
            expect(result.totalCount).toBe(transactions.length);
            expect(result.validCount + result.invalidCount).toBe(result.totalCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle account arrays safely', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.array(validAccountArbitrary, { maxLength: 20 }),
          fc.array(invalidAccountArbitrary, { maxLength: 20 }),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant('not-an-array' as any)
        ),
        (accounts) => {
          const result = validateAccountArray(accounts as Account[]);
          
          expect(result).toBeDefined();
          expect(typeof result.isValid).toBe('boolean');
          expect(typeof result.totalCount).toBe('number');
          expect(typeof result.validCount).toBe('number');
          expect(typeof result.invalidCount).toBe('number');
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.sanitizedAccounts)).toBe(true);
          
          // Counts should add up
          if (Array.isArray(accounts)) {
            expect(result.totalCount).toBe(accounts.length);
            expect(result.validCount + result.invalidCount).toBe(result.totalCount);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should validate mixed financial data safely', () => {
    fc.assert(
      fc.property(
        fc.record({
          transactions: fc.option(fc.array(fc.oneof(validTransactionArbitrary, invalidTransactionArbitrary), { maxLength: 10 }), { nil: undefined }),
          accounts: fc.option(fc.array(fc.oneof(validAccountArbitrary, invalidAccountArbitrary), { maxLength: 10 }), { nil: undefined })
        }),
        (data) => {
          const result = validateFinancialData(data as any);
          
          expect(result).toBeDefined();
          expect(typeof result.overallValid).toBe('boolean');
          expect(result.summary).toBeDefined();
          expect(typeof result.summary.totalTransactions).toBe('number');
          expect(typeof result.summary.validTransactions).toBe('number');
          expect(typeof result.summary.totalAccounts).toBe('number');
          expect(typeof result.summary.validAccounts).toBe('number');
          expect(typeof result.summary.totalErrors).toBe('number');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve valid data unchanged', () => {
    fc.assert(
      fc.property(
        validTransactionArbitrary,
        (transaction) => {
          const result = validateTransaction(transaction);
          
          // Valid transactions should pass validation
          if (result.isValid) {
            expect(result.errors).toHaveLength(0);
            expect(result.sanitizedTransaction).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should preserve valid account data unchanged', () => {
    fc.assert(
      fc.property(
        validAccountArbitrary,
        (account) => {
          const result = validateAccount(account);
          
          // Valid accounts should pass validation
          if (result.isValid) {
            expect(result.errors).toHaveLength(0);
            expect(result.sanitizedAccount).toBeUndefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize invalid amounts to safe numbers', () => {
    fc.assert(
      fc.property(
        invalidValueArbitrary,
        (invalidAmount) => {
          const transaction = {
            id: 'test-id',
            amount: invalidAmount,
            type: TransactionType.EXPENSE,
            date: new Date().toISOString(),
            accountId: 'test-account',
            description: 'Test transaction'
          } as Transaction;

          const result = validateTransaction(transaction);
          
          if (result.sanitizedTransaction) {
            expect(typeof result.sanitizedTransaction.amount).toBe('number');
            expect(isNaN(result.sanitizedTransaction.amount)).toBe(false);
            expect(isFinite(result.sanitizedTransaction.amount)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should sanitize invalid balances to safe numbers', () => {
    fc.assert(
      fc.property(
        invalidValueArbitrary,
        (invalidBalance) => {
          const account = {
            id: 'test-id',
            balance: invalidBalance,
            currency: 'BRL',
            type: AccountType.CHECKING,
            name: 'Test Account'
          } as Account;

          const result = validateAccount(account);
          
          if (result.sanitizedAccount) {
            expect(typeof result.sanitizedAccount.balance).toBe('number');
            expect(isNaN(result.sanitizedAccount.balance)).toBe(false);
            expect(isFinite(result.sanitizedAccount.balance)).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

describe('FinancialDataValidation - Unit Tests', () => {
  
  it('should handle null/undefined transactions', () => {
    expect(validateTransaction(null as any).isValid).toBe(false);
    expect(validateTransaction(undefined as any).isValid).toBe(false);
  });

  it('should handle null/undefined accounts', () => {
    expect(validateAccount(null as any).isValid).toBe(false);
    expect(validateAccount(undefined as any).isValid).toBe(false);
  });

  it('should validate required transaction fields', () => {
    const invalidTransaction = {
      // Missing required fields
    } as Transaction;

    const result = validateTransaction(invalidTransaction);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should validate required account fields', () => {
    const invalidAccount = {
      // Missing required fields
    } as Account;

    const result = validateAccount(invalidAccount);
    expect(result.isValid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should detect NaN amounts', () => {
    const transaction = {
      id: 'test',
      amount: NaN,
      type: TransactionType.EXPENSE,
      date: new Date().toISOString(),
      accountId: 'test-account'
    } as Transaction;

    const result = validateTransaction(transaction);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'amount')).toBe(true);
  });

  it('should detect invalid dates', () => {
    const transaction = {
      id: 'test',
      amount: 100,
      type: TransactionType.EXPENSE,
      date: 'invalid-date',
      accountId: 'test-account'
    } as Transaction;

    const result = validateTransaction(transaction);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'date')).toBe(true);
  });

  it('should validate transfer-specific fields', () => {
    const transfer = {
      id: 'test',
      amount: 100,
      type: TransactionType.TRANSFER,
      date: new Date().toISOString(),
      accountId: 'source-account',
      // Missing destinationAccountId
    } as Transaction;

    const result = validateTransaction(transfer);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'destinationAccountId')).toBe(true);
  });

  it('should validate shared transaction splits', () => {
    const sharedTransaction = {
      id: 'test',
      amount: 100,
      type: TransactionType.EXPENSE,
      date: new Date().toISOString(),
      accountId: 'test-account',
      isShared: true,
      sharedWith: [
        { assignedAmount: 150, isSettled: false } // Exceeds total amount
      ]
    } as Transaction;

    const result = validateTransaction(sharedTransaction);
    expect(result.isValid).toBe(false);
    expect(result.errors.some(e => e.field === 'sharedWith')).toBe(true);
  });

  it('should identify safe calculation values correctly', () => {
    expect(isSafeForCalculation(100)).toBe(true);
    expect(isSafeForCalculation('100')).toBe(true);
    expect(isSafeForCalculation('100.50')).toBe(true);
    expect(isSafeForCalculation(NaN)).toBe(false);
    expect(isSafeForCalculation(Infinity)).toBe(false);
    expect(isSafeForCalculation(null)).toBe(false);
    expect(isSafeForCalculation(undefined)).toBe(false);
    expect(isSafeForCalculation('invalid')).toBe(false);
    expect(isSafeForCalculation({})).toBe(false);
  });
});