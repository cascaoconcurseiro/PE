/**
 * Types for the cleanup and organization system
 */

export interface FileAnalysisReport {
  totalFiles: number
  categorizedFiles: FileCategoryMap
  obsoleteFiles: string[]
  duplicateFiles: DuplicateGroup[]
  largeFiles: LargeFileInfo[]
  lastModified: Date
}

export interface FileCategoryMap {
  logs: string[]
  documentation: string[]
  scripts: string[]
  temporary: string[]
  configuration: string[]
  tests: string[]
}

export interface DuplicateGroup {
  files: string[]
  similarity: number
  reason: 'identical' | 'similar-content' | 'similar-name'
}

export interface LargeFileInfo {
  path: string
  size: number
  type: string
  lastModified: Date
}

export interface CleanupPlan {
  phases: CleanupPhase[]
  estimatedSpaceSaved: number
  riskLevel: 'low' | 'medium' | 'high'
  validationSteps: ValidationStep[]
}

export interface CleanupPhase {
  name: string
  description: string
  filesToRemove: string[]
  filesToArchive: string[]
  filesToMove: FileMove[]
  validationRequired: boolean
}

export interface FileMove {
  from: string
  to: string
  reason: string
}

export interface ValidationStep {
  type: 'reference-check' | 'build-test' | 'dependency-check'
  description: string
  required: boolean
}

export interface ReferenceCheck {
  isReferenced: boolean
  referencedBy: string[]
  safeToRemove: boolean
}

export interface UsageValidation {
  isUsed: boolean
  usedBy: string[]
  isCritical: boolean
}

export interface SafetyCheck {
  isSafe: boolean
  containsCriticalInfo: boolean
  warnings: string[]
}

export interface TestResults {
  passed: boolean
  errors: string[]
  warnings: string[]
}

export interface DependencyGraph {
  nodes: string[]
  edges: DependencyEdge[]
}

export interface DependencyEdge {
  from: string
  to: string
  type: 'import' | 'reference' | 'script-call' | 'config-reference'
}

export interface ArchiveResult {
  success: boolean
  archivedPath: string
  originalPath: string
  reason: string
}

export interface ArchiveIndex {
  entries: ArchiveEntry[]
  createdAt: Date
  totalSize: number
}

export interface ArchiveEntry {
  originalPath: string
  archivedPath: string
  reason: string
  archivedAt: Date
  size: number
}

export interface MetadataRecord {
  filePath: string
  size: number
  lastModified: Date
  permissions: string
  checksum: string
  tags: string[]
}

export interface ArchiveReport {
  totalArchived: number
  totalSize: number
  categories: Record<string, number>
  recommendations: string[]
}

export interface CleanupError {
  type: 'validation' | 'dependency' | 'build' | 'permission'
  file: string
  message: string
  severity: 'warning' | 'error' | 'critical'
  suggestedAction: string
}