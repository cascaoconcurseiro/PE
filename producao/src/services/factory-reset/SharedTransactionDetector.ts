/**
 * SharedTransactionDetector - Detecta transações compartilhadas antes do factory reset
 * 
 * Este serviço identifica transações compartilhadas (viagens, despesas compartilhadas)
 * que podem ser recuperadas após um factory reset, verificando se ainda existem
 * nos usuários originais.
 */

import { supabase } from '../../integrations/supabase/client'

export interface SharedTransaction {
  id: string
  type: 'trip' | 'shared_expense' | 'other'
  originalOwnerId: string
  amount: number
  description: string
  createdDate: string
  canRecover: boolean
  metadata: {
    category?: string
    subcategory?: string
    account_id?: string
    payer_id?: string
    domain?: string
  }
}

export interface SharedTransactionSummary {
  id: string
  type: 'trip' | 'shared_expense'
  amount: number
  date: string
  originalOwner: string
  canRecover: boolean
}

export class SharedTransactionDetector {
  /**
   * Detecta todas as transações compartilhadas do usuário
   * Requirement 2.1: Identificar todas as transações compartilhadas do usuário
   */
  async detectSharedTransactions(userId: string): Promise<SharedTransaction[]> {
    try {
      const { data, error } = await supabase.rpc('detect_shared_transactions', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro ao detectar transações compartilhadas:', error)
        throw new Error(`Falha na detecção de transações compartilhadas: ${error.message}`)
      }

      if (!data) {
        return []
      }

      return data.map((item: any) => ({
        id: item.transaction_id,
        type: item.transaction_type as 'trip' | 'shared_expense' | 'other',
        originalOwnerId: item.original_owner_id,
        amount: parseFloat(item.amount),
        description: item.description || '',
        createdDate: item.created_date,
        canRecover: item.can_recover,
        metadata: item.metadata || {}
      }))
    } catch (error) {
      console.error('Erro no SharedTransactionDetector.detectSharedTransactions:', error)
      throw error
    }
  }

  /**
   * Verifica se uma transação compartilhada específica ainda é válida
   * Requirement 2.2: Verificar se ainda existem nos usuários originais
   */
  async validateSharedTransaction(transactionId: string): Promise<boolean> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('id, user_id, deleted')
        .eq('id', transactionId)
        .eq('deleted', false)
        .single()

      if (error) {
        console.error('Erro ao validar transação compartilhada:', error)
        return false
      }

      return !!data
    } catch (error) {
      console.error('Erro no SharedTransactionDetector.validateSharedTransaction:', error)
      return false
    }
  }

  /**
   * Identifica o proprietário original da transação
   * Requirement 2.2: Verificar se ainda existem nos usuários originais
   */
  async getOriginalOwner(transactionId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('user_id')
        .eq('id', transactionId)
        .single()

      if (error) {
        console.error('Erro ao obter proprietário original:', error)
        throw new Error(`Falha ao obter proprietário original: ${error.message}`)
      }

      return data.user_id
    } catch (error) {
      console.error('Erro no SharedTransactionDetector.getOriginalOwner:', error)
      throw error
    }
  }

  /**
   * Converte transações compartilhadas para formato de resumo
   * Usado na interface de confirmação do factory reset
   */
  convertToSummary(transactions: SharedTransaction[]): SharedTransactionSummary[] {
    return transactions
      .filter(t => t.type === 'trip' || t.type === 'shared_expense')
      .map(t => ({
        id: t.id,
        type: t.type as 'trip' | 'shared_expense',
        amount: t.amount,
        date: t.createdDate,
        originalOwner: t.originalOwnerId,
        canRecover: t.canRecover
      }))
  }

  /**
   * Filtra apenas transações que podem ser recuperadas
   * Usado para criar registros de recuperação
   */
  getRecoverableTransactions(transactions: SharedTransaction[]): SharedTransaction[] {
    return transactions.filter(t => t.canRecover)
  }

  /**
   * Agrupa transações por tipo para estatísticas
   * Usado no resumo do factory reset
   */
  groupByType(transactions: SharedTransaction[]): Record<string, number> {
    return transactions.reduce((acc, transaction) => {
      acc[transaction.type] = (acc[transaction.type] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }

  /**
   * Calcula valor total das transações compartilhadas
   * Usado no resumo do factory reset
   */
  calculateTotalAmount(transactions: SharedTransaction[]): number {
    return transactions.reduce((total, transaction) => total + transaction.amount, 0)
  }
}

export const sharedTransactionDetector = new SharedTransactionDetector()