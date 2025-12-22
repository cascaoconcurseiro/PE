/**
 * Property-based tests for validation engine
 * Feature: system-cleanup-organization
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import { ValidationEngine } from '../ValidationEngine'
import { DependencyAnalyzer } from '../DependencyAnalyzer'

describe('Validation Engine Properties', () => {
  let tempDir: string
  let validationEngine: ValidationEngine
  let dependencyAnalyzer: DependencyAnalyzer

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'temp-validation-' + Date.now())
    await fs.promises.mkdir(tempDir, { recursive: true })
    
    validationEngine = new ValidationEngine(tempDir)
    dependencyAnalyzer = new DependencyAnalyzer(tempDir)
  })

  afterEach(async () => {
    try {
      await fs.promises.rm(tempDir, { recursive: true, force: true })
    } catch (error) {
      console.warn('Could not clean up temp directory:', error)
    }
  })

  /**
   * Property 21: Reference Validation Before Removal
   * For any file being considered for removal, the Validation_Engine should check 
   * if the file is referenced in active code before allowing removal
   * Validates: Requirements 5.1
   */
  it('Property 21: Reference Validation Before Removal', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          isReferenced: fc.boolean(),
          content: fc.string({ maxLength: 100 })
        }), { minLength: 1, maxLength: 5 }),
        async (fileSpecs) => {
          const createdFiles: string[] = []
          const referencedFiles: string[] = []
          
          // Create files and their references
          for (const spec of fileSpecs) {
            const fileName = `${spec.name}.js`
            const filePath = path.join(tempDir, fileName)
            await fs.promises.writeFile(filePath, spec.content)
            createdFiles.push(fileName)
            
            if (spec.isReferenced) {
              // Create a file that references this one
              const refFileName = `ref_${spec.name}.js`
              const refContent = `import './${fileName}'`
              await fs.promises.writeFile(path.join(tempDir, refFileName), refContent)
              createdFiles.push(refFileName)
              referencedFiles.push(fileName)
            }
          }

          // Set up dependency graph
          await validationEngine.setDependencyGraph(createdFiles)
          
          // Property: Referenced files should be detected as referenced
          for (const fileName of createdFiles) {
            const refCheck = await validationEngine.checkFileReferences(fileName)
            const shouldBeReferenced = referencedFiles.includes(fileName)
            
            if (shouldBeReferenced) {
              expect(refCheck.isReferenced).toBe(true)
              expect(refCheck.safeToRemove).toBe(false)
            } else {
              expect(refCheck.safeToRemove).toBe(true)
            }
          }
        }
      ),
      { numRuns: 30 }
    )
  }, 30000)

  /**
   * Property 22: Critical Documentation Preservation
   * For any documentation cleanup operation, no critical setup instructions 
   * should be lost during the process
   * Validates: Requirements 5.2
   */
  it('Property 22: Critical Documentation Preservation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          isCritical: fc.boolean(),
          content: fc.oneof(
            fc.constant('This is regular documentation'),
            fc.constant('Setup instructions: npm install'),
            fc.constant('Configuration: set API_KEY=your_key'),
            fc.constant('Password: secret123'),
            fc.constant('Database connection string')
          )
        }), { minLength: 1, maxLength: 5 }),
        async (docSpecs) => {
          const createdDocs: string[] = []
          const criticalDocs: string[] = []
          
          for (const spec of docSpecs) {
            const fileName = spec.isCritical ? 'README.md' : `${spec.name}.md`
            const filePath = path.join(tempDir, fileName)
            await fs.promises.writeFile(filePath, spec.content)
            createdDocs.push(fileName)
            
            if (spec.isCritical || spec.content.includes('Setup') || 
                spec.content.includes('Configuration') || spec.content.includes('Password')) {
              criticalDocs.push(fileName)
            }
          }

          // Property: Critical documentation should be detected as unsafe
          for (const docFile of createdDocs) {
            const safetyCheck = await validationEngine.verifyDocumentationSafety(docFile)
            const shouldBeCritical = criticalDocs.includes(docFile)
            
            if (shouldBeCritical) {
              expect(safetyCheck.isSafe).toBe(false)
              expect(safetyCheck.containsCriticalInfo).toBe(true)
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  }, 30000)

  /**
   * Property 23: Process Dependency Validation
   * For any script being removed, the Validation_Engine should ensure 
   * no active processes depend on it
   * Validates: Requirements 5.3
   */
  it('Property 23: Process Dependency Validation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          isCritical: fc.boolean()
        }), { minLength: 1, maxLength: 5 }),
        async (scriptSpecs) => {
          // Create package.json with scripts
          const packageJson = {
            name: 'test-project',
            scripts: {} as Record<string, string>
          }
          
          const createdScripts: string[] = []
          const criticalScripts: string[] = []
          
          for (const spec of scriptSpecs) {
            const scriptName = `${spec.name}.js`
            const scriptPath = path.join(tempDir, scriptName)
            await fs.promises.writeFile(scriptPath, 'console.log("script")')
            createdScripts.push(scriptName)
            
            if (spec.isCritical) {
              // Add to package.json scripts
              packageJson.scripts[`run-${spec.name}`] = `node ${scriptName}`
              criticalScripts.push(scriptName)
            }
          }

          // Create package.json
          await fs.promises.writeFile(
            path.join(tempDir, 'package.json'), 
            JSON.stringify(packageJson, null, 2)
          )

          // Property: Scripts referenced in package.json should be detected as used
          for (const scriptFile of createdScripts) {
            const usageCheck = await validationEngine.validateScriptUsage(scriptFile)
            const shouldBeUsed = criticalScripts.includes(scriptFile)
            
            if (shouldBeUsed) {
              expect(usageCheck.isUsed).toBe(true)
              expect(usageCheck.usedBy.length).toBeGreaterThan(0)
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  }, 30000)

  /**
   * Property 25: Validation Failure Handling
   * For any validation failure during cleanup, the system should halt 
   * the cleanup process and report the specific issue
   * Validates: Requirements 5.5
   */
  it('Property 25: Validation Failure Handling', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(fc.record({
          name: fc.string({ minLength: 1, maxLength: 8 }).filter(s => /^[a-zA-Z0-9_-]+$/.test(s)),
          hasIssue: fc.boolean()
        }), { minLength: 1, maxLength: 5 }),
        async (fileSpecs) => {
          const allFiles: string[] = []
          const problematicFiles: string[] = []
          
          for (const spec of fileSpecs) {
            const fileName = `${spec.name}.js`
            const filePath = path.join(tempDir, fileName)
            
            if (spec.hasIssue) {
              // Create a file that references this one to make it unsafe
              const refFileName = `ref_${spec.name}.js`
              const refContent = `import './${fileName}'`
              await fs.promises.writeFile(path.join(tempDir, refFileName), refContent)
              allFiles.push(refFileName)
              problematicFiles.push(fileName)
            }
            
            await fs.promises.writeFile(filePath, 'console.log("test")')
            allFiles.push(fileName)
          }

          // Set up validation
          await validationEngine.setDependencyGraph(allFiles)
          
          // Validate batch removal
          const validation = await validationEngine.validateBatchRemoval(allFiles)
          
          // Property: Files with issues should be in unsafe list
          for (const problematicFile of problematicFiles) {
            expect(validation.unsafe).toContain(problematicFile)
            expect(validation.warnings.has(problematicFile)).toBe(true)
          }
          
          // Property: Files without issues should be in safe list (if not referenced)
          const safeFiles = allFiles.filter(f => 
            !problematicFiles.includes(f) && 
            !f.startsWith('ref_') // Exclude reference files
          )
          
          for (const safeFile of safeFiles) {
            if (!validation.unsafe.includes(safeFile)) {
              expect(validation.safe).toContain(safeFile)
            }
          }
        }
      ),
      { numRuns: 20 }
    )
  }, 30000)
})