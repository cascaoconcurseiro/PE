/**
 * FactoryResetService - Orquestra o processo completo de factory reset
 * 
 * Este serviço coordena todos os componentes do sistema de factory reset,
 * desde a detecção de transações compartilhadas até a execução da limpeza.
 */

import { supabase } from '../../integrations/supabase/client'
import { sharedTransactionDetector, type SharedTransaction, type SharedTransactionSummary } from './SharedTransactionDetector'
import { recoveryRegistry } from './RecoveryRegistry'
import { dataCleanupEngine, type CleanupResult } from './DataCleanupEngine'
import { sharedDataExitManager, type SharedDataExitResult } from './SharedDataExitManager'

export interface ResetSummary {
  personalTransactions: number
  accounts: number
  investments: number
  budgetsAndGoals: number
  sharedTransactions: SharedTransactionSummary[]
  recoverableItems: number
  estimatedExecutionTime: number
  hasSharedData: boolean
}

export interface ResetConfirmation {
  confirmed: boolean
  preserveSharedTransactions: boolean
  acknowledgeDataLoss: boolean
  userSignature?: string
}

export interface ResetResult {
  success: boolean
  cleanupResult: CleanupResult
  sharedDataExitResult: SharedDataExitResult
  recoveryRecordsCreated: number
  sharedTransactionsPreserved: number
  completionTime: number
  errors: string[]
}

export class FactoryResetService {
  /**
   * Inicia o processo de factory reset obtendo resumo completo
   * Requirement 6.1: Exibir resumo completo do que será apagado
   * Requirement 6.2: Listar quais podem ser recuperadas
   */
  async initiateReset(userId: string): Promise<ResetSummary> {
    try {
      // 1. Detectar transações compartilhadas
      const sharedTransactions = await sharedTransactionDetector.detectSharedTransactions(userId)

      // 2. Obter resumo de limpeza
      const cleanupSummary = await dataCleanupEngine.getCleanupSummary(userId)

      // 3. Converter para formato de resumo
      const sharedSummary = sharedTransactionDetector.convertToSummary(sharedTransactions)
      const recoverableTransactions = sharedTransactionDetector.getRecoverableTransactions(sharedTransactions)

      return {
        personalTransactions: cleanupSummary.personalTransactions,
        accounts: cleanupSummary.accounts,
        investments: cleanupSummary.investments,
        budgetsAndGoals: cleanupSummary.budgetsAndGoals,
        sharedTransactions: sharedSummary,
        recoverableItems: recoverableTransactions.length,
        estimatedExecutionTime: cleanupSummary.estimatedExecutionTime,
        hasSharedData: sharedTransactions.length > 0
      }
    } catch (error) {
      console.error('Erro no FactoryResetService.initiateReset:', error)
      throw new Error(`Falha ao iniciar factory reset: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    }
  }

  /**
   * Executa o factory reset completo com saída automática de dados compartilhados
   * Requirement 6.4: Executar o processo completo quando confirmado
   * Requirement 3.4: Manter apenas os registros de recuperação
   * NOVO: Sair automaticamente de viagens e grupos familiares
   */
  async executeResetWithSharedDataExit(userId: string, confirmation: ResetConfirmation): Promise<ResetResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let recoveryRecordsCreated = 0
    let sharedTransactionsPreserved = 0

    try {
      // Verificar confirmação
      if (!confirmation.confirmed || !confirmation.acknowledgeDataLoss) {
        throw new Error('Confirmação de factory reset não fornecida')
      }

      // 1. NOVO: Sair de todos os dados compartilhados ANTES da limpeza
      const sharedDataExitResult = await sharedDataExitManager.exitAllSharedData(userId)

      if (!sharedDataExitResult.success) {
        errors.push(...sharedDataExitResult.errors)
        console.warn('Alguns erros ocorreram na saída de dados compartilhados:', sharedDataExitResult.errors)
      }

      // 2. Detectar e preservar transações compartilhadas se solicitado
      let sharedTransactions: SharedTransaction[] = []

      if (confirmation.preserveSharedTransactions) {
        try {
          sharedTransactions = await sharedTransactionDetector.detectSharedTransactions(userId)
          const recoverableTransactions = sharedTransactionDetector.getRecoverableTransactions(sharedTransactions)

          if (recoverableTransactions.length > 0) {
            await recoveryRegistry.createRecoveryRecords(userId, recoverableTransactions)
            recoveryRecordsCreated = recoverableTransactions.length
            sharedTransactionsPreserved = recoverableTransactions.length
          }
        } catch (error) {
          console.error('Erro ao preservar transações compartilhadas:', error)
          errors.push(`Falha na preservação de transações compartilhadas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
      }

      // 3. Executar limpeza completa dos dados
      const cleanupResult = await dataCleanupEngine.cleanupUserData(userId)

      if (!cleanupResult.success) {
        errors.push(...cleanupResult.errors)
      }

      // 4. Verificar se a limpeza foi completa
      const verification = await dataCleanupEngine.verifyCleanupCompleteness(userId)

      if (!verification.isComplete) {
        errors.push('Factory reset não foi completamente executado - alguns dados podem ter permanecido')
        console.warn('Factory reset incompleto:', verification.remainingData)
      }

      const completionTime = Date.now() - startTime

      const isSuccess = cleanupResult.success && verification.isComplete && sharedDataExitResult.success;

      // 🔧 FIX: Limpar TODOS os caches após factory reset bem-sucedido
      if (isSuccess) {
        try {
          // 1. Limpar localStorage (cache de dados, configurações, etc.)
          localStorage.clear();

          // 2. Limpar sessionStorage (cache temporário)
          sessionStorage.clear();

          // 3. Limpar cache do service worker se disponível
          if ('serviceWorker' in navigator && 'caches' in window) {
            caches.keys().then(cacheNames => {
              cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
              });
            }).catch(e => console.warn('Erro ao limpar cache do service worker:', e));
          }

          console.log('✅ Factory reset completo - todos os caches limpos');

          // 4. Forçar reload completo da aplicação após um pequeno delay
          setTimeout(() => {
            window.location.href = window.location.origin; // Força navegação completa
          }, 500);

        } catch (error) {
          console.warn('Erro ao limpar caches locais:', error);
          // Não falhar o factory reset por causa de erro de cache
        }
      }

