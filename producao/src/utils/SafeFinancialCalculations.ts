import { Account, Transaction, TransactionType, AccountType } from '../types';
import { SafeFinancialCalculator } from './SafeFinancialCalculator';
import { FinancialErrorDetector } from './FinancialErrorDetector';
import { validateTransaction, validateAccount } from './FinancialDataValidation';
import { convertToBRL } from '../services/currencyService';
import { FinancialPrecision } from '../services/financialPrecision';
import { calculateEffectiveTransactionValue } from '../core/engines/financialLogic';

/**
 * Safe Financial Calculations - Defensive implementations of core financial functions
 * 
 * All functions in this module use comprehensive validation, error detection,
 * and safe fallbacks to ensure no NaN values are ever returned.
 */

export interface SafeProjectedBalanceResult {
  currentBalance: number;
  projectedBalance: number;
  pendingIncome: number;
  pendingExpenses: number;
  validationSummary: {
    validAccounts: number;
    invalidAccounts: number;
    validTransactions: number;
    invalidTransactions: number;
    errorsDetected: number;
  };
}

export interface SafeMonthlyTotalsResult {
  income: number;
  expenses: number;
  netFlow: number;
  validationSummary: {
    validTransactions: number;
    invalidTransactions: number;
    sanitizedValues: number;
    errorsDetected: number;
  };
}

/**
 * Safely calculates projected balance with comprehensive validation and error handling
 * @param accounts - Array of accounts (will be validated)
 * @param transactions - Array of transactions (will be validated)
 * @param currentDate - Current date for calculations
 * @returns Safe projected balance result with validation summary
 */
