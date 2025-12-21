import { describe, it, expect } from 'vitest';
import { Transaction, TransactionType, Account, AccountType } from '../../types';
import { calculateSafeMonthlyTotals } from '../SafeFinancialCalculations';
import { useFinancialDashboard } from '../../features/dashboard/useFinancialDashboard';
import { calculateCashFlowData } from '../../core/engines/financialLogic';

describe('Shared Transaction Bug Fix', () => {
  const mockAccounts: Account[] = [
    {
      id: 'acc1',
      name: 'Conta Corrente',
      type: AccountType.CHECKING,
      balance: 1000,
      currency: 'BRL',
      userId: 'user1',
      createdAt: '2024-01-01',
      updatedAt: '2024-01-01'
    }
  ];

  const currentDate = new Date('2024-12-20');

  describe('calculateSafeMonthlyTotals', () => {
    it('should NOT count unpaid debts as expenses', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'Fran pagou a fatura',
          amount: 95.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-15',
          accountId: 'acc1',
          payerId: 'fran-user-id', // Fran paid
          isShared: true,
          isSettled: false, // NOT settled yet - this is the key
          userId: 'user1',
          createdAt: '2024-12-15',
          updatedAt: '2024-12-15'
        }
      ];

      const result = calculateSafeMonthlyTotals(transactions, mockAccounts, currentDate);

      // The unpaid debt should NOT appear as an expense
      expect(result.expenses).toBe(0);
      expect(result.income).toBe(0);
      expect(result.netFlow).toBe(0);
    });

    it('should count settled debts as expenses', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'Fran pagou a fatura (quitado)',
          amount: 95.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-15',
          accountId: 'acc1',
          payerId: 'fran-user-id', // Fran paid
          isShared: true,
          isSettled: true, // SETTLED - should count as expense
          userId: 'user1',
          createdAt: '2024-12-15',
          updatedAt: '2024-12-15'
        }
      ];

      const result = calculateSafeMonthlyTotals(transactions, mockAccounts, currentDate);

      // The settled debt should appear as an expense (my share)
      expect(result.expenses).toBe(95.00);
      expect(result.income).toBe(0);
      expect(result.netFlow).toBe(-95.00);
    });

    it('should count expenses I paid normally', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'Eu paguei a conta',
          amount: 100.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-15',
          accountId: 'acc1',
          payerId: 'me', // I paid
          isShared: false,
          userId: 'user1',
          createdAt: '2024-12-15',
          updatedAt: '2024-12-15'
        }
      ];

      const result = calculateSafeMonthlyTotals(transactions, mockAccounts, currentDate);

      // My own expenses should count normally
      expect(result.expenses).toBe(100.00);
      expect(result.income).toBe(0);
      expect(result.netFlow).toBe(-100.00);
    });
  });

  describe('calculateCashFlowData', () => {
    it('should NOT include unpaid debts in cash flow calculations', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'Fran pagou a fatura',
          amount: 95.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-15',
          accountId: 'acc1',
          payerId: 'fran-user-id', // Fran paid
          isShared: true,
          isSettled: false, // NOT settled yet
          userId: 'user1',
          createdAt: '2024-12-15',
          updatedAt: '2024-12-15'
        }
      ];

      const result = calculateCashFlowData(transactions, mockAccounts, 2024);
      const decemberData = result.find(d => d.monthIndex === 11); // December is index 11

      // Unpaid debt should not affect cash flow
      expect(decemberData?.Despesas).toBe(0);
      expect(decemberData?.Receitas).toBe(0);
    });

    it('should include settled debts in cash flow calculations', () => {
      const transactions: Transaction[] = [
        {
          id: 'tx1',
          description: 'Fran pagou a fatura (quitado)',
          amount: 95.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-15',
          accountId: 'acc1',
          payerId: 'fran-user-id', // Fran paid
          isShared: true,
          isSettled: true, // SETTLED
          userId: 'user1',
          createdAt: '2024-12-15',
          updatedAt: '2024-12-15'
        }
      ];

      const result = calculateCashFlowData(transactions, mockAccounts, 2024);
      const decemberData = result.find(d => d.monthIndex === 11); // December is index 11

      // Settled debt should affect cash flow
      expect(decemberData?.Despesas).toBe(95.00);
      expect(decemberData?.Receitas).toBe(0);
    });
  });

  describe('Real-world scenario: Fran owes R$ 95.00 but not paid', () => {
    it('should show correct dashboard totals', () => {
      const transactions: Transaction[] = [
        // Regular expense I paid
        {
          id: 'tx1',
          description: 'Supermercado',
          amount: 200.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-10',
          accountId: 'acc1',
          payerId: 'me',
          isShared: false,
          userId: 'user1',
          createdAt: '2024-12-10',
          updatedAt: '2024-12-10'
        },
        // Unpaid debt - Fran owes me but hasn't paid
        {
          id: 'tx2',
          description: 'Fran não pagou a fatura',
          amount: 95.00,
          type: TransactionType.EXPENSE,
          date: '2024-12-15',
          accountId: 'acc1',
          payerId: 'fran-user-id', // Fran paid originally
          isShared: true,
          isSettled: false, // Key: NOT settled
          userId: 'user1',
          createdAt: '2024-12-15',
          updatedAt: '2024-12-15'
        }
      ];

      const result = calculateSafeMonthlyTotals(transactions, mockAccounts, currentDate);

      // Should only count my actual expense, not Fran's unpaid debt
      expect(result.expenses).toBe(200.00); // Only my supermercado expense
      expect(result.income).toBe(0);
      expect(result.netFlow).toBe(-200.00);
    });
  });
});