/**
 * RecoveryRegistry - Gerencia registros de recuperação para transações compartilhadas
 * 
 * Este serviço cria, obtém e limpa registros de recuperação que permitem
 * restaurar transações compartilhadas após um factory reset.
 */

import { supabase } from '../../integrations/supabase/client'
import type { SharedTransaction } from './SharedTransactionDetector'

export interface RecoveryRecord {
  id: string
  userId: string
  originalTransactionId: string
  transactionType: string
  metadata: Record<string, any>
  createdAt: string
  isValid: boolean
  canRestore: boolean
}

export interface RecoveryRecordCreation {
  originalTransactionId: string
  transactionType: string
  metadata: Record<string, any>
}

export class RecoveryRegistry {
  /**
   * Cria registros de recuperação para transações compartilhadas
   * Requirement 3.1: Criar um registro de recuperação com ID da transação original
   * Requirement 3.2: Armazenar o ID do usuário original
   * Requirement 3.3: Armazenar metadados da transação (tipo, valor, data)
   */
  async createRecoveryRecords(userId: string, transactions: SharedTransaction[]): Promise<void> {
    try {
      // Preparar dados para a função RPC
      const sharedTransactionsData = transactions.map(transaction => ({
        transaction_id: transaction.id,
        transaction_type: transaction.type,
        metadata: {
          ...transaction.metadata,
          amount: transaction.amount,
          description: transaction.description,
          created_date: transaction.createdDate,
          original_owner_id: transaction.originalOwnerId
        }
      }))

      const { error } = await supabase.rpc('create_recovery_records', {
        target_user_id: userId,
        shared_transactions: sharedTransactionsData
      })

      if (error) {
        console.error('Erro ao criar registros de recuperação:', error)
        throw new Error(`Falha na criação de registros de recuperação: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro no RecoveryRegistry.createRecoveryRecords:', error)
      throw error
    }
  }

  /**
   * Obtém registros de recuperação disponíveis para o usuário
   * Requirement 4.1: Verificar se existem dados recuperáveis
   */
  async getRecoveryRecords(userId: string): Promise<RecoveryRecord[]> {
    try {
      const { data, error } = await supabase.rpc('get_recovery_records', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro ao obter registros de recuperação:', error)
        throw new Error(`Falha ao obter registros de recuperação: ${error.message}`)
      }

      if (!data) {
        return []
      }

      return data.map((record: any) => ({
        id: record.record_id,
        userId: userId,
        originalTransactionId: record.original_transaction_id,
        transactionType: record.transaction_type,
        metadata: record.metadata || {},
        createdAt: record.created_at,
        isValid: record.is_valid,
        canRestore: record.can_restore
      }))
    } catch (error) {
      console.error('Erro no RecoveryRegistry.getRecoveryRecords:', error)
      throw error
    }
  }

  /**
   * Remove registros de recuperação específicos ou todos
   * Requirement 4.5: Apagar permanentemente os registros de recuperação
   */
  async clearRecoveryRecords(userId: string, recordIds?: string[]): Promise<number> {
    try {
      const { data, error } = await supabase.rpc('clear_recovery_records', {
        target_user_id: userId,
        record_ids: recordIds || null
      })

      if (error) {
        console.error('Erro ao limpar registros de recuperação:', error)
        throw new Error(`Falha na limpeza de registros de recuperação: ${error.message}`)
      }

      return data || 0
    } catch (error) {
      console.error('Erro no RecoveryRegistry.clearRecoveryRecords:', error)
      throw error
    }
  }

  /**
   * Verifica se há registros de recuperação disponíveis
   * Usado no login para determinar se deve mostrar popup de recuperação
   */
  async hasRecoverableData(userId: string): Promise<boolean> {
    try {
      const records = await this.getRecoveryRecords(userId)
      return records.length > 0 && records.some(r => r.canRestore)
    } catch (error) {
      console.error('Erro ao verificar dados recuperáveis:', error)
      return false
    }
  }

  /**
   * Filtra registros que podem ser restaurados
   * Usado na interface de recuperação
   */
  getRestorableRecords(records: RecoveryRecord[]): RecoveryRecord[] {
    return records.filter(record => record.isValid && record.canRestore)
  }

  /**
   * Agrupa registros por tipo de transação
   * Usado na interface de recuperação para organização
   */
  groupRecordsByType(records: RecoveryRecord[]): Record<string, RecoveryRecord[]> {
    return records.reduce((acc, record) => {
      const type = record.transactionType
      if (!acc[type]) {
        acc[type] = []
      }
      acc[type].push(record)
      return acc
    }, {} as Record<string, RecoveryRecord[]>)
  }

  /**
   * Calcula estatísticas dos registros de recuperação
   * Usado no popup de recuperação
   */
  calculateRecoveryStats(records: RecoveryRecord[]): {
    total: number
    restorable: number
    byType: Record<string, number>
    totalAmount: number
  } {
    const restorable = records.filter(r => r.canRestore)
    
    const byType = records.reduce((acc, record) => {
      acc[record.transactionType] = (acc[record.transactionType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const totalAmount = records.reduce((total, record) => {
      const amount = record.metadata?.amount || 0
      return total + parseFloat(amount.toString())
    }, 0)

    return {
      total: records.length,
      restorable: restorable.length,
      byType,
      totalAmount
    }
  }

  /**
   * Converte registros para formato de exibição
   * Usado nos componentes de UI
   */
  formatRecordsForDisplay(records: RecoveryRecord[]): Array<{
    id: string
    type: string
    description: string
    amount: number
    date: string
    originalOwner: string
    canRestore: boolean
  }> {
    return records.map(record => ({
      id: record.id,
      type: record.transactionType,
      description: record.metadata?.description || 'Sem descrição',
      amount: parseFloat(record.metadata?.amount?.toString() || '0'),
      date: record.metadata?.created_date || record.createdAt,
      originalOwner: record.metadata?.original_owner_id || 'Desconhecido',
      canRestore: record.canRestore
    }))
  }
}

export const recoveryRegistry = new RecoveryRegistry()