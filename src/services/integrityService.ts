/**
 * Serviço de Integridade de Dados
 * 
 * Verifica e valida a integridade dos dados financeiros
 * Detecta inconsistências e problemas de dados
 */

import { supabaseService } from './supabaseService';
import { supabase } from '../integrations/supabase/client';
import { FinancialPrecision } from './financialPrecision';
import { Transaction, TransactionType } from '../types';
import { isCreditCard } from '../utils/accountTypeUtils';

export interface IntegrityIssue {
  type: string;
  severity: 'error' | 'warning' | 'info';
  message: string;
  entityId?: string;
  details?: Record<string, unknown>;
}

export class IntegrityService {
  /**
   * Verifica integridade completa do sistema
   */
  static async checkSystemIntegrity(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // 1. Verificar contas
    const accountIssues = await this.checkAccounts();
    issues.push(...accountIssues);

    // 2. Verificar transações
    const transactionIssues = await this.checkTransactions();
    issues.push(...transactionIssues);

    // 3. Verificar splits
    const splitIssues = await this.checkSplits();
    issues.push(...splitIssues);

    // 4. Verificar saldos
    const balanceIssues = await this.checkBalances();
    issues.push(...balanceIssues);

    return issues;
  }

  /**
   * Verifica integridade das contas
   */
  private static async checkAccounts(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    try {
      const accounts = await supabaseService.getAccounts();

      // Verificar contas sem nome
      const accountsWithoutName = accounts.filter(a => !a.name || a.name.trim() === '');
      if (accountsWithoutName.length > 0) {
        issues.push({
          type: 'ACCOUNT_NO_NAME',
          severity: 'warning',
          message: `${accountsWithoutName.length} conta(s) sem nome`,
          details: { ids: accountsWithoutName.map(a => a.id) }
        });
      }

      // Verificar saldos negativos em contas que não permitem
      // Usando utilitário centralizado para comparação robusta de tipos
      const invalidNegativeBalances = accounts.filter(a => 
        !isCreditCard(a.type) && 
        a.balance < 0
      );
      if (invalidNegativeBalances.length > 0) {
        issues.push({
          type: 'ACCOUNT_NEGATIVE_BALANCE',
          severity: 'error',
          message: `${invalidNegativeBalances.length} conta(s) com saldo negativo inválido`,
          details: { accounts: invalidNegativeBalances.map(a => ({ id: a.id, name: a.name, balance: a.balance })) }
        });
      }

      // Verificar limites de cartão de crédito
      const creditCardsWithoutLimit = accounts.filter(a => 
        isCreditCard(a.type) && 
        (!a.limit || a.limit <= 0)
      );
      if (creditCardsWithoutLimit.length > 0) {
        issues.push({
          type: 'CREDIT_CARD_NO_LIMIT',
          severity: 'warning',
          message: `${creditCardsWithoutLimit.length} cartão(ões) de crédito sem limite definido`,
          details: { cards: creditCardsWithoutLimit.map(a => ({ id: a.id, name: a.name })) }
        });
      }

    } catch (error) {
      issues.push({
        type: 'ACCOUNT_CHECK_ERROR',
        severity: 'error',
        message: `Erro ao verificar contas: ${error}`,
      });
    }

    return issues;
  }

  /**
   * Verifica integridade das transações
   */
  private static async checkTransactions(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    try {
      const transactions = await supabaseService.getAll<Transaction>('transactions');

      // Verificar transações sem conta (exceto compartilhadas pendentes)
      const transactionsWithoutAccount = transactions.filter(t => 
        !t.deleted && 
        !t.accountId && 
        t.type !== TransactionType.TRANSFER &&
        !t.isShared && // Compartilhadas podem não ter conta inicialmente
        (!t.payerId || t.payerId === 'me') // Dívidas de outros não precisam de conta
      );
      if (transactionsWithoutAccount.length > 0) {
        issues.push({
          type: 'TRANSACTION_NO_ACCOUNT',
          severity: 'error',
          message: `${transactionsWithoutAccount.length} transação(ões) sem conta de origem`,
          details: { transactions: transactionsWithoutAccount.map(t => ({ id: t.id, description: t.description })) }
        });
      }

      // Verificar transferências sem destino
      const transfersWithoutDestination = transactions.filter(t => 
        !t.deleted && 
        t.type === TransactionType.TRANSFER && 
        !t.destinationAccountId
      );
      if (transfersWithoutDestination.length > 0) {
        issues.push({
          type: 'TRANSFER_NO_DESTINATION',
          severity: 'error',
          message: `${transfersWithoutDestination.length} transferência(s) sem conta de destino`,
          details: { transfers: transfersWithoutDestination.map(t => ({ id: t.id, description: t.description })) }
        });
      }

      // Verificar valores inválidos
      const invalidAmounts = transactions.filter(t => 
        !t.deleted && 
        (!t.amount || t.amount <= 0)
      );
      if (invalidAmounts.length > 0) {
        issues.push({
          type: 'TRANSACTION_INVALID_AMOUNT',
          severity: 'error',
          message: `${invalidAmounts.length} transação(ões) com valor inválido`,
          details: { transactions: invalidAmounts.map(t => ({ id: t.id, description: t.description, amount: t.amount })) }
        });
      }

      // Verificar transferências circulares
      const circularTransfers = transactions.filter(t => 
        !t.deleted && 
        t.type === TransactionType.TRANSFER && 
        t.accountId === t.destinationAccountId
      );
      if (circularTransfers.length > 0) {
        issues.push({
          type: 'CIRCULAR_TRANSFER',
          severity: 'error',
          message: `${circularTransfers.length} transferência(s) circular(es) (origem = destino)`,
          details: { transfers: circularTransfers.map(t => ({ id: t.id, description: t.description })) }
        });
      }

    } catch (error) {
      issues.push({
        type: 'TRANSACTION_CHECK_ERROR',
        severity: 'error',
        message: `Erro ao verificar transações: ${error}`,
      });
    }

    return issues;
  }

