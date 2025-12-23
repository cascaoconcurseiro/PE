/**
 * Cleanup Executor - Executes actual cleanup operations
 */

import * as fs from 'fs'
import * as path from 'path'
import { CleanupEngine } from './CleanupEngine'
import { ValidationEngine } from './ValidationEngine'
import { BackupSystem } from './BackupSystem'
import { RollbackSystem } from './RollbackSystem'

export interface CleanupResult {
  phase: string
  filesRemoved: string[]
  filesArchived: string[]
  filesMoved: Array<{ from: string; to: string }>
  errors: string[]
  spaceSaved: number
  rollbackId?: string
}

export class CleanupExecutor {
  private readonly projectRoot: string
  private readonly cleanupEngine: CleanupEngine
  private readonly validationEngine: ValidationEngine
  private readonly backupSystem: BackupSystem
  private readonly rollbackSystem: RollbackSystem

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.cleanupEngine = new CleanupEngine(projectRoot)
    this.validationEngine = this.cleanupEngine.getValidationEngine()
    this.backupSystem = this.cleanupEngine.getBackupSystem()
    this.rollbackSystem = this.cleanupEngine.getRollbackSystem()
  }

  /**
   * Executes Phase 1: Clean temporary and log files
   */
  async executePhase1(): Promise<CleanupResult> {
    console.log('🧹 Starting Phase 1: Temporary and Log Cleanup')
    
    // Create rollback point
    const rollbackId = this.rollbackSystem.createRollbackPoint(
      'Phase 1: Temp and Log Cleanup',
      'Cleanup of temporary files, logs, and build artifacts'
    )

    const result: CleanupResult = {
      phase: 'Phase 1: Temporary and Log Cleanup',
      filesRemoved: [],
      filesArchived: [],
      filesMoved: [],
      errors: [],
      spaceSaved: 0,
      rollbackId
    }

    try {
      // Get analysis report
      const report = await this.cleanupEngine.scanProject()
      
      // Identify files to clean
      const filesToClean = [
        ...report.categorizedFiles.logs,
        ...report.categorizedFiles.temporary,
        ...report.obsoleteFiles.filter(f => 
          f.endsWith('.log') || 
          f.includes('temp') || 
          f.includes('cache') ||
          f.includes('analysis-report') ||
          f.includes('complexity-report') ||
          f.includes('refactoring-report')
        )
      ]

      console.log(`Found ${filesToClean.length} files to clean`)

      // Set up dependency graph for validation
      const allFiles = await this.cleanupEngine.scanProject()
      await this.cleanupEngine.analyzeDependencies(Object.values(allFiles.categorizedFiles).flat())

      // Validate files
      const validation = await this.validationEngine.validateBatchRemoval(filesToClean)
      
      console.log(`Safe to remove: ${validation.safe.length}`)
      console.log(`Unsafe to remove: ${validation.unsafe.length}`)

      // Archive important files before removal
      for (const file of validation.unsafe) {
        try {
          const archiveResult = await this.backupSystem.archiveFile(file, 'Important file - archived before cleanup')
          if (archiveResult.success) {
            result.filesArchived.push(file)
            await this.rollbackSystem.recordRemoval(file, 'Archived important file')
          }
        } catch (error) {
          result.errors.push(`Failed to archive ${file}: ${error}`)
        }
      }

      // Remove safe files
      for (const file of validation.safe) {
        try {
          const fullPath = path.join(this.projectRoot, file)
          const stats = await fs.promises.stat(fullPath)
          result.spaceSaved += stats.size

          // Record removal for rollback
          await this.rollbackSystem.recordRemoval(file, 'Phase 1 cleanup')
          
          // Remove file
          await fs.promises.unlink(fullPath)
          result.filesRemoved.push(file)
          
          console.log(`✅ Removed: ${file}`)
        } catch (error) {
          result.errors.push(`Failed to remove ${file}: ${error}`)
        }
      }

      // Clean empty directories
      await this.cleanEmptyDirectories()

      console.log(`✅ Phase 1 complete: ${result.filesRemoved.length} files removed, ${result.filesArchived.length} archived`)
      console.log(`💾 Space saved: ${(result.spaceSaved / (1024 * 1024)).toFixed(2)} MB`)

    } catch (error) {
      result.errors.push(`Phase 1 execution error: ${error}`)
    }

    return result
  }

  /**
   * Executes Phase 2: Documentation organization
   */
  async executePhase2(): Promise<CleanupResult> {
    console.log('📚 Starting Phase 2: Documentation Organization')
    
    const rollbackId = this.rollbackSystem.createRollbackPoint(
      'Phase 2: Documentation Organization',
      'Organization and consolidation of documentation files'
    )

    const result: CleanupResult = {
      phase: 'Phase 2: Documentation Organization',
      filesRemoved: [],
      filesArchived: [],
      filesMoved: [],
      errors: [],
      spaceSaved: 0,
      rollbackId
    }

    try {
      // Create docs directory structure
      await fs.promises.mkdir(path.join(this.projectRoot, 'docs', 'technical'), { recursive: true })
      await fs.promises.mkdir(path.join(this.projectRoot, 'docs', 'user'), { recursive: true })
      await fs.promises.mkdir(path.join(this.projectRoot, 'docs', 'archive'), { recursive: true })

      const report = await this.cleanupEngine.scanProject()
      const docFiles = report.categorizedFiles.documentation

      // Organize documentation files
      for (const docFile of docFiles) {
        try {
          const basename = path.basename(docFile).toLowerCase()
          let targetDir = 'docs'

          // Determine target directory
          if (basename.includes('technical') || basename.includes('implementation') || 
              basename.includes('architecture') || basename.includes('api')) {
            targetDir = 'docs/technical'
          } else if (basename.includes('guide') || basename.includes('tutorial') || 
                     basename.includes('getting_started') || basename === 'readme.md') {
            targetDir = 'docs/user'
          } else if (basename.includes('old') || basename.includes('deprecated') || 
                     basename.includes('archive') || basename.includes('backup')) {
            targetDir = 'docs/archive'
          }

          // Move file if not already in correct location
          if (!docFile.startsWith(targetDir)) {
            const newPath = path.join(targetDir, path.basename(docFile))
            const oldFullPath = path.join(this.projectRoot, docFile)
            const newFullPath = path.join(this.projectRoot, newPath)

            // Record move for rollback
            await this.rollbackSystem.recordMove(docFile, newPath, 'Documentation organization')
            
            // Move file
            await fs.promises.mkdir(path.dirname(newFullPath), { recursive: true })
            await fs.promises.rename(oldFullPath, newFullPath)
            
            result.filesMoved.push({ from: docFile, to: newPath })
            console.log(`📁 Moved: ${docFile} → ${newPath}`)
          }
        } catch (error) {
          result.errors.push(`Failed to organize ${docFile}: ${error}`)
        }
      }

      // Create documentation index
      await this.createDocumentationIndex()

      console.log(`✅ Phase 2 complete: ${result.filesMoved.length} files organized`)

    } catch (error) {
      result.errors.push(`Phase 2 execution error: ${error}`)
    }

    return result
  }

  /**
   * Executes Phase 3: Script cleanup
   */
  async executePhase3(): Promise<CleanupResult> {
    console.log('🔧 Starting Phase 3: Script Cleanup')
    
    const rollbackId = this.rollbackSystem.createRollbackPoint(
      'Phase 3: Script Cleanup',
      'Cleanup of unused and obsolete scripts'
    )

    const result: CleanupResult = {
      phase: 'Phase 3: Script Cleanup',
      filesRemoved: [],
      filesArchived: [],
      filesMoved: [],
      errors: [],
      spaceSaved: 0,
      rollbackId
    }

    try {
      const report = await this.cleanupEngine.scanProject()
      const scriptFiles = report.categorizedFiles.scripts

      // Focus on archive scripts that are confirmed obsolete
      const archiveScripts = scriptFiles.filter(f => f.includes('archive') || f.includes('old'))

      console.log(`Found ${archiveScripts.length} archive scripts to review`)

      // Validate scripts
      const validation = await this.validationEngine.validateBatchRemoval(archiveScripts)

      // Archive critical scripts before removal
      for (const script of validation.unsafe) {
        try {
          const archiveResult = await this.backupSystem.archiveFile(script, 'Critical script - archived before cleanup')
          if (archiveResult.success) {
            result.filesArchived.push(script)
          }
        } catch (error) {
          result.errors.push(`Failed to archive ${script}: ${error}`)
        }
      }

      // Remove safe archive scripts
      for (const script of validation.safe) {
        try {
          const fullPath = path.join(this.projectRoot, script)
          const stats = await fs.promises.stat(fullPath)
          result.spaceSaved += stats.size

          await this.rollbackSystem.recordRemoval(script, 'Archive script cleanup')
          await fs.promises.unlink(fullPath)
          result.filesRemoved.push(script)
          
          console.log(`✅ Removed archive script: ${script}`)
        } catch (error) {
          result.errors.push(`Failed to remove ${script}: ${error}`)
        }
      }

      console.log(`✅ Phase 3 complete: ${result.filesRemoved.length} scripts removed, ${result.filesArchived.length} archived`)

    } catch (error) {
      result.errors.push(`Phase 3 execution error: ${error}`)
    }

    return result
  }

  /**
   * Executes Phase 4: Folder reorganization
   */
  async executePhase4(): Promise<CleanupResult> {
    console.log('📂 Starting Phase 4: Folder Reorganization')
    
    const rollbackId = this.rollbackSystem.createRollbackPoint(
      'Phase 4: Folder Reorganization',
      'Final folder structure reorganization'
    )

    const result: CleanupResult = {
      phase: 'Phase 4: Folder Reorganization',
      filesRemoved: [],
      filesArchived: [],
      filesMoved: [],
      errors: [],
      spaceSaved: 0,
      rollbackId
    }

    try {
      // Clean up empty directories
      await this.cleanEmptyDirectories()

      // Create final project structure summary
      await this.createProjectStructureSummary()

      console.log(`✅ Phase 4 complete: Project structure optimized`)

    } catch (error) {
      result.errors.push(`Phase 4 execution error: ${error}`)
    }

    return result
  }

  /**
   * Runs integrity tests after cleanup
   */
  async runIntegrityTests(): Promise<boolean> {
    console.log('🔍 Running integrity tests...')
    
    try {
      const testResults = await this.validationEngine.runIntegrityTests()
      
      if (testResults.passed) {
        console.log('✅ All integrity tests passed')
        return true
      } else {
        console.log('❌ Integrity tests failed:')
        testResults.errors.forEach(error => console.log(`  - ${error}`))
        return false
      }
    } catch (error) {
      console.log(`❌ Error running integrity tests: ${error}`)
      return false
    }
  }

  /**
   * Generates final cleanup report
   */
  async generateFinalReport(results: CleanupResult[]): Promise<void> {
    const lines: string[] = []
    
    lines.push('# System Cleanup Report')
    lines.push('')
    lines.push(`Generated: ${new Date().toISOString()}`)
    lines.push('')

    let totalRemoved = 0
    let totalArchived = 0
    let totalMoved = 0
    let totalSpaceSaved = 0
    let totalErrors = 0

    for (const result of results) {
      totalRemoved += result.filesRemoved.length
      totalArchived += result.filesArchived.length
      totalMoved += result.filesMoved.length
      totalSpaceSaved += result.spaceSaved
      totalErrors += result.errors.length

      lines.push(`## ${result.phase}`)
      lines.push('')
      lines.push(`- Files removed: ${result.filesRemoved.length}`)
      lines.push(`- Files archived: ${result.filesArchived.length}`)
      lines.push(`- Files moved: ${result.filesMoved.length}`)
      lines.push(`- Space saved: ${(result.spaceSaved / (1024 * 1024)).toFixed(2)} MB`)
      lines.push(`- Errors: ${result.errors.length}`)
      if (result.rollbackId) {
        lines.push(`- Rollback ID: ${result.rollbackId}`)
      }
      lines.push('')

      if (result.errors.length > 0) {
        lines.push('### Errors:')
        result.errors.forEach(error => lines.push(`- ${error}`))
        lines.push('')
      }
    }

    lines.push('## Summary')
    lines.push('')
    lines.push(`- Total files removed: ${totalRemoved}`)
    lines.push(`- Total files archived: ${totalArchived}`)
    lines.push(`- Total files moved: ${totalMoved}`)
    lines.push(`- Total space saved: ${(totalSpaceSaved / (1024 * 1024)).toFixed(2)} MB`)
    lines.push(`- Total errors: ${totalErrors}`)
    lines.push('')

    lines.push('## Recommendations')
    lines.push('')
    lines.push('- Run `npm run build` to verify system integrity')
    lines.push('- Run `npm test` to ensure all tests pass')
    lines.push('- Review archived files in `.cleanup-backup/` directory')
    lines.push('- Consider setting up automated cleanup scripts for future maintenance')

    const reportPath = path.join(this.projectRoot, 'cleanup-final-report.md')
    await fs.promises.writeFile(reportPath, lines.join('\n'))
    console.log(`📄 Final report saved to: cleanup-final-report.md`)
  }

  /**
   * Cleans empty directories
   */
  private async cleanEmptyDirectories(): Promise<void> {
    const emptyDirs: string[] = []
    
    const checkDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir)
        
        if (entries.length === 0) {
          emptyDirs.push(dir)
        } else {
          // Check subdirectories
          for (const entry of entries) {
            const fullPath = path.join(dir, entry)
            const stats = await fs.promises.stat(fullPath)
            if (stats.isDirectory()) {
              await checkDirectory(fullPath)
            }
          }
        }
      } catch (error) {
        // Directory might not exist or be inaccessible
      }
    }

    // Check common directories that might become empty
    const dirsToCheck = [
      'scripts/archive',
      'docs/old',
      'temp',
      'cache'
    ]

    for (const dir of dirsToCheck) {
      const fullPath = path.join(this.projectRoot, dir)
      await checkDirectory(fullPath)
    }

    // Remove empty directories
    for (const emptyDir of emptyDirs) {
      try {
        await fs.promises.rmdir(emptyDir)
        console.log(`🗑️  Removed empty directory: ${path.relative(this.projectRoot, emptyDir)}`)
      } catch (error) {
        // Directory might not be empty or might not exist
      }
    }
  }

  /**
   * Creates documentation index
   */
  private async createDocumentationIndex(): Promise<void> {
    const lines: string[] = []
    
    lines.push('# Documentation Index')
    lines.push('')
    lines.push('This index provides an overview of all project documentation.')
    lines.push('')

    const docDirs = ['docs/user', 'docs/technical', 'docs/archive']
    
    for (const docDir of docDirs) {
      const fullPath = path.join(this.projectRoot, docDir)
      
      try {
        const files = await fs.promises.readdir(fullPath)
        const mdFiles = files.filter(f => f.endsWith('.md'))
        
        if (mdFiles.length > 0) {
          lines.push(`## ${docDir.replace('docs/', '').replace(/^\w/, c => c.toUpperCase())} Documentation`)
          lines.push('')
          
          for (const file of mdFiles.sort()) {
            lines.push(`- [${file}](./${docDir}/${file})`)
          }
          lines.push('')
        }
      } catch (error) {
        // Directory might not exist
      }
    }

    const indexPath = path.join(this.projectRoot, 'docs', 'README.md')
    await fs.promises.writeFile(indexPath, lines.join('\n'))
  }

  /**
   * Creates project structure summary
   */
  private async createProjectStructureSummary(): Promise<void> {
    const lines: string[] = []
    
    lines.push('# Project Structure')
    lines.push('')
    lines.push('Overview of the cleaned and organized project structure.')
    lines.push('')

    // Add key directories
    const keyDirs = [
      { path: 'src/', description: 'Source code' },
      { path: 'docs/', description: 'Documentation' },
      { path: 'scripts/', description: 'Build and deployment scripts' },
      { path: 'tests/', description: 'Test files' },
      { path: '.kiro/', description: 'Kiro configuration and specs' }
    ]

    for (const dir of keyDirs) {
      const fullPath = path.join(this.projectRoot, dir.path)
      try {
        await fs.promises.access(fullPath)
        lines.push(`- **${dir.path}** - ${dir.description}`)
      } catch (error) {
        // Directory doesn't exist
      }
    }

    lines.push('')
    lines.push('## Cleanup Information')
    lines.push('')
    lines.push('- Temporary files and logs have been cleaned')
    lines.push('- Documentation has been organized by type')
    lines.push('- Obsolete scripts have been removed')
    lines.push('- Empty directories have been cleaned up')
    lines.push('')
    lines.push('For rollback information, see `.cleanup-backup/` directory.')

    const structurePath = path.join(this.projectRoot, 'PROJECT_STRUCTURE.md')
    await fs.promises.writeFile(structurePath, lines.join('\n'))
  }
}