export const calculateSafeProjectedBalance = (
  accounts: Account[],
  transactions: Transaction[],
  currentDate: Date
): SafeProjectedBalanceResult => {
  return FinancialErrorDetector.safeCalculate(
    () => {
      // Input validation
      const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
      const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(transactions || []);
      const safeCurrentDate = currentDate instanceof Date ? currentDate : new Date();

      let validAccounts = 0;
      let invalidAccounts = 0;
      let validTransactions = 0;
      let invalidTransactions = 0;
      let errorsDetected = 0;

      // Validate accounts
      safeAccounts.forEach(account => {
        const validation = validateAccount(account);
        if (validation.isValid) {
          validAccounts++;
        } else {
          invalidAccounts++;
          errorsDetected += validation.errors.length;
          FinancialErrorDetector.logError(
            'INVALID_INPUT',
            'calculateSafeProjectedBalance',
            'account_validation',
            [account],
            `Invalid account detected: ${validation.errors.map(e => e.message).join(', ')}`,
            'MEDIUM'
          );
        }
      });

      // Validate transactions
      safeTransactions.forEach(transaction => {
        const validation = validateTransaction(transaction);
        if (validation.isValid) {
          validTransactions++;
        } else {
          invalidTransactions++;
          errorsDetected += validation.errors.length;
          FinancialErrorDetector.logError(
            'INVALID_INPUT',
            'calculateSafeProjectedBalance',
            'transaction_validation',
            [transaction],
            `Invalid transaction detected: ${validation.errors.map(e => e.message).join(', ')}`,
            'MEDIUM'
          );
        }
      });

      // Calculate current balance from liquidity accounts
      const liquidityAccounts = safeAccounts.filter(a =>
        a.type === AccountType.CHECKING ||
        a.type === AccountType.SAVINGS ||
        a.type === AccountType.CASH
      );

      const liquidityAccountIds = new Set(liquidityAccounts.map(a => a.id));
      
      const currentBalance = SafeFinancialCalculator.safeOperation(
        () => {
          return liquidityAccounts.reduce((acc, account) => {
            const safeBalance = SafeFinancialCalculator.toSafeNumber(account.balance, 0);
            const convertedBalance = SafeFinancialCalculator.safeCurrencyConversion(
              safeBalance, 
              account.currency || 'BRL'
            );
            return FinancialPrecision.sum([acc, convertedBalance]);
          }, 0);
        },
        0,
        'current_balance_calculation'
      );

      // Calculate pending income and expenses
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const endOfMonth = new Date(safeCurrentDate.getFullYear(), safeCurrentDate.getMonth() + 1, 0);
      endOfMonth.setHours(23, 59, 59, 999);

      let pendingIncome = 0;
      let pendingExpenses = 0;

      // Process transactions for pending calculations
      safeTransactions.forEach(transaction => {
        if (transaction.deleted) return;

        const tDate = new Date(transaction.date);
        tDate.setHours(0, 0, 0, 0);

        // Filter to current month only
        const isCurrentMonth = tDate.getMonth() === safeCurrentDate.getMonth() && 
                              tDate.getFullYear() === safeCurrentDate.getFullYear();
        if (!isCurrentMonth) return;

        // Handle shared transactions
        const isSharedContext = transaction.isShared || (transaction.payerId && transaction.payerId !== 'me');
        
        if (isSharedContext) {
          // Receivables (I paid, others owe me)
          if (transaction.type === TransactionType.EXPENSE && 
              (!transaction.payerId || transaction.payerId === 'me')) {
            
            if (!transaction.currency || transaction.currency === 'BRL') {
              const pendingSplitsTotal = SafeFinancialCalculator.safeOperation(
                () => {
                  return (transaction.sharedWith || []).reduce((sum, split) => {
                    if (!split.isSettled) {
                      const safeAmount = SafeFinancialCalculator.toSafeNumber(split.assignedAmount, 0);
                      return sum + safeAmount;
                    }
                    return sum;
                  }, 0);
                },
                0,
                'pending_splits_calculation'
              );

              if (pendingSplitsTotal > 0) {
                const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
                  pendingSplitsTotal, 
                  transaction.currency || 'BRL'
                );
                pendingIncome = FinancialPrecision.sum([pendingIncome, convertedAmount]);
              }
            }
          }

          // Payables (Others paid, I owe them)
          if (transaction.type === TransactionType.EXPENSE && 
              transaction.payerId && transaction.payerId !== 'me') {
            
            if (!transaction.currency || transaction.currency === 'BRL') {
              if (!transaction.isSettled) {
                const safeAmount = SafeFinancialCalculator.toSafeNumber(transaction.amount, 0);
                const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
                  safeAmount, 
                  transaction.currency || 'BRL'
                );
                pendingExpenses = FinancialPrecision.sum([pendingExpenses, convertedAmount]);
              }
            }
          }
        }

        // Skip debt transactions for cash flow (already handled above)
        if (transaction.type === TransactionType.EXPENSE && 
            transaction.payerId && transaction.payerId !== 'me') {
          return;
        }

        // Only process future transactions for pending calculations
        if (tDate <= today) return;

        // Handle transfers
        if (transaction.type === TransactionType.TRANSFER) {
          const sourceAccId = transaction.accountId;
          const isSourceLiquid = sourceAccId ? liquidityAccountIds.has(sourceAccId) : false;
          const destAccId = transaction.destinationAccountId;
          const isDestLiquid = destAccId ? liquidityAccountIds.has(destAccId) : false;

          if (isSourceLiquid && !isDestLiquid) {
            // Transfer from liquid to non-liquid (expense)
            const safeAmount = SafeFinancialCalculator.toSafeNumber(transaction.amount, 0);
            const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
              safeAmount, 
              transaction.currency || 'BRL'
            );
            pendingExpenses = FinancialPrecision.sum([pendingExpenses, convertedAmount]);
          } else if (!isSourceLiquid && isDestLiquid) {
            // Transfer from non-liquid to liquid (income)
            let amountToAdd = 0;
            
            if (transaction.destinationAmount && transaction.destinationAmount > 0) {
              const destAccount = safeAccounts.find(a => a.id === transaction.destinationAccountId);
              if (destAccount && destAccount.currency !== 'BRL') {
                amountToAdd = SafeFinancialCalculator.safeCurrencyConversion(
                  transaction.destinationAmount, 
                  destAccount.currency
                );
              } else {
                amountToAdd = SafeFinancialCalculator.toSafeNumber(transaction.destinationAmount, 0);
              }
            } else {
              const safeAmount = SafeFinancialCalculator.toSafeNumber(transaction.amount, 0);
              amountToAdd = SafeFinancialCalculator.safeCurrencyConversion(
                safeAmount, 
                transaction.currency || 'BRL'
              );
            }
            
            pendingIncome = FinancialPrecision.sum([pendingIncome, amountToAdd]);
          }
          return;
        }

        // Handle standard income/expense
        const safeAmount = SafeFinancialCalculator.toSafeNumber(transaction.amount, 0);
        
        if (transaction.type === TransactionType.INCOME) {
          const accId = transaction.accountId;
          if (accId && liquidityAccountIds.has(accId)) {
            const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
              safeAmount, 
              transaction.currency || 'BRL'
            );
            pendingIncome = FinancialPrecision.sum([pendingIncome, convertedAmount]);
          }
        } else if (transaction.type === TransactionType.EXPENSE) {
          const accId = transaction.accountId;
          if (accId && liquidityAccountIds.has(accId)) {
            const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
              safeAmount, 
              transaction.currency || 'BRL'
            );
            pendingExpenses = FinancialPrecision.sum([pendingExpenses, convertedAmount]);
          }
        }
      });

      // Calculate final projected balance
      const projectedBalance = SafeFinancialCalculator.safeOperation(
        () => FinancialPrecision.sum([currentBalance, pendingIncome, -pendingExpenses]),
        currentBalance,
        'projected_balance_calculation'
      );

      return {
        currentBalance: FinancialPrecision.round(currentBalance),
        projectedBalance: FinancialPrecision.round(projectedBalance),
        pendingIncome: FinancialPrecision.round(pendingIncome),
        pendingExpenses: FinancialPrecision.round(pendingExpenses),
        validationSummary: {
          validAccounts,
          invalidAccounts,
          validTransactions,
          invalidTransactions,
          errorsDetected
        }
      };
    },
    'calculateSafeProjectedBalance',
    'projected_balance_calculation',
    [accounts, transactions, currentDate],
    {
      currentBalance: 0,
      projectedBalance: 0,
      pendingIncome: 0,
      pendingExpenses: 0,
      validationSummary: {
        validAccounts: 0,
        invalidAccounts: Array.isArray(accounts) ? accounts.length : 0,
        validTransactions: 0,
        invalidTransactions: Array.isArray(transactions) ? transactions.length : 0,
        errorsDetected: 1
      }
    }
  ).result;
};

