/**
 * RecoveryDetectionService - Detecta dados recuperáveis no login
 * 
 * Este serviço verifica se há dados recuperáveis quando o usuário faz login
 * após um factory reset, validando a integridade dos registros.
 */

import { recoveryRegistry, type RecoveryRecord } from './RecoveryRegistry'

export interface RecoveryAvailability {
  hasRecoverableData: boolean
  recordCount: number
  records: RecoveryRecord[]
  statistics: {
    totalAmount: number
    byType: Record<string, number>
    oldestRecord: string | null
    newestRecord: string | null
  }
}

export class RecoveryDetectionService {
  /**
   * Verifica se há dados recuperáveis no login
   * Requirement 4.1: Verificar se existem dados recuperáveis
   */
  async checkRecoverableData(userId: string): Promise<RecoveryAvailability> {
    try {
      // Obter todos os registros de recuperação
      const allRecords = await recoveryRegistry.getRecoveryRecords(userId)
      
      // Validar registros antes de retornar
      const validRecords = await this.validateRecoveryRecords(allRecords)
      
      // Filtrar apenas os que podem ser restaurados
      const restorableRecords = recoveryRegistry.getRestorableRecords(validRecords)
      
      // Calcular estatísticas
      const statistics = this.calculateStatistics(restorableRecords)

      return {
        hasRecoverableData: restorableRecords.length > 0,
        recordCount: restorableRecords.length,
        records: restorableRecords,
        statistics
      }
    } catch (error) {
      console.error('Erro no RecoveryDetectionService.checkRecoverableData:', error)
      return {
        hasRecoverableData: false,
        recordCount: 0,
        records: [],
        statistics: {
          totalAmount: 0,
          byType: {},
          oldestRecord: null,
          newestRecord: null
        }
      }
    }
  }

  /**
   * Valida registros de recuperação antes de exibir
   * Requirement 5.1: Verificar se a transação original ainda existe
   * Requirement 5.2: Verificar se o usuário original ainda tem acesso à transação
   */
  async validateRecoveryRecords(records: RecoveryRecord[]): Promise<RecoveryRecord[]> {
    const validatedRecords: RecoveryRecord[] = []
    const invalidRecordIds: string[] = []

    for (const record of records) {
      try {
        // Verificar se ainda pode ser restaurado (a função RPC já faz essa validação)
        if (record.canRestore && record.isValid) {
          validatedRecords.push(record)
        } else {
          invalidRecordIds.push(record.id)
        }
      } catch (error) {
        console.error(`Erro ao validar registro ${record.id}:`, error)
        invalidRecordIds.push(record.id)
      }
    }

    // Limpar registros inválidos automaticamente
    if (invalidRecordIds.length > 0) {
      try {
        await recoveryRegistry.clearRecoveryRecords(records[0]?.userId, invalidRecordIds)
        console.log(`Removidos ${invalidRecordIds.length} registros inválidos`)
      } catch (error) {
        console.error('Erro ao limpar registros inválidos:', error)
      }
    }

    return validatedRecords
  }

  /**
   * Verifica se deve mostrar popup de recuperação
   * Usado no fluxo de login
   */
  async shouldShowRecoveryPopup(userId: string): Promise<boolean> {
    try {
      const availability = await this.checkRecoverableData(userId)
      return availability.hasRecoverableData && availability.recordCount > 0
    } catch (error) {
      console.error('Erro ao verificar se deve mostrar popup:', error)
      return false
    }
  }

  /**
   * Obtém resumo rápido para notificação
   * Usado em notificações ou badges
   */
  async getRecoveryNotificationSummary(userId: string): Promise<{
    count: number
    totalAmount: number
    hasTrips: boolean
    hasSharedExpenses: boolean
  } | null> {
    try {
      const availability = await this.checkRecoverableData(userId)
      
      if (!availability.hasRecoverableData) {
        return null
      }

      return {
        count: availability.recordCount,
        totalAmount: availability.statistics.totalAmount,
        hasTrips: (availability.statistics.byType['trip'] || 0) > 0,
        hasSharedExpenses: (availability.statistics.byType['shared_expense'] || 0) > 0
      }
    } catch (error) {
      console.error('Erro ao obter resumo de notificação:', error)
      return null
    }
  }