  /**
   * Verifica integridade dos splits
   */
  private static async checkSplits(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    try {
      const transactions = await supabaseService.getAll<Transaction>('transactions');
      const sharedTransactions = transactions.filter(t => 
        !t.deleted && 
        t.isShared && 
        t.sharedWith && 
        t.sharedWith.length > 0
      );

      for (const tx of sharedTransactions) {
        if (!tx.sharedWith || tx.sharedWith.length === 0) continue;

        const splitSum = FinancialPrecision.sum(
          tx.sharedWith.map(s => s.assignedAmount || 0)
        );
        const difference = Math.abs(FinancialPrecision.subtract(splitSum, tx.amount));

        // Tolerância de 1 centavo
        if (difference > 0.01) {
          issues.push({
            type: 'SPLIT_SUM_MISMATCH',
            severity: 'error',
            message: `Split não soma o total da transação`,
            entityId: tx.id,
            details: {
              transactionId: tx.id,
              description: tx.description,
              total: tx.amount,
              splitSum: splitSum,
              difference: difference
            }
          });
        }

        // Verificar valores negativos ou zero
        const invalidSplits = tx.sharedWith.filter(s => 
          !s.assignedAmount || s.assignedAmount <= 0
        );
        if (invalidSplits.length > 0) {
          issues.push({
            type: 'SPLIT_INVALID_AMOUNT',
            severity: 'error',
            message: `Split(s) com valor inválido`,
            entityId: tx.id,
            details: {
              transactionId: tx.id,
              description: tx.description,
              invalidSplits: invalidSplits.length
            }
          });
        }
      }

    } catch (error) {
      issues.push({
        type: 'SPLIT_CHECK_ERROR',
        severity: 'error',
        message: `Erro ao verificar splits: ${error}`,
      });
    }

    return issues;
  }

  /**
   * Verifica integridade dos saldos
   */
  private static async checkBalances(): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    try {
      // Usar a view de saúde do sistema se disponível
      const { data, error } = await supabase
        .from('view_system_health')
        .select('*');

      if (error) {
        // Se a view não existir, fazer verificação manual básica
        const accounts = await supabaseService.getAccounts();
        const transactions = await supabaseService.getAll<Transaction>('transactions');

        // Verificação básica: contas com saldo muito negativo (possível erro)
        const suspiciousBalances = accounts.filter(a => 
          a.balance < -1000000 // Saldo muito negativo pode indicar erro
        );
        if (suspiciousBalances.length > 0) {
          issues.push({
            type: 'SUSPICIOUS_BALANCE',
            severity: 'warning',
            message: `${suspiciousBalances.length} conta(s) com saldo suspeito`,
            details: { accounts: suspiciousBalances.map(a => ({ id: a.id, name: a.name, balance: a.balance })) }
          });
        }
      } else if (data) {
        // Processar resultados da view
        data.forEach((row: { issue_type: string; count: number; description: string }) => {
          if (row.count > 0) {
            issues.push({
              type: row.issue_type,
              severity: row.count > 10 ? 'error' : 'warning',
              message: row.description,
              details: { count: row.count }
            });
          }
        });
      }

    } catch (error) {
      issues.push({
        type: 'BALANCE_CHECK_ERROR',
        severity: 'error',
        message: `Erro ao verificar saldos: ${error}`,
      });
    }

    return issues;
  }

  /**
   * Formata issues para exibição
   */
  static formatIssues(issues: IntegrityIssue[]): string {
    if (issues.length === 0) {
      return '✅ Nenhum problema encontrado!';
    }

    const errors = issues.filter(i => i.severity === 'error');
    const warnings = issues.filter(i => i.severity === 'warning');
    const infos = issues.filter(i => i.severity === 'info');

    let message = `\n📊 RESULTADO DA VERIFICAÇÃO:\n`;
    message += `   ❌ Erros: ${errors.length}\n`;
    message += `   ⚠️  Avisos: ${warnings.length}\n`;
    message += `   ℹ️  Informações: ${infos.length}\n\n`;

    if (errors.length > 0) {
      message += `❌ ERROS CRÍTICOS:\n`;
      errors.forEach(issue => {
        message += `   • ${issue.message}\n`;
        if (issue.details) {
          message += `     Detalhes: ${JSON.stringify(issue.details)}\n`;
        }
      });
      message += `\n`;
    }

    if (warnings.length > 0) {
      message += `⚠️  AVISOS:\n`;
      warnings.forEach(issue => {
        message += `   • ${issue.message}\n`;
      });
      message += `\n`;
    }

    return message;
  }
}

