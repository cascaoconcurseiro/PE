/**
 * Validation Engine - Ensures safe cleanup operations
 */

import * as fs from 'fs'
import * as path from 'path'
import { ValidationEngine as IValidationEngine } from './interfaces'
import { DependencyAnalyzer } from './DependencyAnalyzer'
import {
  ReferenceCheck,
  UsageValidation,
  SafetyCheck,
  TestResults,
  DependencyGraph
} from './types'

export class ValidationEngine implements IValidationEngine {
  private readonly projectRoot: string
  private readonly dependencyAnalyzer: DependencyAnalyzer
  private dependencyGraph: DependencyGraph | null = null

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.dependencyAnalyzer = new DependencyAnalyzer(projectRoot)
  }

  /**
   * Sets the dependency graph for validation
   */
  async setDependencyGraph(files: string[]): Promise<void> {
    this.dependencyGraph = await this.dependencyAnalyzer.analyzeDependencies(files)
  }

  /**
   * Checks if a file is referenced in active code
   */
  async checkFileReferences(filePath: string): Promise<ReferenceCheck> {
    if (!this.dependencyGraph) {
      throw new Error('Dependency graph not initialized. Call setDependencyGraph first.')
    }

    const isReferenced = this.dependencyAnalyzer.isFileReferenced(filePath, this.dependencyGraph)
    const referencedBy = this.dependencyAnalyzer.getReferencingFiles(filePath, this.dependencyGraph)

    return {
      isReferenced,
      referencedBy,
      safeToRemove: !isReferenced
    }
  }

  /**
   * Validates if a script is used in build processes
   */
  async validateScriptUsage(scriptPath: string): Promise<UsageValidation> {
    const usedBy: string[] = []
    let isCritical = false

    // Check if script is referenced in package.json
    const packageJsonPath = path.join(this.projectRoot, 'package.json')
    try {
      const packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'))
      
      if (packageJson.scripts) {
        for (const [scriptName, scriptCommand] of Object.entries(packageJson.scripts)) {
          if (typeof scriptCommand === 'string' && scriptCommand.includes(scriptPath)) {
            usedBy.push(`package.json:scripts.${scriptName}`)
            
            // Critical scripts
            if (['build', 'test', 'deploy', 'start', 'dev'].includes(scriptName)) {
              isCritical = true
            }
          }
        }
      }
    } catch (error) {
      console.warn('Could not read package.json:', error)
    }

    // Check if script is referenced in other files
    if (this.dependencyGraph) {
      const referencingFiles = this.dependencyAnalyzer.getReferencingFiles(scriptPath, this.dependencyGraph)
      usedBy.push(...referencingFiles)
    }

    // Check if script name indicates it's critical
    const criticalPatterns = ['deploy', 'build', 'release', 'production', 'migrate', 'backup']
    if (criticalPatterns.some(pattern => scriptPath.toLowerCase().includes(pattern))) {
      isCritical = true
    }

    return {
      isUsed: usedBy.length > 0,
      usedBy,
      isCritical
    }
  }

  /**
   * Verifies that documentation doesn't contain critical information
   */
  async verifyDocumentationSafety(docPath: string): Promise<SafetyCheck> {
    const warnings: string[] = []
    let containsCriticalInfo = false

    try {
      const fullPath = path.join(this.projectRoot, docPath)
      const content = await fs.promises.readFile(fullPath, 'utf-8')

      // Check for critical patterns in documentation
      const criticalPatterns = [
        { pattern: /password|secret|key|token|credential/i, message: 'Contains security-related information' },
        { pattern: /setup|installation|getting.?started/i, message: 'Contains setup instructions' },
        { pattern: /configuration|config/i, message: 'Contains configuration information' },
        { pattern: /api.?key|access.?token/i, message: 'Contains API credentials' },
        { pattern: /database|connection.?string/i, message: 'Contains database information' },
        { pattern: /deployment|deploy/i, message: 'Contains deployment information' }
      ]

      for (const { pattern, message } of criticalPatterns) {
        if (pattern.test(content)) {
          warnings.push(message)
          containsCriticalInfo = true
        }
      }

      // Check if it's a README or main documentation file
      const basename = path.basename(docPath).toLowerCase()
      if (basename === 'readme.md' || basename === 'getting_started.md' || 
          basename === 'installation.md' || basename === 'setup.md') {
        warnings.push('This is a main documentation file')
        containsCriticalInfo = true
      }

      // Check if file is referenced by other files
      if (this.dependencyGraph) {
        const isReferenced = this.dependencyAnalyzer.isFileReferenced(docPath, this.dependencyGraph)
        if (isReferenced) {
          warnings.push('This file is referenced by other files')
          containsCriticalInfo = true
        }
      }

    } catch (error) {
      warnings.push(`Could not read file: ${error}`)
    }

    return {
      isSafe: !containsCriticalInfo,
      containsCriticalInfo,
      warnings
    }
  }

  /**
   * Runs build and test processes to validate system integrity
   */
  async runIntegrityTests(): Promise<TestResults> {
    const errors: string[] = []
    const warnings: string[] = []
    let passed = true

    // Check if package.json exists
    const packageJsonPath = path.join(this.projectRoot, 'package.json')
    try {
      await fs.promises.access(packageJsonPath)
    } catch (error) {
      errors.push('package.json not found')
      passed = false
      return { passed, errors, warnings }
    }

    // Read package.json to check available scripts
    let packageJson: any
    try {
      packageJson = JSON.parse(await fs.promises.readFile(packageJsonPath, 'utf-8'))
    } catch (error) {
      errors.push('Could not parse package.json')
      passed = false
      return { passed, errors, warnings }
    }

    // Check if critical files exist
    const criticalFiles = [
      'package.json',
      'tsconfig.json',
      'vite.config.ts',
      'src/main.tsx',
      'index.html'
    ]

    for (const file of criticalFiles) {
      const filePath = path.join(this.projectRoot, file)
      try {
        await fs.promises.access(filePath)
      } catch (error) {
        warnings.push(`Critical file missing: ${file}`)
      }
    }

    // Check if node_modules exists
    const nodeModulesPath = path.join(this.projectRoot, 'node_modules')
    try {
      await fs.promises.access(nodeModulesPath)
    } catch (error) {
      warnings.push('node_modules not found - dependencies may need to be installed')
    }

    // Validate that build script exists
    if (!packageJson.scripts?.build) {
      warnings.push('No build script found in package.json')
    }

    // Validate that test script exists
    if (!packageJson.scripts?.test) {
      warnings.push('No test script found in package.json')
    }

    return {
      passed,
      errors,
      warnings
    }
  }

  /**
   * Validates a batch of files for safe removal
   */
  async validateBatchRemoval(files: string[]): Promise<{
    safe: string[]
    unsafe: string[]
    warnings: Map<string, string[]>
  }> {
    const safe: string[] = []
    const unsafe: string[] = []
    const warnings = new Map<string, string[]>()

    for (const file of files) {
      const fileWarnings: string[] = []
      let isSafe = true

      // Check file references
      try {
        const refCheck = await this.checkFileReferences(file)
        if (refCheck.isReferenced) {
          fileWarnings.push(`Referenced by: ${refCheck.referencedBy.join(', ')}`)
          isSafe = false
        }
      } catch (error) {
        fileWarnings.push(`Could not check references: ${error}`)
      }

      // Check if it's a script
      if (file.endsWith('.js') || file.endsWith('.sh') || file.endsWith('.bat')) {
        try {
          const usageCheck = await this.validateScriptUsage(file)
          if (usageCheck.isCritical) {
            fileWarnings.push('This is a critical script')
            isSafe = false
          }
          if (usageCheck.isUsed) {
            fileWarnings.push(`Used by: ${usageCheck.usedBy.join(', ')}`)
            isSafe = false
          }
        } catch (error) {
          fileWarnings.push(`Could not validate script usage: ${error}`)
        }
      }

      // Check if it's documentation
      if (file.endsWith('.md') || file.endsWith('.txt')) {
        try {
          const safetyCheck = await this.verifyDocumentationSafety(file)
          if (!safetyCheck.isSafe) {
            fileWarnings.push(...safetyCheck.warnings)
            isSafe = false
          }
        } catch (error) {
          fileWarnings.push(`Could not verify documentation safety: ${error}`)
        }
      }

      if (isSafe) {
        safe.push(file)
      } else {
        unsafe.push(file)
      }

      if (fileWarnings.length > 0) {
        warnings.set(file, fileWarnings)
      }
    }

    return { safe, unsafe, warnings }
  }

  /**
   * Generates a validation report
   */
  generateValidationReport(validationResults: {
    safe: string[]
    unsafe: string[]
    warnings: Map<string, string[]>
  }): string {
    const lines: string[] = []
    
    lines.push('# Validation Report')
    lines.push('')
    lines.push(`Total files validated: ${validationResults.safe.length + validationResults.unsafe.length}`)
    lines.push(`Safe to remove: ${validationResults.safe.length}`)
    lines.push(`Unsafe to remove: ${validationResults.unsafe.length}`)
    lines.push('')

    if (validationResults.unsafe.length > 0) {
      lines.push('## Unsafe Files')
      lines.push('')
      for (const file of validationResults.unsafe) {
        lines.push(`### ${file}`)
        const fileWarnings = validationResults.warnings.get(file) || []
        for (const warning of fileWarnings) {
          lines.push(`  - ${warning}`)
        }
        lines.push('')
      }
    }

    if (validationResults.safe.length > 0) {
      lines.push('## Safe Files')
      lines.push('')
      for (const file of validationResults.safe.slice(0, 20)) {
        lines.push(`- ${file}`)
      }
      if (validationResults.safe.length > 20) {
        lines.push(`... and ${validationResults.safe.length - 20} more`)
      }
    }

    return lines.join('\n')
  }
}