/**
 * Safely calculates monthly totals with comprehensive validation
 * @param transactions - Array of transactions for the month
 * @param accounts - Array of accounts for currency conversion
 * @param currentDate - Current date to filter by month
 * @returns Safe monthly totals with validation summary
 */
export const calculateSafeMonthlyTotals = (
  transactions: Transaction[],
  accounts: Account[],
  currentDate: Date
): SafeMonthlyTotalsResult => {
  return FinancialErrorDetector.safeCalculate(
    () => {
      const safeTransactions = SafeFinancialCalculator.sanitizeTransactions(transactions || []);
      const safeAccounts = SafeFinancialCalculator.sanitizeAccounts(accounts || []);
      const safeCurrentDate = currentDate instanceof Date ? currentDate : new Date();

      let validTransactions = 0;
      let invalidTransactions = 0;
      let sanitizedValues = 0;
      let errorsDetected = 0;

      // Filter transactions for current month
      const monthlyTransactions = safeTransactions.filter(transaction => {
        const tDate = new Date(transaction.date);
        return tDate.getMonth() === safeCurrentDate.getMonth() && 
               tDate.getFullYear() === safeCurrentDate.getFullYear();
      });

      let income = 0;
      let expenses = 0;

      monthlyTransactions.forEach(transaction => {
        // Validate transaction
        const validation = validateTransaction(transaction);
        if (validation.isValid) {
          validTransactions++;
        } else {
          invalidTransactions++;
          errorsDetected += validation.errors.length;
          if (validation.sanitizedTransaction) {
            sanitizedValues++;
          }
        }

        const account = safeAccounts.find(a => a.id === transaction.accountId);
        const safeAmount = SafeFinancialCalculator.toSafeNumber(transaction.amount, 0);

        if (transaction.type === TransactionType.INCOME) {
          const amount = transaction.isRefund ? -safeAmount : safeAmount;
          const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
            amount, 
            account?.currency || 'BRL'
          );
          income = FinancialPrecision.sum([income, convertedAmount]);
        } else if (transaction.type === TransactionType.EXPENSE) {
          // Skip unpaid debts (someone else paid and I haven't settled yet)
          // These should not appear as expenses until they are actually paid/settled
          if (transaction.payerId && transaction.payerId !== 'me' && !transaction.isSettled) {
            return; // Skip this transaction - it's an unpaid debt, not an expense
          }

          // Calculate effective value for shared transactions
          let expenseValue = safeAmount;
          
          if (transaction.isShared) {
            if (!transaction.payerId || transaction.payerId === 'me') {
              // I paid: my expense = total - amount shared with others
              const sharedAmount = (transaction.sharedWith || []).reduce((sum, split) => {
                if (!split.isSettled) {
                  const splitAmount = SafeFinancialCalculator.toSafeNumber(split.assignedAmount, 0);
                  return sum + splitAmount;
                }
                return sum;
              }, 0);
              expenseValue = safeAmount - sharedAmount;
            } else if (transaction.payerId !== 'me') {
              // Someone else paid: my expense = my assigned amount
              expenseValue = SafeFinancialCalculator.safeOperation(
                () => calculateEffectiveTransactionValue(transaction),
                safeAmount,
                'effective_transaction_value'
              );
            }
          }

          const amount = transaction.isRefund ? -expenseValue : expenseValue;
          const convertedAmount = SafeFinancialCalculator.safeCurrencyConversion(
            amount, 
            account?.currency || 'BRL'
          );
          expenses = FinancialPrecision.sum([expenses, convertedAmount]);
        }
      });

      const netFlow = SafeFinancialCalculator.safeOperation(
        () => FinancialPrecision.subtract(income, expenses),
        0,
        'net_flow_calculation'
      );

      return {
        income: FinancialPrecision.round(income),
        expenses: FinancialPrecision.round(expenses),
        netFlow: FinancialPrecision.round(netFlow),
        validationSummary: {
          validTransactions,
          invalidTransactions,
          sanitizedValues,
          errorsDetected
        }
      };
    },
    'calculateSafeMonthlyTotals',
    'monthly_totals_calculation',
    [transactions, accounts, currentDate],
    {
      income: 0,
      expenses: 0,
      netFlow: 0,
      validationSummary: {
        validTransactions: 0,
        invalidTransactions: Array.isArray(transactions) ? transactions.length : 0,
        sanitizedValues: 0,
        errorsDetected: 1
      }
    }
  ).result;
};

