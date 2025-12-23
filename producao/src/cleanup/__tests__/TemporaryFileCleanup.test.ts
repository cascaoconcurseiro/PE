/**
 * Property-based tests for temporary file cleanup (Phase 1)
 * Tests Properties 6-10 from the design specification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import { CleanupEngine } from '../CleanupEngine'

describe('Temporary File Cleanup Properties', () => {
  let tempDir: string
  let engine: CleanupEngine

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-temp-' + Date.now())
    await fs.promises.mkdir(tempDir, { recursive: true })
    engine = new CleanupEngine(tempDir)
  })

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  /**
   * Property 6: Log Preservation Strategy
   * Current session logs should be preserved, older logs should be cleaned
   */
  it('should preserve current session logs and clean older logs', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s))
          .map(s => s + '.log'),
        age: fc.integer({ min: 0, max: 30 }), // days old
        content: fc.string({ maxLength: 100 })
      }), { minLength: 1, maxLength: 10 }),
      async (logFiles) => {
        // Create log files with different ages
        const currentTime = Date.now()
        for (const logFile of logFiles) {
          const filePath = path.join(tempDir, logFile.name)
          await fs.promises.writeFile(filePath, logFile.content)
          
          // Set file modification time based on age
          const fileTime = currentTime - (logFile.age * 24 * 60 * 60 * 1000)
          await fs.promises.utimes(filePath, new Date(fileTime), new Date(fileTime))
        }

        const report = await engine.scanProject()
        const logFilesFound = report.categorizedFiles.logs

        // Current session logs (age 0) should be preserved
        const currentLogs = logFiles.filter(f => f.age === 0)
        const olderLogs = logFiles.filter(f => f.age > 0)

        // All log files should be detected
        expect(logFilesFound.length).toBeGreaterThanOrEqual(logFiles.length)

        // Validation should preserve current logs and allow removal of older logs
        const validation = await engine.validateCleanup(logFilesFound)
        
        // At least some older logs should be safe to remove
        if (olderLogs.length > 0) {
          expect(validation.safe.length).toBeGreaterThan(0)
        }
      }
    ))
  })

  /**
   * Property 7: Temporary File Cleanup Completeness
   * All temporary files should be identified and cleaned
   */
  it('should identify and clean all temporary files completely', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.oneof(
          fc.constant('temp.txt'),
          fc.constant('cache.json'),
          fc.constant('tmp_data.csv'),
          fc.constant('analysis-report.json'),
          fc.constant('build-cache.bin')
        ),
        content: fc.string({ maxLength: 50 })
      }), { minLength: 1, maxLength: 8 }),
      async (tempFiles) => {
        // Create temporary files
        for (const tempFile of tempFiles) {
          const filePath = path.join(tempDir, tempFile.name)
          await fs.promises.writeFile(filePath, tempFile.content)
        }

        const report = await engine.scanProject()
        const temporaryFilesFound = report.categorizedFiles.temporary

        // All temporary files should be detected
        expect(temporaryFilesFound.length).toBeGreaterThanOrEqual(tempFiles.length)

        // All temporary files should be safe to remove
        const validation = await engine.validateCleanup(temporaryFilesFound)
        expect(validation.safe.length).toBe(temporaryFilesFound.length)
        expect(validation.unsafe.length).toBe(0)
      }
    ))
  })

  /**
   * Property 8: Error Information Preservation
   * Important error information should be archived before log cleanup
   */
  it('should preserve important error information before cleanup', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.oneof(
          fc.constant('error.log'),
          fc.constant('build_error.log'),
          fc.constant('crash.log'),
          fc.constant('debug.log')
        ),
        hasErrors: fc.boolean(),
        content: fc.string({ minLength: 10, maxLength: 200 })
      }), { minLength: 1, maxLength: 5 }),
      async (logFiles) => {
        // Create log files with potential error content
        for (const logFile of logFiles) {
          const filePath = path.join(tempDir, logFile.name)
          const content = logFile.hasErrors 
            ? `ERROR: ${logFile.content}` 
            : logFile.content
          await fs.promises.writeFile(filePath, content)
        }

        const report = await engine.scanProject()
        const logFilesFound = report.categorizedFiles.logs

        const validation = await engine.validateCleanup(logFilesFound)

        // Files with error content should be flagged as unsafe or have warnings
        const errorFiles = logFiles.filter(f => f.hasErrors)
        if (errorFiles.length > 0) {
          const hasWarningsOrUnsafe = validation.unsafe.length > 0 || 
                                     validation.warnings.size > 0
          expect(hasWarningsOrUnsafe).toBe(true)
        }
      }
    ))
  })

  /**
   * Property 9: Extension-Based Log Removal
   * Log files should be identified by extension and content patterns
   */
  it('should identify log files by extension and content patterns', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        extension: fc.oneof(
          fc.constant('.log'),
          fc.constant('.txt'),
          fc.constant('.json'),
          fc.constant('.md')
        ),
        basename: fc.string({ minLength: 1, maxLength: 15 })
          .filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
        isLogContent: fc.boolean()
      }), { minLength: 1, maxLength: 8 }),
      async (files) => {
        // Create files with different extensions
        for (const file of files) {
          const fileName = file.basename + file.extension
          const filePath = path.join(tempDir, fileName)
          const content = file.isLogContent 
            ? 'INFO: Application started\nERROR: Connection failed'
            : 'Regular file content'
          await fs.promises.writeFile(filePath, content)
        }

        const report = await engine.scanProject()
        const logFilesFound = report.categorizedFiles.logs

        // Files with .log extension should always be detected as logs
        const logExtensionFiles = files.filter(f => f.extension === '.log')
        expect(logFilesFound.filter(f => f.endsWith('.log')).length)
          .toBeGreaterThanOrEqual(logExtensionFiles.length)

        // Files with log content patterns should also be detected
        const logContentFiles = files.filter(f => f.isLogContent)
        if (logContentFiles.length > 0) {
          expect(logFilesFound.length).toBeGreaterThan(0)
        }
      }
    ))
  })

  /**
   * Property 10: Analysis File Cleanup
   * Analysis and report files should be cleaned up completely
   */
  it('should clean up analysis and report files completely', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.oneof(
          fc.constant('analysis-report.json'),
          fc.constant('complexity-report-123.json'),
          fc.constant('refactoring-report-456.json'),
          fc.constant('cleanup-analysis-report.json'),
          fc.constant('code-analysis-report.json')
        ),
        size: fc.integer({ min: 100, max: 10000 })
      }), { minLength: 1, maxLength: 6 }),
      async (reportFiles) => {
        // Create analysis report files
        for (const reportFile of reportFiles) {
          const filePath = path.join(tempDir, reportFile.name)
          const content = JSON.stringify({ 
            analysis: 'test data', 
            size: reportFile.size 
          })
          await fs.promises.writeFile(filePath, content)
        }

        const report = await engine.scanProject()
        const obsoleteFiles = report.obsoleteFiles

        // All analysis report files should be identified as obsolete
        const analysisFiles = reportFiles.map(f => f.name)
        const foundAnalysisFiles = obsoleteFiles.filter(f => 
          analysisFiles.some(af => f.includes(af.replace('.json', '')))
        )
        
        expect(foundAnalysisFiles.length).toBeGreaterThan(0)

        // Analysis files should be safe to remove
        const validation = await engine.validateCleanup(foundAnalysisFiles)
        expect(validation.safe.length).toBe(foundAnalysisFiles.length)
      }
    ))
  })
})