      return {
        success: isSuccess,
        cleanupResult,
        sharedDataExitResult,
        recoveryRecordsCreated,
        sharedTransactionsPreserved,
        completionTime,
        errors
      }
    } catch (error) {
      console.error('Erro no FactoryResetService.executeResetWithSharedDataExit:', error)
      const completionTime = Date.now() - startTime

      return {
        success: false,
        cleanupResult: {
          transactionsRemoved: 0,
          accountsRemoved: 0,
          investmentsRemoved: 0,
          budgetsRemoved: 0,
          settingsReset: false,
          sharedRequestsDeleted: 0,
          mirrorsDeleted: 0,
          executionTimeMs: completionTime,
          errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
          success: false,
          sharedParticipationRemoved: 0
        },
        sharedDataExitResult: {
          success: false,
          tripsExited: 0,
          familyGroupsExited: 0,
          notificationsSent: 0,
          errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
          exitedData: { trips: [], familyGroups: [] }
        },
        recoveryRecordsCreated,
        sharedTransactionsPreserved,
        completionTime,
        errors: [...errors, error instanceof Error ? error.message : 'Erro desconhecido']
      }
    }
  }

  /**
   * Executa o factory reset completo
   * Requirement 6.4: Executar o processo completo quando confirmado
   * Requirement 3.4: Manter apenas os registros de recuperação
   */
  async executeReset(userId: string, confirmation: ResetConfirmation): Promise<ResetResult> {
    const startTime = Date.now()
    const errors: string[] = []
    let recoveryRecordsCreated = 0
    let sharedTransactionsPreserved = 0

    try {
      // Verificar confirmação
      if (!confirmation.confirmed || !confirmation.acknowledgeDataLoss) {
        throw new Error('Confirmação de factory reset não fornecida')
      }

      // 1. Detectar e preservar transações compartilhadas se solicitado
      let sharedTransactions: SharedTransaction[] = []

      if (confirmation.preserveSharedTransactions) {
        try {
          sharedTransactions = await sharedTransactionDetector.detectSharedTransactions(userId)
          const recoverableTransactions = sharedTransactionDetector.getRecoverableTransactions(sharedTransactions)

          if (recoverableTransactions.length > 0) {
            await recoveryRegistry.createRecoveryRecords(userId, recoverableTransactions)
            recoveryRecordsCreated = recoverableTransactions.length
            sharedTransactionsPreserved = recoverableTransactions.length
          }
        } catch (error) {
          console.error('Erro ao preservar transações compartilhadas:', error)
          errors.push(`Falha na preservação de transações compartilhadas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
        }
      }

      // 2. Executar limpeza completa dos dados
      const cleanupResult = await dataCleanupEngine.cleanupUserData(userId)

      if (!cleanupResult.success) {
        errors.push(...cleanupResult.errors)
      }

      // 3. Verificar se a limpeza foi completa
      const verification = await dataCleanupEngine.verifyCleanupCompleteness(userId)

      if (!verification.isComplete) {
        errors.push('Factory reset não foi completamente executado - alguns dados podem ter permanecido')
        console.warn('Factory reset incompleto:', verification.remainingData)
      }

      const completionTime = Date.now() - startTime

      const isSuccess = cleanupResult.success && verification.isComplete;

      // 🔧 FIX: Limpar TODOS os caches após factory reset bem-sucedido
      if (isSuccess) {
        try {
          // 1. Limpar localStorage (cache de dados, configurações, etc.)
          localStorage.clear();

          // 2. Limpar sessionStorage (cache temporário)
          sessionStorage.clear();

          // 3. Limpar cache do service worker se disponível
          if ('serviceWorker' in navigator && 'caches' in window) {
            caches.keys().then(cacheNames => {
              cacheNames.forEach(cacheName => {
                caches.delete(cacheName);
              });
            }).catch(e => console.warn('Erro ao limpar cache do service worker:', e));
          }

          console.log('✅ Factory reset completo - todos os caches limpos');

          // 4. Forçar reload completo da aplicação após um pequeno delay
          setTimeout(() => {
            window.location.href = window.location.origin; // Força navegação completa
          }, 500);

        } catch (error) {
          console.warn('Erro ao limpar caches locais:', error);
          // Não falhar o factory reset por causa de erro de cache
        }
      }

      return {
        success: isSuccess,
        cleanupResult,
        recoveryRecordsCreated,
        sharedTransactionsPreserved,
        completionTime,
        sharedDataExitResult: {
          success: true,
          tripsExited: 0,
          familyGroupsExited: 0,
          notificationsSent: 0,
          errors: [],
          exitedData: { trips: [], familyGroups: [] }
        },
        errors
      }
    } catch (error) {
      console.error('Erro no FactoryResetService.executeReset:', error)
      const completionTime = Date.now() - startTime

      return {
        sharedDataExitResult: {
          success: false,
          tripsExited: 0,
          familyGroupsExited: 0,
          notificationsSent: 0,
          errors: [],
          exitedData: { trips: [], familyGroups: [] }
        },
        success: false,
        cleanupResult: {
          transactionsRemoved: 0,
          accountsRemoved: 0,
          investmentsRemoved: 0,
          budgetsRemoved: 0,
          settingsReset: false,
          sharedRequestsDeleted: 0,
          mirrorsDeleted: 0,
          executionTimeMs: completionTime,
          errors: [error instanceof Error ? error.message : 'Erro desconhecido'],
          success: false,
          sharedParticipationRemoved: 0
        },
        recoveryRecordsCreated,
        sharedTransactionsPreserved,
        completionTime,
        errors: [...errors, error instanceof Error ? error.message : 'Erro desconhecido']
      }
    }
  }

  /**
   * Obtém resumo do que será apagado (alias para initiateReset)
   * Requirement 6.1: Exibir resumo completo do que será apagado
   */
  async getResetSummary(userId: string): Promise<ResetSummary> {
    return this.initiateReset(userId)
  }

  /**
   * Valida se o usuário pode executar factory reset
   * Verifica se há dados para limpar
   */
  async canExecuteReset(userId: string): Promise<{
    canReset: boolean
    reason?: string
    hasData: boolean
  }> {
    try {
      const summary = await this.getResetSummary(userId)

      const hasData = summary.personalTransactions > 0 ||
        summary.accounts > 0 ||
        summary.investments > 0 ||
        summary.budgetsAndGoals > 0

      if (!hasData) {
        return {
          canReset: false,
          reason: 'Não há dados para limpar',
          hasData: false
        }
      }

      return {
        canReset: true,
        hasData: true
      }
    } catch (error) {
      console.error('Erro ao validar possibilidade de reset:', error)
      return {
        canReset: false,
        reason: 'Erro ao verificar dados do usuário',
        hasData: false
      }
    }
  }

  /**
   * Obtém estatísticas detalhadas para o usuário
   * Usado para debugging e suporte
   */
  async getUserDataStatistics(userId: string): Promise<{
    visibleTransactions: number
    ownTransactions: number
    sharedAsCreator: number
    sharedAsParticipant: number
    mirrorTransactions: number
    accounts: number
    recoveryRecords: number
  }> {
    try {
      // Usar função de diagnóstico
      const { data, error } = await supabase.rpc('diagnose_user_data', {
        target_user_id: userId
      })

      if (error) {
        throw new Error(`Erro ao obter estatísticas: ${error.message}`)
      }

      return {
        visibleTransactions: data.visible_in_cashflow || 0,
        ownTransactions: data.own_transactions || 0,
        sharedAsCreator: data.shared_as_creator || 0,
        sharedAsParticipant: data.shared_as_participant || 0,
        mirrorTransactions: data.mirror_transactions || 0,
        accounts: data.accounts_count || 0,
        recoveryRecords: data.recovery_records_count || 0
      }
    } catch (error) {
      console.error('Erro ao obter estatísticas do usuário:', error)
      return {
        visibleTransactions: 0,
        ownTransactions: 0,
        sharedAsCreator: 0,
        sharedAsParticipant: 0,
        mirrorTransactions: 0,
        accounts: 0,
        recoveryRecords: 0
      }
    }
  }

  /**
   * Cria confirmação padrão para factory reset
   * Usado nos testes e como template
   */
  createConfirmation(options: {
    preserveSharedTransactions?: boolean
    userSignature?: string
  } = {}): ResetConfirmation {
    return {
      confirmed: true,
      preserveSharedTransactions: options.preserveSharedTransactions ?? true,
      acknowledgeDataLoss: true,
      userSignature: options.userSignature
    }
  }
}

export const factoryResetService = new FactoryResetService()