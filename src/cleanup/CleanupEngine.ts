/**
 * Cleanup Engine - Main coordinator for the cleanup system
 */

import { CleanupEngine as ICleanupEngine } from './interfaces'
import { FileScanner } from './FileScanner'
import { DependencyAnalyzer } from './DependencyAnalyzer'
import { ValidationEngine } from './ValidationEngine'
import { BackupSystem } from './BackupSystem'
import { RollbackSystem } from './RollbackSystem'
import {
  FileAnalysisReport,
  FileCategoryMap,
  DependencyGraph,
  CleanupPlan,
  CleanupPhase,
  ValidationStep
} from './types'

export class CleanupEngine implements ICleanupEngine {
  private readonly fileScanner: FileScanner
  private readonly dependencyAnalyzer: DependencyAnalyzer
  private readonly validationEngine: ValidationEngine
  private readonly backupSystem: BackupSystem
  private readonly rollbackSystem: RollbackSystem
  private readonly projectRoot: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.fileScanner = new FileScanner(projectRoot)
    this.dependencyAnalyzer = new DependencyAnalyzer(projectRoot)
    this.validationEngine = new ValidationEngine(projectRoot)
    this.backupSystem = new BackupSystem(projectRoot)
    this.rollbackSystem = new RollbackSystem(projectRoot)
  }

  /**
   * Scans the entire project and generates a comprehensive analysis report
   */
  async scanProject(): Promise<FileAnalysisReport> {
    console.log('🔍 Scanning project files...')
    
    // Get all files in the project
    const allFiles = await this.fileScanner.scanAllFiles()
    console.log(`Found ${allFiles.length} files`)

    // Categorize files by type
    const categorizedFiles = this.categorizeFiles(allFiles)
    console.log('📂 Files categorized by type:')
    Object.entries(categorizedFiles).forEach(([category, files]) => {
      console.log(`  ${category}: ${files.length} files`)
    })

    // Identify obsolete files
    console.log('🗑️  Identifying obsolete files...')
    const obsoleteFiles = await this.fileScanner.identifyObsoleteFiles(allFiles)
    console.log(`Found ${obsoleteFiles.length} obsolete files`)

    // Identify duplicates
    console.log('🔍 Identifying duplicate files...')
    const duplicateFiles = await this.fileScanner.identifyDuplicates(allFiles)
    console.log(`Found ${duplicateFiles.length} duplicate groups`)

    // Identify large files
    console.log('📊 Identifying large files...')
    const largeFiles = await this.fileScanner.identifyLargeFiles(allFiles)
    console.log(`Found ${largeFiles.length} large files`)

    return {
      totalFiles: allFiles.length,
      categorizedFiles,
      obsoleteFiles,
      duplicateFiles,
      largeFiles,
      lastModified: new Date()
    }
  }

  /**
   * Categorizes files by type and purpose
   */
  categorizeFiles(files: string[]): FileCategoryMap {
    return this.fileScanner.categorizeFiles(files)
  }

  /**
   * Analyzes dependencies between files
   */
  async analyzeDependencies(files: string[]): Promise<DependencyGraph> {
    console.log('🔗 Analyzing file dependencies...')
    const dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies(files)
    console.log(`Found ${dependencyGraph.edges.length} dependencies between files`)
    
    // Set dependency graph in validation engine
    await this.validationEngine.setDependencyGraph(files)
    
    return dependencyGraph
  }

  /**
   * Generates a comprehensive cleanup plan
   */
  async generateCleanupPlan(): Promise<CleanupPlan> {
    console.log('📋 Generating cleanup plan...')
    
    const analysisReport = await this.scanProject()
    const dependencyGraph = await this.analyzeDependencies(
      Object.values(analysisReport.categorizedFiles).flat()
    )

    const phases = this.createCleanupPhases(analysisReport, dependencyGraph)
    const estimatedSpaceSaved = this.calculateSpaceSavings(analysisReport)
    const riskLevel = this.assessRiskLevel(analysisReport, dependencyGraph)
    const validationSteps = this.createValidationSteps()

    return {
      phases,
      estimatedSpaceSaved,
      riskLevel,
      validationSteps
    }
  }

  /**
   * Creates cleanup phases based on analysis
   */
  private createCleanupPhases(
    analysis: FileAnalysisReport, 
    dependencies: DependencyGraph
  ): CleanupPhase[] {
    const phases: CleanupPhase[] = []

    // Phase 1: Clean temporary and log files
    const tempAndLogFiles = [
      ...analysis.categorizedFiles.logs,
      ...analysis.categorizedFiles.temporary,
      ...analysis.obsoleteFiles.filter(f => 
        f.endsWith('.log') || f.includes('temp') || f.includes('cache')
      )
    ]

    phases.push({
      name: 'Phase 1: Temporary and Log Cleanup',
      description: 'Remove temporary files, old logs, and build artifacts',
      filesToRemove: this.filterSafeToRemove(tempAndLogFiles, dependencies),
      filesToArchive: this.filterNeedsArchiving(tempAndLogFiles, dependencies),
      filesToMove: [],
      validationRequired: true
    })

    // Phase 2: Documentation organization
    const docFiles = analysis.categorizedFiles.documentation
    const duplicateDocs = analysis.duplicateFiles
      .filter(group => group.files.some(f => docFiles.includes(f)))
      .flatMap(group => group.files.slice(1)) // Keep first, remove others

    phases.push({
      name: 'Phase 2: Documentation Organization',
      description: 'Consolidate and organize documentation files',
      filesToRemove: duplicateDocs,
      filesToArchive: this.identifyOldDocumentation(docFiles),
      filesToMove: this.planDocumentationReorganization(docFiles),
      validationRequired: true
    })

    // Phase 3: Script cleanup
    const scriptFiles = analysis.categorizedFiles.scripts
    const unusedScripts = this.identifyUnusedScripts(scriptFiles, dependencies)

    phases.push({
      name: 'Phase 3: Script Cleanup',
      description: 'Remove unused scripts and consolidate similar ones',
      filesToRemove: unusedScripts,
      filesToArchive: this.identifyCriticalScripts(scriptFiles, dependencies),
      filesToMove: [],
      validationRequired: true
    })

    // Phase 4: Folder reorganization
    phases.push({
      name: 'Phase 4: Folder Reorganization',
      description: 'Reorganize folder structure and consolidate configuration',
      filesToRemove: [],
      filesToArchive: [],
      filesToMove: this.planFolderReorganization(analysis.categorizedFiles),
      validationRequired: true
    })

    return phases
  }

  /**
   * Filters files that are safe to remove (not referenced)
   */
  private filterSafeToRemove(files: string[], dependencies: DependencyGraph): string[] {
    return files.filter(file => 
      !this.dependencyAnalyzer.isFileReferenced(file, dependencies)
    )
  }

  /**
   * Filters files that need archiving before removal
   */
  private filterNeedsArchiving(files: string[], dependencies: DependencyGraph): string[] {
    return files.filter(file => {
      const isReferenced = this.dependencyAnalyzer.isFileReferenced(file, dependencies)
      const isImportant = file.includes('error') || file.includes('critical') || 
                         file.includes('deploy') || file.includes('config')
      return isReferenced || isImportant
    })
  }

  /**
   * Identifies old documentation that should be archived
   */
  private identifyOldDocumentation(docFiles: string[]): string[] {
    return docFiles.filter(file => {
      const basename = file.toLowerCase()
      return basename.includes('old') || basename.includes('deprecated') ||
             basename.includes('archive') || basename.includes('backup') ||
             basename.includes('legacy')
    })
  }

  /**
   * Plans documentation reorganization moves
   */
  private planDocumentationReorganization(docFiles: string[]): Array<{from: string, to: string, reason: string}> {
    const moves: Array<{from: string, to: string, reason: string}> = []
    
    for (const file of docFiles) {
      // Move technical docs to docs/technical/
      if (file.includes('TECHNICAL') || file.includes('IMPLEMENTATION') ||
          file.includes('ARCHITECTURE') || file.includes('API')) {
        if (!file.startsWith('docs/technical/')) {
          moves.push({
            from: file,
            to: `docs/technical/${file.split('/').pop()}`,
            reason: 'Organize technical documentation'
          })
        }
      }
      // Move user guides to docs/user/
      else if (file.includes('GUIDE') || file.includes('TUTORIAL') ||
               file.includes('GETTING_STARTED') || file.includes('README')) {
        if (!file.startsWith('docs/user/')) {
          moves.push({
            from: file,
            to: `docs/user/${file.split('/').pop()}`,
            reason: 'Organize user documentation'
          })
        }
      }
    }

    return moves
  }

  /**
   * Identifies unused scripts
   */
  private identifyUnusedScripts(scriptFiles: string[], dependencies: DependencyGraph): string[] {
    return scriptFiles.filter(file => {
      const isReferenced = this.dependencyAnalyzer.isFileReferenced(file, dependencies)
      const isInArchive = file.includes('archive') || file.includes('old')
      return !isReferenced || isInArchive
    })
  }

  /**
   * Identifies critical scripts that need backup
   */
  private identifyCriticalScripts(scriptFiles: string[], dependencies: DependencyGraph): string[] {
    return scriptFiles.filter(file => {
      const isCritical = file.includes('deploy') || file.includes('build') ||
                        file.includes('release') || file.includes('production')
      const isReferenced = this.dependencyAnalyzer.isFileReferenced(file, dependencies)
      return isCritical && isReferenced
    })
  }

  /**
   * Plans folder reorganization
   */
  private planFolderReorganization(categories: FileCategoryMap): Array<{from: string, to: string, reason: string}> {
    const moves: Array<{from: string, to: string, reason: string}> = []
    
    // Consolidate configuration files
    for (const configFile of categories.configuration) {
      if (!configFile.startsWith('config/') && !configFile.startsWith('.')) {
        moves.push({
          from: configFile,
          to: `config/${configFile.split('/').pop()}`,
          reason: 'Consolidate configuration files'
        })
      }
    }

    return moves
  }

  /**
   * Calculates estimated space savings
   */
  private calculateSpaceSavings(analysis: FileAnalysisReport): number {
    let totalSize = 0
    
    // Add size of large files that might be removed
    totalSize += analysis.largeFiles
      .filter(f => analysis.obsoleteFiles.includes(f.path))
      .reduce((sum, f) => sum + f.size, 0)
    
    // Estimate size of log and temporary files (average 1MB each)
    totalSize += (analysis.categorizedFiles.logs.length + 
                 analysis.categorizedFiles.temporary.length) * 1024 * 1024

    return totalSize
  }

  /**
   * Assesses risk level of cleanup operation
   */
  private assessRiskLevel(
    analysis: FileAnalysisReport, 
    dependencies: DependencyGraph
  ): 'low' | 'medium' | 'high' {
    const referencedObsoleteFiles = analysis.obsoleteFiles.filter(file =>
      this.dependencyAnalyzer.isFileReferenced(file, dependencies)
    )

    const criticalFiles = analysis.categorizedFiles.scripts.filter(file =>
      file.includes('deploy') || file.includes('build') || file.includes('production')
    )

    if (referencedObsoleteFiles.length > 10 || criticalFiles.length > 5) {
      return 'high'
    } else if (referencedObsoleteFiles.length > 5 || criticalFiles.length > 2) {
      return 'medium'
    } else {
      return 'low'
    }
  }

  /**
   * Creates validation steps for the cleanup process
   */
  private createValidationSteps(): ValidationStep[] {
    return [
      {
        type: 'reference-check',
        description: 'Check file references before removal',
        required: true
      },
      {
        type: 'build-test',
        description: 'Run build and test processes',
        required: true
      },
      {
        type: 'dependency-check',
        description: 'Verify no critical dependencies are broken',
        required: true
      }
    ]
  }

  /**
   * Validates files before cleanup
   */
  async validateCleanup(files: string[]): Promise<{
    safe: string[]
    unsafe: string[]
    warnings: Map<string, string[]>
  }> {
    console.log('✅ Validating files for safe cleanup...')
    return await this.validationEngine.validateBatchRemoval(files)
  }

  /**
   * Gets the validation engine
   */
  getValidationEngine(): ValidationEngine {
    return this.validationEngine
  }

  /**
   * Gets the backup system
   */
  getBackupSystem(): BackupSystem {
    return this.backupSystem
  }

  /**
   * Gets the rollback system
   */
  getRollbackSystem(): RollbackSystem {
    return this.rollbackSystem
  }
}
