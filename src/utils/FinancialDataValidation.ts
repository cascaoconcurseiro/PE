import { Transaction, Account, TransactionType } from '../types';
import { SafeFinancialCalculator } from './SafeFinancialCalculator';

/**
 * Financial Data Validation utilities
 * 
 * Provides comprehensive validation for financial data structures
 * to ensure data integrity and prevent NaN values in calculations.
 */

export interface ValidationError {
  field: string;
  message: string;
  originalValue: any;
  suggestedValue?: any;
}

export interface TransactionValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedTransaction?: Transaction;
}

export interface AccountValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  sanitizedAccount?: Account;
}

/**
 * Validates a transaction and returns validation results with optional sanitized version
 * @param transaction - Transaction to validate
 * @returns Validation result with errors and sanitized transaction if needed
 */
export const validateTransaction = (transaction: Transaction): TransactionValidationResult => {
  const errors: ValidationError[] = [];
  let sanitized: Transaction | undefined;

  if (!transaction) {
    return {
      isValid: false,
      errors: [{ field: 'transaction', message: 'Transaction is null or undefined', originalValue: transaction }]
    };
  }

  // Validate ID
  if (!transaction.id || typeof transaction.id !== 'string' || transaction.id.trim() === '') {
    errors.push({
      field: 'id',
      message: 'Transaction ID is required and must be a non-empty string',
      originalValue: transaction.id,
      suggestedValue: `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    });
  }

  // Validate amount
  const originalAmount = transaction.amount;
  const safeAmount = SafeFinancialCalculator.toSafeNumber(originalAmount, 0);
  
  if (originalAmount === null || originalAmount === undefined) {
    errors.push({
      field: 'amount',
      message: 'Transaction amount cannot be null or undefined',
      originalValue: originalAmount,
      suggestedValue: 0
    });
  } else if (typeof originalAmount === 'number' && isNaN(originalAmount)) {
    errors.push({
      field: 'amount',
      message: 'Transaction amount cannot be NaN',
      originalValue: originalAmount,
      suggestedValue: 0
    });
  } else if (typeof originalAmount === 'number' && !isFinite(originalAmount)) {
    errors.push({
      field: 'amount',
      message: 'Transaction amount must be finite',
      originalValue: originalAmount,
      suggestedValue: 0
    });
  } else if (typeof originalAmount !== 'number' && typeof originalAmount !== 'string') {
    errors.push({
      field: 'amount',
      message: 'Transaction amount must be a number or numeric string',
      originalValue: originalAmount,
      suggestedValue: 0
    });
  }

  // Validate amount is positive for most cases
  if (safeAmount < 0 && transaction.type !== TransactionType.TRANSFER) {
    // Allow negative amounts only for refunds or specific cases
    if (!transaction.isRefund) {
      errors.push({
        field: 'amount',
        message: 'Transaction amount should be positive (use isRefund flag for negative amounts)',
        originalValue: originalAmount,
        suggestedValue: Math.abs(safeAmount)
      });
    }
  }

  // Validate date
  if (!transaction.date) {
    errors.push({
      field: 'date',
      message: 'Transaction date is required',
      originalValue: transaction.date,
      suggestedValue: new Date().toISOString()
    });
  } else {
    const dateObj = new Date(transaction.date);
    if (isNaN(dateObj.getTime())) {
      errors.push({
        field: 'date',
        message: 'Transaction date is invalid',
        originalValue: transaction.date,
        suggestedValue: new Date().toISOString()
      });
    } else {
      // ✅ VALIDAÇÃO CRÍTICA: Verificar se a data realmente existe no calendário
      // Exemplo: 2024-02-30 seria inválido (fevereiro só tem 29 dias em 2024)
      try {
        const [year, month, day] = transaction.date.split('T')[0].split('-').map(Number);
        const reconstructedDate = new Date(year, month - 1, day);
        
        if (
          reconstructedDate.getFullYear() !== year ||
          reconstructedDate.getMonth() !== month - 1 ||
          reconstructedDate.getDate() !== day
        ) {
          errors.push({
            field: 'date',
            message: `Transaction date is invalid: day ${day} does not exist in month ${month} of year ${year}`,
            originalValue: transaction.date,
            suggestedValue: new Date(year, month - 1, Math.min(day, new Date(year, month, 0).getDate())).toISOString().split('T')[0]
          });
        }
      } catch (e) {
        errors.push({
          field: 'date',
          message: 'Transaction date format is invalid',
          originalValue: transaction.date,
          suggestedValue: new Date().toISOString()
        });
      }
    }
  }

  // Validate transaction type
  if (!transaction.type || !Object.values(TransactionType).includes(transaction.type)) {
    errors.push({
      field: 'type',
      message: 'Transaction type is required and must be a valid TransactionType',
      originalValue: transaction.type,
      suggestedValue: TransactionType.EXPENSE
    });
  }

  // Validate account ID (required for most transactions)
  if (!transaction.accountId || typeof transaction.accountId !== 'string') {
    // Exception: shared transactions where someone else paid might not have accountId yet
    const isSharedPending = transaction.isShared && transaction.payerId && transaction.payerId !== 'me';
    if (!isSharedPending) {
      errors.push({
        field: 'accountId',
        message: 'Transaction accountId is required and must be a string',
        originalValue: transaction.accountId,
        suggestedValue: 'default-account-id'
      });
    }
  }

  // Validate shared transaction data
  if (transaction.isShared && transaction.sharedWith && Array.isArray(transaction.sharedWith)) {
    let splitsTotal = 0;
    const invalidSplits: any[] = [];

    transaction.sharedWith.forEach((split, index) => {
      if (!split || typeof split !== 'object') {
        invalidSplits.push({ index, split, reason: 'Split is not an object' });
        return;
      }

      const splitAmount = SafeFinancialCalculator.toSafeNumber(split.assignedAmount, 0);
      if (split.assignedAmount !== splitAmount) {
        invalidSplits.push({ 
          index, 
          split, 
          reason: 'Invalid assignedAmount',
          original: split.assignedAmount,
          safe: splitAmount
        });
      }

      splitsTotal += splitAmount;
    });

    if (invalidSplits.length > 0) {
      errors.push({
        field: 'sharedWith',
        message: 'Some splits have invalid data',
        originalValue: invalidSplits,
        suggestedValue: 'Fix split amounts to be valid numbers'
      });
    }

    // ✅ VALIDAÇÃO CRÍTICA: Check if splits total exceeds transaction amount (with small tolerance)
    if (splitsTotal > safeAmount + 0.01) {
      errors.push({
        field: 'sharedWith',
        message: `Splits total (${splitsTotal.toFixed(2)}) exceeds transaction amount (${safeAmount.toFixed(2)}). This will cause incorrect calculations.`,
        originalValue: splitsTotal,
        suggestedValue: `Adjust splits proportionally to total exactly ${safeAmount.toFixed(2)}`
      });
      
      // Log this critical error for debugging
      console.error('🚨 CRITICAL: Split validation failed', {
        transactionId: transaction.id,
        transactionAmount: safeAmount,
        splitsTotal: splitsTotal,
        difference: splitsTotal - safeAmount,
        splits: transaction.sharedWith.map(s => ({
          memberId: s.memberId,
          amount: s.assignedAmount
        }))
      });
    }
  }

  // Validate transfer-specific fields
  if (transaction.type === TransactionType.TRANSFER) {
    if (!transaction.destinationAccountId) {
      errors.push({
        field: 'destinationAccountId',
        message: 'Transfer transactions require a destination account ID',
        originalValue: transaction.destinationAccountId,
        suggestedValue: 'destination-account-id'
      });
    }

    if (transaction.accountId === transaction.destinationAccountId) {
      errors.push({
        field: 'destinationAccountId',
        message: 'Transfer destination cannot be the same as source account',
        originalValue: transaction.destinationAccountId,
        suggestedValue: 'different-account-id'
      });
    }

    // Validate destination amount for multi-currency transfers
    if (transaction.destinationAmount !== undefined) {
      const safeDestAmount = SafeFinancialCalculator.toSafeNumber(transaction.destinationAmount, 0);
      if (transaction.destinationAmount !== safeDestAmount) {
        errors.push({
          field: 'destinationAmount',
          message: 'Transfer destination amount is invalid',
          originalValue: transaction.destinationAmount,
          suggestedValue: safeDestAmount
        });
      }
    }
  }

  // Validate description
  if (transaction.description && typeof transaction.description !== 'string') {
    errors.push({
      field: 'description',
      message: 'Transaction description must be a string',
      originalValue: transaction.description,
      suggestedValue: String(transaction.description || 'Transaction')
    });
  }

  // Create sanitized version if there are errors
  if (errors.length > 0) {
    sanitized = {
      ...transaction,
      id: transaction.id || `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      amount: safeAmount,
      date: transaction.date && !isNaN(new Date(transaction.date).getTime()) 
        ? transaction.date 
        : new Date().toISOString(),
      type: Object.values(TransactionType).includes(transaction.type) 
        ? transaction.type 
        : TransactionType.EXPENSE,
      accountId: transaction.accountId || 'default-account-id',
      description: typeof transaction.description === 'string' 
        ? transaction.description 
        : String(transaction.description || 'Transaction'),
      // Sanitize shared splits if needed
      sharedWith: transaction.sharedWith?.map(split => ({
        ...split,
        assignedAmount: SafeFinancialCalculator.toSafeNumber(split.assignedAmount, 0)
      })),
      // Sanitize destination amount for transfers
      destinationAmount: transaction.destinationAmount !== undefined 
        ? SafeFinancialCalculator.toSafeNumber(transaction.destinationAmount, safeAmount)
        : undefined
    };
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedTransaction: sanitized
  };
};

/**
 * Validates an account and returns validation results with optional sanitized version
 * @param account - Account to validate
 * @returns Validation result with errors and sanitized account if needed
 */
export const validateAccount = (account: Account): AccountValidationResult => {
  const errors: ValidationError[] = [];
  let sanitized: Account | undefined;

  if (!account) {
    return {
      isValid: false,
      errors: [{ field: 'account', message: 'Account is null or undefined', originalValue: account }]
    };
  }

  // Validate ID
  if (!account.id || typeof account.id !== 'string' || account.id.trim() === '') {
    errors.push({
      field: 'id',
      message: 'Account ID is required and must be a non-empty string',
      originalValue: account.id,
      suggestedValue: `account-${Date.now()}`
    });
  }

  // Validate balance
  const originalBalance = account.balance;
  const safeBalance = SafeFinancialCalculator.toSafeNumber(originalBalance, 0);
  
  if (originalBalance === null || originalBalance === undefined) {
    errors.push({
      field: 'balance',
      message: 'Account balance cannot be null or undefined',
      originalValue: originalBalance,
      suggestedValue: 0
    });
  } else if (typeof originalBalance === 'number' && isNaN(originalBalance)) {
    errors.push({
      field: 'balance',
      message: 'Account balance cannot be NaN',
      originalValue: originalBalance,
      suggestedValue: 0
    });
  } else if (typeof originalBalance === 'number' && !isFinite(originalBalance)) {
    errors.push({
      field: 'balance',
      message: 'Account balance must be finite',
      originalValue: originalBalance,
      suggestedValue: 0
    });
  } else if (typeof originalBalance !== 'number' && typeof originalBalance !== 'string') {
    errors.push({
      field: 'balance',
      message: 'Account balance must be a number or numeric string',
      originalValue: originalBalance,
      suggestedValue: 0
    });
  }

  // Validate currency
  if (account.currency && typeof account.currency !== 'string') {
    errors.push({
      field: 'currency',
      message: 'Account currency must be a string',
      originalValue: account.currency,
      suggestedValue: 'BRL'
    });
  }

  // Validate name
  if (!account.name || typeof account.name !== 'string' || account.name.trim() === '') {
    errors.push({
      field: 'name',
      message: 'Account name is required and must be a non-empty string',
      originalValue: account.name,
      suggestedValue: 'Unnamed Account'
    });
  }

  // Validate type
  if (!account.type || typeof account.type !== 'string') {
    errors.push({
      field: 'type',
      message: 'Account type is required and must be a string',
      originalValue: account.type,
      suggestedValue: 'CHECKING'
    });
  }

  // Create sanitized version if there are errors
  if (errors.length > 0) {
    sanitized = {
      ...account,
      id: account.id || `account-${Date.now()}`,
      balance: safeBalance,
      currency: typeof account.currency === 'string' ? account.currency : 'BRL',
      name: (typeof account.name === 'string' && account.name.trim()) 
        ? account.name 
        : 'Unnamed Account',
      type: account.type || 'CHECKING'
    };
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitizedAccount: sanitized
  };
};

/**
 * Validates an array of transactions and returns summary results
 * @param transactions - Array of transactions to validate
 * @returns Summary of validation results
 */
export const validateTransactionArray = (transactions: Transaction[]) => {
  if (!Array.isArray(transactions)) {
    return {
      isValid: false,
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      errors: ['Input is not an array'],
      sanitizedTransactions: []
    };
  }

  const results = transactions.map(validateTransaction);
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.length - validCount;
  const allErrors = results.flatMap(r => r.errors.map(e => `${e.field}: ${e.message}`));
  
  return {
    isValid: invalidCount === 0,
    totalCount: transactions.length,
    validCount,
    invalidCount,
    errors: allErrors,
    sanitizedTransactions: results.map(r => r.sanitizedTransaction || r.isValid ? transactions[results.indexOf(r)] : r.sanitizedTransaction).filter(Boolean),
    validationResults: results
  };
};

/**
 * Validates an array of accounts and returns summary results
 * @param accounts - Array of accounts to validate
 * @returns Summary of validation results
 */
export const validateAccountArray = (accounts: Account[]) => {
  if (!Array.isArray(accounts)) {
    return {
      isValid: false,
      totalCount: 0,
      validCount: 0,
      invalidCount: 0,
      errors: ['Input is not an array'],
      sanitizedAccounts: []
    };
  }

  const results = accounts.map(validateAccount);
  const validCount = results.filter(r => r.isValid).length;
  const invalidCount = results.length - validCount;
  const allErrors = results.flatMap(r => r.errors.map(e => `${e.field}: ${e.message}`));
  
  return {
    isValid: invalidCount === 0,
    totalCount: accounts.length,
    validCount,
    invalidCount,
    errors: allErrors,
    sanitizedAccounts: results.map(r => r.sanitizedAccount || r.isValid ? accounts[results.indexOf(r)] : r.sanitizedAccount).filter(Boolean),
    validationResults: results
  };
};

/**
 * Quick validation check - returns true if data is safe for calculations
 * @param value - Value to check
 * @returns True if value is safe for financial calculations
 */
export const isSafeForCalculation = (value: any): boolean => {
  if (value === null || value === undefined) return false;
  if (typeof value === 'number') {
    return !isNaN(value) && isFinite(value);
  }
  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return !isNaN(parsed) && isFinite(parsed);
  }
  return false;
};

/**
 * Batch validation for mixed financial data
 * @param data - Object containing transactions and accounts
 * @returns Comprehensive validation results
 */
export const validateFinancialData = (data: { 
  transactions?: Transaction[], 
  accounts?: Account[] 
}) => {
  const transactionResults = data.transactions ? validateTransactionArray(data.transactions) : null;
  const accountResults = data.accounts ? validateAccountArray(data.accounts) : null;

  return {
    transactions: transactionResults,
    accounts: accountResults,
    overallValid: (transactionResults?.isValid ?? true) && (accountResults?.isValid ?? true),
    summary: {
      totalTransactions: transactionResults?.totalCount ?? 0,
      validTransactions: transactionResults?.validCount ?? 0,
      totalAccounts: accountResults?.totalCount ?? 0,
      validAccounts: accountResults?.validCount ?? 0,
      totalErrors: (transactionResults?.errors.length ?? 0) + (accountResults?.errors.length ?? 0)
    }
  };
};