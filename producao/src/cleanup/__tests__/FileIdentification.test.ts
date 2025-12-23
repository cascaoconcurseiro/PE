/**
 * Property-based tests for file identification
 * Feature: system-cleanup-organization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import { FileScanner } from '../FileScanner'
import { DependencyAnalyzer } from '../DependencyAnalyzer'
import { CleanupEngine } from '../CleanupEngine'

describe('File Identification Properties', () => {
  let tempDir: string
  let fileScanner: FileScanner
  let dependencyAnalyzer: DependencyAnalyzer
  let cleanupEngine: CleanupEngine

  beforeEach(async () => {
    // Create temporary directory for testing
    tempDir = path.join(process.cwd(), 'temp-test-' + Date.now())
    await fs.promises.mkdir(tempDir, { recursive: true })
    
    fileScanner = new FileScanner(tempDir)
    dependencyAnalyzer = new DependencyAnalyzer(tempDir)
    cleanupEngine = new CleanupEngine(tempDir)
  })

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Could not clean up temp directory:', error)
    }
  })

  /**
   * Property 1: Complete File Identification
   * For any project structure with files, the scanner should find all created files
   * Validates: Requirements 1.1
   */
  it('Property 1: Complete File Identification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 5 }),
        async (fileNames) => {
          // Create test files with valid names
          const createdFiles: string[] = []
          
          for (const name of fileNames) {
            const fileName = `${name}.txt`
            const filePath = path.join(tempDir, fileName)
            await fs.promises.writeFile(filePath, 'test content')
            createdFiles.push(fileName)
          }

          // Scan files
          const scannedFiles = await fileScanner.scanAllFiles()
          
          // Property: All created files should be found
          for (const createdFile of createdFiles) {
            const normalizedCreatedFile = createdFile.replace(/\\/g, '/')
            expect(scannedFiles).toContain(normalizedCreatedFile)
          }
        }
      ),
      { numRuns: 50 }
    )
  }, 30000)

  /**
   * Property 2: Script Usage Detection Accuracy
   * For any collection of scripts in scripts folder, they should be categorized as scripts
   * Validates: Requirements 1.2
   */
  it('Property 2: Script Usage Detection Accuracy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 5 }),
        async (scriptNames) => {
          // Create scripts directory
          await fs.promises.mkdir(path.join(tempDir, 'scripts'), { recursive: true })
          
          const scriptFiles: string[] = []
          
          for (const name of scriptNames) {
            const fileName = `scripts/${name}.js`
            const filePath = path.join(tempDir, 'scripts', `${name}.js`)
            await fs.promises.writeFile(filePath, 'console.log("script")')
            scriptFiles.push(fileName)
          }

          // Categorize files
          const allFiles = await fileScanner.scanAllFiles()
          const categories = fileScanner.categorizeFiles(allFiles)
          
          // Property: All script files should be categorized as scripts
          for (const scriptFile of scriptFiles) {
            const normalizedScriptFile = scriptFile.replace(/\\/g, '/')
            expect(categories.scripts).toContain(normalizedScriptFile)
          }
        }
      ),
      { numRuns: 30 }
    )
  }, 30000)

  /**
   * Property 3: Log File Age Classification
   * For any set of log files, they should be categorized as logs
   * Validates: Requirements 1.3
   */
  it('Property 3: Log File Age Classification', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 10 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 5 }),
        async (logNames) => {
          const logFiles: string[] = []
          
          for (const name of logNames) {
            const fileName = `${name}.log`
            const filePath = path.join(tempDir, fileName)
            await fs.promises.writeFile(filePath, 'log content')
            logFiles.push(fileName)
          }

          // Categorize files
          const allFiles = await fileScanner.scanAllFiles()
          const categories = fileScanner.categorizeFiles(allFiles)
          
          // Property: All log files should be categorized as logs
          for (const logFile of logFiles) {
            const normalizedLogFile = logFile.replace(/\\/g, '/')
            expect(categories.logs).toContain(normalizedLogFile)
          }
        }
      ),
      { numRuns: 30 }
    )
  }, 30000)

  /**
   * Property 4: Documentation Duplicate Detection
   * For any collection of markdown files, duplicates should be detected
   * Validates: Requirements 1.4
   */
  it('Property 4: Documentation Duplicate Detection', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.string({ minLength: 1, maxLength: 8 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)), { minLength: 1, maxLength: 3 }),
        async (docNames) => {
          const docFiles: string[] = []
          
          for (const name of docNames) {
            // Create original file
            const originalFile = `${name}.md`
            await fs.promises.writeFile(
              path.join(tempDir, originalFile), 
              'documentation content'
            )
            docFiles.push(originalFile)
            
            // Create duplicate with copy suffix
            const duplicateFile = `${name}_copy.md`
            await fs.promises.writeFile(
              path.join(tempDir, duplicateFile), 
              'documentation content'
            )
            docFiles.push(duplicateFile)
          }

          // Categorize files
          const allFiles = await fileScanner.scanAllFiles()
          const categories = fileScanner.categorizeFiles(allFiles)
          
          // Property: All doc files should be categorized as documentation
          for (const docFile of docFiles) {
            const normalizedDocFile = docFile.replace(/\\/g, '/')
            expect(categories.documentation).toContain(normalizedDocFile)
          }
          
          // Identify duplicates
          const duplicates = await fileScanner.identifyDuplicates(allFiles)
          
          // Property: Should find at least one duplicate group
          expect(duplicates.length).toBeGreaterThan(0)
        }
      ),
      { numRuns: 20 }
    )
  }, 30000)
})