/**
 * Safe wrapper for calculateEffectiveTransactionValue with validation
 * @param transaction - Transaction to calculate effective value for
 * @returns Safe effective transaction value, never NaN
 */
export const calculateSafeEffectiveTransactionValue = (transaction: Transaction): number => {
  return FinancialErrorDetector.safeCalculate(
    () => {
      // Validate transaction first
      const validation = validateTransaction(transaction);
      
      if (!validation.isValid) {
        FinancialErrorDetector.logError(
          'INVALID_INPUT',
          'calculateSafeEffectiveTransactionValue',
          'transaction_validation',
          [transaction],
          `Invalid transaction for effective value calculation: ${validation.errors.map(e => e.message).join(', ')}`,
          'MEDIUM'
        );
        
        // Use sanitized version if available
        const safeTransaction = validation.sanitizedTransaction || transaction;
        return SafeFinancialCalculator.safeTransactionValue(safeTransaction);
      }

      // Use existing logic with safe wrapper
      return SafeFinancialCalculator.safeTransactionValue(transaction);
    },
    'calculateSafeEffectiveTransactionValue',
    'effective_transaction_value',
    [transaction],
    0
  ).result;
};

/**
 * Safe financial health analysis with validation
 * @param income - Income amount
 * @param expenses - Expenses amount
 * @returns Health status, never undefined
 */
export const analyzeSafeFinancialHealth = (
  income: any, 
  expenses: any
): 'POSITIVE' | 'WARNING' | 'CRITICAL' => {
  return FinancialErrorDetector.safeCalculate(
    () => {
      const safeIncome = SafeFinancialCalculator.toSafeNumber(income, 0);
      const safeExpenses = SafeFinancialCalculator.toSafeNumber(expenses, 0);

      if (safeIncome === 0) {
        return safeExpenses > 0 ? 'CRITICAL' : 'POSITIVE';
      }

      const savingRate = SafeFinancialCalculator.safeOperation(
        () => (safeIncome - safeExpenses) / safeIncome,
        0,
        'saving_rate_calculation'
      );

      if (savingRate < 0) return 'CRITICAL'; // Spending more than earning
      if (savingRate < 0.1) return 'WARNING'; // Saving less than 10%
      return 'POSITIVE'; // Healthy
    },
    'analyzeSafeFinancialHealth',
    'financial_health_analysis',
    [income, expenses],
    'CRITICAL'
  ).result;
};

/**
 * Safe percentage calculation with division by zero protection
 * @param part - Part value
 * @param total - Total value
 * @returns Safe percentage (0-100), never NaN
 */
export const calculateSafePercentage = (part: any, total: any): number => {
  return SafeFinancialCalculator.safePercentage(part, total);
};

/**
 * Safe array sum with validation
 * @param values - Array of values to sum
 * @param logInvalid - Whether to log invalid values
 * @returns Safe sum, never NaN
 */
export const calculateSafeSum = (values: any[], logInvalid: boolean = true): number => {
  return SafeFinancialCalculator.safeSum(values, logInvalid);
};

/**
 * Safe average calculation with empty array protection
 * @param values - Array of values to average
 * @returns Safe average, never NaN
 */
export const calculateSafeAverage = (values: any[]): number => {
  return SafeFinancialCalculator.safeAverage(values);
};