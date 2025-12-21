import { Transaction, Account } from '../types';
import { FinancialPrecision } from '../services/financialPrecision';
import { convertToBRL } from '../services/currencyService';
import { calculateEffectiveTransactionValue } from '../core/engines/financialLogic';

/**
 * SafeFinancialCalculator - Utility class for defensive financial calculations
 * 
 * Provides safe mathematical operations that never return NaN, null, or undefined.
 * All methods include comprehensive input validation and fallback mechanisms.
 */
export class SafeFinancialCalculator {
  /**
   * Safely converts any value to a valid number for financial calculations
   * @param value - Any input value that should be a number
   * @param fallback - Fallback value to use if conversion fails (default: 0)
   * @returns Valid number, never NaN/null/undefined
   */
  static toSafeNumber(value: any, fallback: number = 0): number {
    // Handle null and undefined
    if (value === null || value === undefined) {
      return fallback;
    }

    // Handle string conversion
    if (typeof value === 'string') {
      const parsed = parseFloat(value);
      return isNaN(parsed) ? fallback : parsed;
    }

    // Handle number validation
    if (typeof value === 'number') {
      return isNaN(value) || !isFinite(value) ? fallback : value;
    }

    // Handle boolean (true = 1, false = 0)
    if (typeof value === 'boolean') {
      return value ? 1 : 0;
    }

    // All other types default to fallback
    return fallback;
  }

  /**
   * Safely sums an array of values, filtering out invalid ones
   * @param values - Array of values to sum
   * @param logInvalid - Whether to log invalid values found (default: true)
   * @returns Valid sum, never NaN
   */
  static safeSum(values: any[], logInvalid: boolean = true): number {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }

    const validValues: number[] = [];
    const invalidValues: any[] = [];

    values.forEach((value, index) => {
      const originalValue = value;
      const safeValue = this.toSafeNumber(value);
      
      // Check if conversion was needed (original was invalid)
      if (originalValue !== null && originalValue !== undefined && 
          (typeof originalValue === 'number' ? isNaN(originalValue) : false)) {
        invalidValues.push({ index, original: originalValue, converted: safeValue });
      }
      
      validValues.push(safeValue);
    });

    if (logInvalid && invalidValues.length > 0) {
      console.warn('SafeFinancialCalculator: Invalid values found in sum:', invalidValues);
    }