  /**
   * Agrupa registros por prioridade de recuperação
   * Usado na interface para organizar por importância
   */
  prioritizeRecoveryRecords(records: RecoveryRecord[]): {
    highPriority: RecoveryRecord[]
    mediumPriority: RecoveryRecord[]
    lowPriority: RecoveryRecord[]
  } {
    const highPriority: RecoveryRecord[] = []
    const mediumPriority: RecoveryRecord[] = []
    const lowPriority: RecoveryRecord[] = []

    records.forEach(record => {
      const amount = parseFloat(record.metadata?.amount?.toString() || '0')
      const type = record.transactionType

      if (type === 'trip' || amount > 1000) {
        highPriority.push(record)
      } else if (amount > 100) {
        mediumPriority.push(record)
      } else {
        lowPriority.push(record)
      }
    })

    return { highPriority, mediumPriority, lowPriority }
  }

  /**
   * Calcula estatísticas dos registros
   */
  private calculateStatistics(records: RecoveryRecord[]): {
    totalAmount: number
    byType: Record<string, number>
    oldestRecord: string | null
    newestRecord: string | null
  } {
    if (records.length === 0) {
      return {
        totalAmount: 0,
        byType: {},
        oldestRecord: null,
        newestRecord: null
      }
    }

    const totalAmount = records.reduce((total, record) => {
      const amount = parseFloat(record.metadata?.amount?.toString() || '0')
      return total + amount
    }, 0)

    const byType = records.reduce((acc, record) => {
      acc[record.transactionType] = (acc[record.transactionType] || 0) + 1
      return acc
    }, {} as Record<string, number>)

    const sortedByDate = records.sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    return {
      totalAmount,
      byType,
      oldestRecord: sortedByDate[0]?.createdAt || null,
      newestRecord: sortedByDate[sortedByDate.length - 1]?.createdAt || null
    }
  }

  /**
   * Formata dados para exibição no popup
   * Usado nos componentes de UI
   */
  formatForPopupDisplay(availability: RecoveryAvailability): {
    title: string
    subtitle: string
    items: Array<{
      id: string
      title: string
      subtitle: string
      amount: string
      type: string
      canRestore: boolean
    }>
    summary: {
      totalItems: number
      totalAmount: string
      types: string[]
    }
  } {
    const { records, statistics } = availability

    const title = `${records.length} transação${records.length !== 1 ? 'ões' : ''} recuperável${records.length !== 1 ? 'eis' : ''}`
    const subtitle = `Total: R$ ${statistics.totalAmount.toFixed(2)}`

    const items = records.map(record => ({
      id: record.id,
      title: record.metadata?.description || 'Sem descrição',
      subtitle: new Date(record.metadata?.created_date || record.createdAt).toLocaleDateString('pt-BR'),
      amount: `R$ ${parseFloat(record.metadata?.amount?.toString() || '0').toFixed(2)}`,
      type: record.transactionType,
      canRestore: record.canRestore
    }))

    const types = Object.keys(statistics.byType).map(type => {
      const count = statistics.byType[type]
      const typeLabel = type === 'trip' ? 'viagem' : 'despesa compartilhada'
      return `${count} ${typeLabel}${count !== 1 ? 's' : ''}`
    })

    return {
      title,
      subtitle,
      items,
      summary: {
        totalItems: records.length,
        totalAmount: `R$ ${statistics.totalAmount.toFixed(2)}`,
        types
      }
    }
  }
}

export const recoveryDetectionService = new RecoveryDetectionService()