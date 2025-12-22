/**
 * Interfaces for the cleanup system components
 */

import {
  FileAnalysisReport,
  FileCategoryMap,
  DependencyGraph,
  CleanupPlan,
  ReferenceCheck,
  UsageValidation,
  SafetyCheck,
  TestResults,
  ArchiveResult,
  ArchiveIndex,
  MetadataRecord,
  ArchiveReport
} from './types'

export interface CleanupEngine {
  scanProject(): Promise<FileAnalysisReport>
  categorizeFiles(files: string[]): FileCategoryMap
  analyzeDependencies(files: string[]): Promise<DependencyGraph>
  generateCleanupPlan(): Promise<CleanupPlan>
}

export interface ValidationEngine {
  checkFileReferences(filePath: string): Promise<ReferenceCheck>
  validateScriptUsage(scriptPath: string): Promise<UsageValidation>
  verifyDocumentationSafety(docPath: string): Promise<SafetyCheck>
  runIntegrityTests(): Promise<TestResults>
}

export interface ArchiveSystem {
  archiveFile(filePath: string, reason: string): Promise<ArchiveResult>
  createArchiveIndex(): Promise<ArchiveIndex>
  preserveMetadata(filePath: string): Promise<MetadataRecord>
  generateArchiveReport(): Promise<ArchiveReport>
}