    return FinancialPrecision.sum(validValues);
  }

  /**
   * Safely calculates transaction effective value with comprehensive validation
   * @param transaction - Transaction to calculate value for
   * @returns Safe transaction value, never NaN
   */
  static safeTransactionValue(transaction: Transaction): number {
    if (!transaction) {
      console.warn('SafeFinancialCalculator: Null transaction provided');
      return 0;
    }

    const safeAmount = this.toSafeNumber(transaction.amount, 0);
    
    if (safeAmount === 0 && transaction.amount !== 0) {
      console.warn(`SafeFinancialCalculator: Transaction ${transaction.id} has invalid amount:`, transaction.amount);
    }

    try {
      // Use existing logic but with safe values
      const transactionWithSafeAmount = {
        ...transaction,
        amount: safeAmount
      };

      const result = calculateEffectiveTransactionValue(transactionWithSafeAmount);
      return this.toSafeNumber(result, 0);
    } catch (error) {
      console.error('SafeFinancialCalculator: Error calculating transaction value:', error);
      return safeAmount; // Fallback to safe amount
    }
  }

  /**
   * Safely converts currency with comprehensive validation
   * @param amount - Amount to convert
   * @param currency - Currency code (default: 'BRL')
   * @returns Converted amount in BRL, never NaN
   */
  static safeCurrencyConversion(amount: any, currency: string = 'BRL'): number {
    const safeAmount = this.toSafeNumber(amount, 0);
    
    if (safeAmount === 0) {
      return 0;
    }

    try {
      const result = convertToBRL(safeAmount, currency);
      return this.toSafeNumber(result, safeAmount); // Fallback to original amount if conversion fails
    } catch (error) {
      console.warn('SafeFinancialCalculator: Currency conversion failed:', { 
        amount: safeAmount, 
        currency, 
        error: error instanceof Error ? error.message : error 
      });
      return safeAmount; // Fallback to original amount
    }
  }

  /**
   * Safely calculates account balance with type-specific handling
   * @param account - Account to calculate balance for
   * @returns Safe balance, never NaN
   */
  static safeAccountBalance(account: Account): number {
    if (!account) {
      console.warn('SafeFinancialCalculator: Null account provided');
      return 0;
    }

    const safeBalance = this.toSafeNumber(account.balance, 0);
    
    if (safeBalance === 0 && account.balance !== 0) {
      console.warn(`SafeFinancialCalculator: Account ${account.id} has invalid balance:`, account.balance);
    }

    // Convert to BRL for consistency
    return this.safeCurrencyConversion(safeBalance, account.currency || 'BRL');
  }

  /**
   * Safely performs mathematical operations with error handling
   * @param operation - Function that performs the calculation
   * @param fallback - Fallback value if operation fails
   * @param context - Context string for error logging
   * @returns Result of operation or fallback value
   */
  static safeOperation<T>(
    operation: () => T, 
    fallback: T, 
    context: string = 'unknown'
  ): T {
    try {
      const result = operation();
      
      // Additional check for numeric results
      if (typeof result === 'number' && (isNaN(result) || !isFinite(result))) {
        console.warn(`SafeFinancialCalculator: Operation "${context}" returned invalid number:`, result);
        return fallback;
      }
      
      return result;
    } catch (error) {
      console.error(`SafeFinancialCalculator: Operation "${context}" failed:`, error);
      return fallback;
    }
  }

  /**
   * Validates and sanitizes an array of transactions
   * @param transactions - Array of transactions to validate
   * @returns Array of transactions with safe amounts
   */
  static sanitizeTransactions(transactions: Transaction[]): Transaction[] {
    if (!Array.isArray(transactions)) {
      console.warn('SafeFinancialCalculator: Invalid transactions array provided');
      return [];
    }

    return transactions.map(transaction => {
      const safeAmount = this.toSafeNumber(transaction.amount, 0);
      
      if (safeAmount !== transaction.amount) {
        console.warn(`SafeFinancialCalculator: Sanitized transaction ${transaction.id} amount from ${transaction.amount} to ${safeAmount}`);
      }

      return {
        ...transaction,
        amount: safeAmount
      };
    });
  }

  /**
   * Validates and sanitizes an array of accounts
   * @param accounts - Array of accounts to validate
   * @returns Array of accounts with safe balances
   */
  static sanitizeAccounts(accounts: Account[]): Account[] {
    if (!Array.isArray(accounts)) {
      console.warn('SafeFinancialCalculator: Invalid accounts array provided');
      return [];
    }

    return accounts.map(account => {
      const safeBalance = this.toSafeNumber(account.balance, 0);
      
      if (safeBalance !== account.balance) {
        console.warn(`SafeFinancialCalculator: Sanitized account ${account.id} balance from ${account.balance} to ${safeBalance}`);
      }

      return {
        ...account,
        balance: safeBalance
      };
    });
  }

  /**
   * Safely calculates percentage with division by zero protection
   * @param part - Part value
   * @param total - Total value
   * @returns Percentage (0-100), never NaN
   */
  static safePercentage(part: any, total: any): number {
    const safePart = this.toSafeNumber(part, 0);
    const safeTotal = this.toSafeNumber(total, 0);

    if (safeTotal === 0) {
      return 0; // Avoid division by zero
    }

    const percentage = (safePart / safeTotal) * 100;
    return this.toSafeNumber(percentage, 0);
  }

  /**
   * Safely calculates average with empty array protection
   * @param values - Array of values to average
   * @returns Average value, never NaN
   */
  static safeAverage(values: any[]): number {
    if (!Array.isArray(values) || values.length === 0) {
      return 0;
    }

    const sum = this.safeSum(values, false); // Don't log for average calculation
    return sum / values.length;
  }
}