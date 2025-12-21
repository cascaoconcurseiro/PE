/**
 * Factory Reset System - Exports
 * 
 * Sistema completo de factory reset com recuperação inteligente de transações compartilhadas.
 * Permite limpeza completa dos dados do usuário mantendo capacidade de recuperar
 * transações compartilhadas quando o usuário retornar.
 */

// Core Services
export { SharedTransactionDetector, sharedTransactionDetector } from './SharedTransactionDetector'
export { RecoveryRegistry, recoveryRegistry } from './RecoveryRegistry'
export { DataCleanupEngine, dataCleanupEngine } from './DataCleanupEngine'
export { FactoryResetService, factoryResetService } from './FactoryResetService'

// Recovery Services
export { RecoveryDetectionService, recoveryDetectionService } from './RecoveryDetectionService'
export { RecoveryRestorationService, recoveryRestorationService } from './RecoveryRestorationService'

// Types - SharedTransactionDetector
export type {
  SharedTransaction,
  SharedTransactionSummary
} from './SharedTransactionDetector'

// Types - RecoveryRegistry
export type {
  RecoveryRecord,
  RecoveryRecordCreation
} from './RecoveryRegistry'

// Types - DataCleanupEngine
export type {
  CleanupResult,
  CleanupSummary
} from './DataCleanupEngine'

// Types - FactoryResetService
export type {
  ResetSummary,
  ResetConfirmation,
  ResetResult
} from './FactoryResetService'

// Types - RecoveryDetectionService
export type {
  RecoveryAvailability
} from './RecoveryDetectionService'

// Types - RecoveryRestorationService
export type {
  RestorationResult,
  RestorationSummary
} from './RecoveryRestorationService'

/**
 * Convenience function to get all factory reset services
 * Useful for dependency injection or testing
 */
export const getFactoryResetServices = () => ({
  sharedTransactionDetector,
  recoveryRegistry,
  dataCleanupEngine,
  factoryResetService,
  recoveryDetectionService,
  recoveryRestorationService
})

/**
 * Factory Reset System Status
 * Use this to check if all services are properly initialized
 */
export const getSystemStatus = () => ({
  services: {
    sharedTransactionDetector: !!sharedTransactionDetector,
    recoveryRegistry: !!recoveryRegistry,
    dataCleanupEngine: !!dataCleanupEngine,
    factoryResetService: !!factoryResetService,
    recoveryDetectionService: !!recoveryDetectionService,
    recoveryRestorationService: !!recoveryRestorationService
  },
  initialized: true,
  version: '1.0.0'
})