/**
 * DataCleanupEngine - Executa limpeza completa dos dados do usuário
 * 
 * Este serviço remove todos os dados pessoais do usuário durante o factory reset,
 * mantendo apenas as credenciais de autenticação.
 */

import { supabase } from '../../integrations/supabase/client'

export interface CleanupResult {
  transactionsRemoved: number
  accountsRemoved: number
  investmentsRemoved: number
  budgetsRemoved: number
  settingsReset: boolean
  sharedRequestsDeleted: number
  mirrorsDeleted: number
  sharedParticipationRemoved: number
  executionTimeMs: number
  errors: string[]
  success: boolean
}

export interface CleanupSummary {
  personalTransactions: number
  accounts: number
  investments: number
  budgetsAndGoals: number
  estimatedExecutionTime: number
}

export class DataCleanupEngine {
  /**
   * Remove todos os dados pessoais do usuário
   * Requirement 1.1-1.6: Apagar todos os dados pessoais mantendo apenas autenticação
   * CORRIGIDO: Agora deleta TODAS as transações relacionadas (próprias, espelhos, compartilhadas)
   */
  async cleanupUserData(userId: string): Promise<CleanupResult> {
    try {
      // Usar a função v2 corrigida que deleta TODAS as transações relacionadas
      const { data, error } = await supabase.rpc('execute_factory_reset_complete_v2', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro na limpeza de dados:', error)
        throw new Error(`Falha na limpeza de dados: ${error.message}`)
      }

      return {
        transactionsRemoved: (data.transactions_deleted || 0) + (data.mirror_transactions_deleted || 0),
        accountsRemoved: data.accounts_deleted || 0,
        investmentsRemoved: data.investments_deleted || 0,
        budgetsRemoved: data.budgets_deleted || 0,
        settingsReset: true,
        sharedRequestsDeleted: data.shared_requests_deleted || 0,
        mirrorsDeleted: data.mirrors_deleted || 0,
        sharedParticipationRemoved: data.shared_participation_removed || 0,
        executionTimeMs: data.execution_time_ms || 0,
        errors: [],
        success: data.success || false
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.cleanupUserData:', error)
      return {
        transactionsRemoved: 0,
        accountsRemoved: 0,
        investmentsRemoved: 0,
        budgetsRemoved: 0,
        settingsReset: false,
        sharedRequestsDeleted: 0,
        mirrorsDeleted: 0,
        sharedParticipationRemoved: 0,
        executionTimeMs: 0,
        errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
        success: false
      }
    }
  }



  /**
   * Diagnostica problemas específicos do factory reset
   * NOVO: Função para identificar exatamente qual é o problema
   */
  async diagnoseFactoryResetIssue(userId: string): Promise<any> {
    try {
      const { data, error } = await supabase.rpc('diagnose_factory_reset_issue_v2', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro no diagnóstico:', error)
        throw new Error(`Falha no diagnóstico: ${error.message}`)
      }

      return data
    } catch (error) {
      console.error('Erro no DataCleanupEngine.diagnoseFactoryResetIssue:', error)
      throw error
    }
  }
  async getCleanupSummary(userId: string): Promise<CleanupSummary> {
    try {
      // Usar função de diagnóstico para obter contadores
      const { data, error } = await supabase.rpc('diagnose_user_data', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro ao obter resumo de limpeza:', error)
        throw new Error(`Falha ao obter resumo: ${error.message}`)
      }

      return {
        personalTransactions: (data.own_transactions || 0) + (data.shared_as_creator || 0) + (data.mirror_transactions || 0),
        accounts: data.accounts_count || 0,
        investments: 0, // Assumindo 0 por enquanto
        budgetsAndGoals: 0, // Assumindo 0 por enquanto
        estimatedExecutionTime: this.estimateExecutionTime(data)
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.getCleanupSummary:', error)
      return {
        personalTransactions: 0,
        accounts: 0,
        investments: 0,
        budgetsAndGoals: 0,
        estimatedExecutionTime: 1000
      }
    }
  }

  /**
   * Verifica se a limpeza foi completa
   * Usado após o factory reset para validação
   */
  async verifyCleanupCompleteness(userId: string): Promise<{
    isComplete: boolean
    remainingData: Record<string, number>
    details: any
  }> {
    try {
      const { data, error } = await supabase.rpc('verify_factory_reset_completeness_v2', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro na verificação de completude:', error)
        throw new Error(`Falha na verificação: ${error.message}`)
      }

      return {
        isComplete: data.is_complete || false,
        remainingData: {
          transactions: data.remaining_transactions || 0,
          accounts: data.remaining_accounts || 0,
          sharedRequests: data.remaining_shared_requests || 0,
          mirrors: data.remaining_mirrors || 0
        },
        details: data
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.verifyCleanupCompleteness:', error)
      return {
        isComplete: false,
        remainingData: {},
        details: null
      }
    }
  }

  /**
   * Remove dados específicos por categoria (métodos individuais)
   * Requirement 1.1: Apagar todas as transações pessoais do usuário
   */
  async cleanupTransactions(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Erro ao limpar transações: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.cleanupTransactions:', error)
      throw error
    }
  }

  /**
   * Requirement 1.2: Apagar todas as contas do usuário
   */
  async cleanupAccounts(userId: string): Promise<void> {
    try {
      const { error } = await supabase
        .from('accounts')
        .delete()
        .eq('user_id', userId)

      if (error) {
        throw new Error(`Erro ao limpar contas: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.cleanupAccounts:', error)
      throw error
    }
  }

  /**
   * Requirement 1.3: Apagar todos os investimentos do usuário
   */
  async cleanupInvestments(userId: string): Promise<void> {
    try {
      // Assumindo que existe tabela investments
      const { error } = await supabase
        .from('investments')
        .delete()
        .eq('user_id', userId)

      if (error && !error.message.includes('relation "investments" does not exist')) {
        throw new Error(`Erro ao limpar investimentos: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.cleanupInvestments:', error)
      // Não falhar se a tabela não existir
    }
  }

  /**
   * Requirement 1.4: Apagar todas as metas e orçamentos do usuário
   */
  async cleanupBudgetsAndGoals(userId: string): Promise<void> {
    try {
      // Assumindo que existe tabela budgets
      const { error } = await supabase
        .from('budgets')
        .delete()
        .eq('user_id', userId)

      if (error && !error.message.includes('relation "budgets" does not exist')) {
        throw new Error(`Erro ao limpar orçamentos: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.cleanupBudgetsAndGoals:', error)
      // Não falhar se a tabela não existir
    }
  }

  /**
   * Requirement 1.5: Apagar todas as configurações personalizadas do usuário
   */
  async cleanupSettings(userId: string): Promise<void> {
    try {
      // Assumindo que existe tabela user_settings
      const { error } = await supabase
        .from('user_settings')
        .delete()
        .eq('user_id', userId)

      if (error && !error.message.includes('relation "user_settings" does not exist')) {
        throw new Error(`Erro ao limpar configurações: ${error.message}`)
      }
    } catch (error) {
      console.error('Erro no DataCleanupEngine.cleanupSettings:', error)
      // Não falhar se a tabela não existir
    }
  }

  /**
   * Estima tempo de execução baseado na quantidade de dados
   */
  private estimateExecutionTime(diagnosticData: any): number {
    const totalItems = (diagnosticData.own_transactions || 0) +
                      (diagnosticData.shared_as_creator || 0) +
                      (diagnosticData.mirror_transactions || 0) +
                      (diagnosticData.accounts_count || 0)

    // Estimativa: ~50ms por item + overhead de 500ms
    return Math.max(500, totalItems * 50)
  }

  /**
   * Obtém transações visíveis no fluxo de caixa
   * Usado para diagnóstico de problemas
   */
  async getUserVisibleTransactions(userId: string): Promise<Array<{
    transactionId: string
    amount: number
    description: string
    createdAt: string
    isShared: boolean
    isMirror: boolean
    deleted: boolean
    source: string
  }>> {
    try {
      const { data, error } = await supabase.rpc('get_user_visible_transactions', {
        target_user_id: userId
      })

      if (error) {
        console.error('Erro ao obter transações visíveis:', error)
        return []
      }

      return data || []
    } catch (error) {
      console.error('Erro no DataCleanupEngine.getUserVisibleTransactions:', error)
      return []
    }
  }
}

export const dataCleanupEngine = new DataCleanupEngine()