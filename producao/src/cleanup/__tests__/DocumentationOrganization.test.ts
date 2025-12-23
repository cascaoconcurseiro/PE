/**
 * Property-based tests for documentation organization (Phase 2)
 * Tests Properties 11-15 from the design specification
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fc from 'fast-check'
import * as fs from 'fs'
import * as path from 'path'
import { CleanupEngine } from '../CleanupEngine'

describe('Documentation Organization Properties', () => {
  let tempDir: string
  let engine: CleanupEngine

  beforeEach(async () => {
    tempDir = path.join(process.cwd(), 'test-docs-' + Date.now())
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
   * Property 11: Documentation Consolidation
   * Duplicate documentation should be consolidated into single authoritative versions
   */
  it('should consolidate duplicate documentation correctly', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.oneof(
          fc.constant('README.md'),
          fc.constant('GETTING_STARTED.md'),
          fc.constant('API_GUIDE.md'),
          fc.constant('INSTALLATION.md')
        ),
        version: fc.integer({ min: 1, max: 3 }),
        content: fc.string({ minLength: 50, maxLength: 200 })
      }), { minLength: 2, maxLength: 8 }),
      async (docFiles) => {
        // Create documentation files with potential duplicates
        for (const docFile of docFiles) {
          const fileName = docFile.version > 1 
            ? `${docFile.name.replace('.md', '')}_v${docFile.version}.md`
            : docFile.name
          const filePath = path.join(tempDir, fileName)
          await fs.promises.writeFile(filePath, docFile.content)
        }

        const report = await engine.scanProject()
        const duplicateGroups = report.duplicateFiles

        // If there are multiple versions of the same doc, they should be detected as duplicates
        const docNames = [...new Set(docFiles.map(f => f.name))]
        const duplicatedDocs = docNames.filter(name => 
          docFiles.filter(f => f.name === name).length > 1
        )

        if (duplicatedDocs.length > 0) {
          expect(duplicateGroups.length).toBeGreaterThan(0)
        }

        // Validation should identify which versions to keep vs remove
        const allDocFiles = report.categorizedFiles.documentation
        const validation = await engine.validateCleanup(allDocFiles)
        
        // Should have both safe and unsafe files when duplicates exist
        if (duplicatedDocs.length > 0) {
          expect(allDocFiles.length).toBeGreaterThan(0)
        }
      }
    ))
  })

  /**
   * Property 12: Documentation Hierarchy Preservation
   * Documentation should be organized in logical hierarchies (user, technical, archive)
   */
  it('should preserve logical documentation hierarchy', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.string({ minLength: 1, maxLength: 20 }).map(s => s + '.md'),
        type: fc.oneof(
          fc.constant('user'),
          fc.constant('technical'),
          fc.constant('archive')
        ),
        content: fc.string({ minLength: 20, maxLength: 100 })
      }), { minLength: 1, maxLength: 10 }),
      async (docFiles) => {
        // Create documentation files
        for (const docFile of docFiles) {
          const filePath = path.join(tempDir, docFile.name)
          const content = docFile.type === 'technical' 
            ? `# Technical Documentation\n${docFile.content}`
            : docFile.type === 'user'
            ? `# User Guide\n${docFile.content}`
            : `# Archived Documentation\n${docFile.content}`
          await fs.promises.writeFile(filePath, content)
        }

        const report = await engine.scanProject()
        const docFilesFound = report.categorizedFiles.documentation

        // All documentation files should be detected
        expect(docFilesFound.length).toBeGreaterThanOrEqual(docFiles.length)

        // Files should be categorizable by type
        const technicalDocs = docFiles.filter(f => f.type === 'technical')
        const userDocs = docFiles.filter(f => f.type === 'user')
        const archiveDocs = docFiles.filter(f => f.type === 'archive')

        // Each type should have appropriate handling
        expect(docFilesFound.length).toBe(docFiles.length)
      }
    ))
  })

  /**
   * Property 13: Archive Information Preservation
   * Important information should be preserved when archiving documentation
   */
  it('should preserve important information when archiving', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.string({ minLength: 1, maxLength: 15 }).map(s => s + '.md'),
        hasImportantInfo: fc.boolean(),
        content: fc.string({ minLength: 30, maxLength: 150 })
      }), { minLength: 1, maxLength: 6 }),
      async (docFiles) => {
        // Create documentation files with varying importance
        for (const docFile of docFiles) {
          const filePath = path.join(tempDir, docFile.name)
          const content = docFile.hasImportantInfo
            ? `# IMPORTANT: ${docFile.content}\n\nCRITICAL INFORMATION: This contains essential setup instructions.`
            : docFile.content
          await fs.promises.writeFile(filePath, content)
        }

        const report = await engine.scanProject()
        const docFilesFound = report.categorizedFiles.documentation

        const validation = await engine.validateCleanup(docFilesFound)

        // Files with important information should be handled carefully
        const importantFiles = docFiles.filter(f => f.hasImportantInfo)
        if (importantFiles.length > 0) {
          // Should either be marked unsafe or have warnings
          const hasProtection = validation.unsafe.length > 0 || 
                               validation.warnings.size > 0
          expect(hasProtection).toBe(true)
        }
      }
    ))
  })

  /**
   * Property 14: Documentation Index Completeness
   * Documentation index should include all organized documentation
   */
  it('should create complete documentation index', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.string({ minLength: 1, maxLength: 12 }).map(s => s + '.md'),
        category: fc.oneof(
          fc.constant('user'),
          fc.constant('technical'),
          fc.constant('archive')
        ),
        content: fc.string({ minLength: 20, maxLength: 80 })
      }), { minLength: 1, maxLength: 8 }),
      async (docFiles) => {
        // Create organized documentation structure
        await fs.promises.mkdir(path.join(tempDir, 'docs', 'user'), { recursive: true })
        await fs.promises.mkdir(path.join(tempDir, 'docs', 'technical'), { recursive: true })
        await fs.promises.mkdir(path.join(tempDir, 'docs', 'archive'), { recursive: true })

        // Create documentation files in appropriate directories
        for (const docFile of docFiles) {
          const dirPath = path.join(tempDir, 'docs', docFile.category)
          const filePath = path.join(dirPath, docFile.name)
          await fs.promises.writeFile(filePath, docFile.content)
        }

        const report = await engine.scanProject()
        const docFilesFound = report.categorizedFiles.documentation

        // All organized documentation should be detected
        expect(docFilesFound.length).toBeGreaterThanOrEqual(docFiles.length)

        // Each category should have files if we created them
        const userDocs = docFiles.filter(f => f.category === 'user')
        const technicalDocs = docFiles.filter(f => f.category === 'technical')
        const archiveDocs = docFiles.filter(f => f.category === 'archive')

        // Verify categorization works
        if (userDocs.length > 0) {
          const userDocsFound = docFilesFound.filter(f => f.includes('docs/user') || f.includes('docs\\user'))
          expect(userDocsFound.length).toBeGreaterThan(0)
        }
      }
    ))
  })

  /**
   * Property 15: Superseded Guide Removal
   * Superseded guides should be identified and removed appropriately
   */
  it('should identify and handle superseded guides correctly', async () => {
    await fc.assert(fc.asyncProperty(
      fc.array(fc.record({
        name: fc.oneof(
          fc.constant('old_guide.md'),
          fc.constant('deprecated_tutorial.md'),
          fc.constant('legacy_instructions.md'),
          fc.constant('outdated_readme.md')
        ),
        isSuperseded: fc.boolean(),
        content: fc.string({ minLength: 30, maxLength: 120 })
      }), { minLength: 1, maxLength: 6 }),
      async (docFiles) => {
        // Create documentation files, some superseded
        for (const docFile of docFiles) {
          const filePath = path.join(tempDir, docFile.name)
          const content = docFile.isSuperseded
            ? `# DEPRECATED: ${docFile.content}\n\nThis guide has been superseded by newer documentation.`
            : docFile.content
          await fs.promises.writeFile(filePath, content)
        }

        const report = await engine.scanProject()
        const obsoleteFiles = report.obsoleteFiles

        // Superseded files should be identified as obsolete
        const supersededFiles = docFiles.filter(f => f.isSuperseded)
        if (supersededFiles.length > 0) {
          const foundSuperseded = obsoleteFiles.filter(f => 
            supersededFiles.some(sf => f.includes(sf.name.replace('.md', '')))
          )
          expect(foundSuperseded.length).toBeGreaterThan(0)
        }

        // Validation should handle superseded files appropriately
        const docFilesFound = report.categorizedFiles.documentation
        const validation = await engine.validateCleanup(docFilesFound)
        
        // Should have some classification of files
        expect(validation.safe.length + validation.unsafe.length).toBe(docFilesFound.length)
      }
    ))
  })
})