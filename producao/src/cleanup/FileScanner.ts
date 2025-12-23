/**
 * File Scanner - Identifies and categorizes all project files
 */

import * as fs from 'fs'
import * as path from 'path'
import { FileCategoryMap, LargeFileInfo, DuplicateGroup } from './types'

export class FileScanner {
  private readonly projectRoot: string
  private readonly excludePatterns: RegExp[]
  private readonly largeFileThreshold: number = 1024 * 1024 // 1MB

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
    this.excludePatterns = [
      /node_modules/,
      /\.git/,
      /dist/,
      /build/,
      /coverage/,
      /\.next/,
      /\.cache/
    ]
  }

  /**
   * Scans the entire project and returns all files
   */
  async scanAllFiles(): Promise<string[]> {
    const files: string[] = []
    
    const scanDirectory = async (dir: string): Promise<void> => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true })
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          const relativePath = path.relative(this.projectRoot, fullPath)
          
          // Skip excluded directories
          if (this.shouldExclude(relativePath)) {
            continue
          }
          
          if (entry.isDirectory()) {
            await scanDirectory(fullPath)
          } else if (entry.isFile()) {
            // Normalize path separators for consistency
            const normalizedPath = relativePath.replace(/\\/g, '/')
            files.push(normalizedPath)
          }
        }
      } catch (error) {
        console.warn(`Warning: Could not scan directory ${dir}:`, error)
      }
    }
    
    await scanDirectory(this.projectRoot)
    return files
  }

  /**
   * Categorizes files by type and purpose
   */
  categorizeFiles(files: string[]): FileCategoryMap {
    const categories: FileCategoryMap = {
      logs: [],
      documentation: [],
      scripts: [],
      temporary: [],
      configuration: [],
      tests: []
    }

    for (const file of files) {
      const ext = path.extname(file).toLowerCase()
      const basename = path.basename(file).toLowerCase()
      const dirname = path.dirname(file).toLowerCase()

      // Log files
      if (ext === '.log' || basename.includes('log') || 
          file.includes('logs/') || basename.endsWith('.txt') && basename.includes('error')) {
        categories.logs.push(file)
      }
      // Documentation files
      else if (ext === '.md' || ext === '.txt' || ext === '.rst' || 
               dirname.includes('docs') || dirname.includes('documentation')) {
        categories.documentation.push(file)
      }
      // Script files
      else if ((ext === '.js' || ext === '.sh' || ext === '.bat' || ext === '.ps1') && 
               (dirname.includes('scripts') || basename.includes('script'))) {
        categories.scripts.push(file)
      }
      // Test files
      else if (basename.includes('test') || basename.includes('spec') ||
               dirname.includes('test') || dirname.includes('__tests__') ||
               ext === '.test.ts' || ext === '.test.js' || ext === '.spec.ts') {
        categories.tests.push(file)
      }
      // Configuration files
      else if (ext === '.json' && (basename.includes('config') || basename.includes('package') ||
               basename.includes('tsconfig') || basename.includes('eslint') ||
               basename.includes('prettier') || basename.includes('vite')) ||
               ext === '.yml' || ext === '.yaml' || ext === '.toml' ||
               basename.startsWith('.') && !ext) {
        categories.configuration.push(file)
      }
      // Temporary files
      else if (ext === '.tmp' || ext === '.temp' || basename.includes('temp') ||
               basename.includes('cache') || dirname.includes('temp') ||
               dirname.includes('cache') || dirname.includes('.cache')) {
        categories.temporary.push(file)
      }
    }

    return categories
  }

  /**
   * Identifies large files that might need attention
   */
  async identifyLargeFiles(files: string[]): Promise<LargeFileInfo[]> {
    const largeFiles: LargeFileInfo[] = []

    for (const file of files) {
      try {
        const fullPath = path.join(this.projectRoot, file)
        const stats = await fs.promises.stat(fullPath)
        
        if (stats.size > this.largeFileThreshold) {
          largeFiles.push({
            path: file,
            size: stats.size,
            type: path.extname(file) || 'no-extension',
            lastModified: stats.mtime
          })
        }
      } catch (error) {
        // File might have been deleted or is inaccessible
        console.warn(`Warning: Could not stat file ${file}:`, error)
      }
    }

    return largeFiles.sort((a, b) => b.size - a.size)
  }

  /**
   * Identifies duplicate files based on name patterns and content
   */
  async identifyDuplicates(files: string[]): Promise<DuplicateGroup[]> {
    const duplicateGroups: DuplicateGroup[] = []
    const nameGroups = new Map<string, string[]>()
    
    // Group files by similar names
    for (const file of files) {
      const basename = path.basename(file, path.extname(file)).toLowerCase()
      const normalizedName = basename
        .replace(/[-_\s]+/g, '')
        .replace(/\d+/g, '')
        .replace(/(copy|backup|old|new|temp|final)/g, '')
      
      if (!nameGroups.has(normalizedName)) {
        nameGroups.set(normalizedName, [])
      }
      nameGroups.get(normalizedName)!.push(file)
    }

    // Find groups with multiple files
    for (const [, group] of nameGroups) {
      if (group.length > 1) {
        // Check for specific duplicate patterns
        const hasCopyPattern = group.some(f => 
          f.includes('copy') || f.includes('backup') || f.includes('old')
        )
        
        if (hasCopyPattern) {
          duplicateGroups.push({
            files: group,
            similarity: 0.8,
            reason: 'similar-name'
          })
        }
      }
    }

    return duplicateGroups
  }

  /**
   * Identifies obsolete files based on patterns and age
   */
  async identifyObsoleteFiles(files: string[]): Promise<string[]> {
    const obsoleteFiles: string[] = []
    const now = new Date()
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

    for (const file of files) {
      const basename = path.basename(file).toLowerCase()
      
      // Pattern-based obsolete detection
      const obsoletePatterns = [
        /\.log$/,
        /error.*\.txt$/,
        /debug.*\.(txt|log)$/,
        /temp.*\./,
        /backup.*\./,
        /old.*\./,
        /deprecated.*\./,
        /archive.*\./,
        /\.bak$/,
        /\.tmp$/,
        /analysis.*\.json$/,
        /report.*\.json$/,
        /complexity.*\.json$/,
        /refactoring.*\.json$/
      ]

      const isObsoletePattern = obsoletePatterns.some(pattern => 
        pattern.test(basename) || pattern.test(file)
      )

      if (isObsoletePattern) {
        try {
          const fullPath = path.join(this.projectRoot, file)
          const stats = await fs.promises.stat(fullPath)
          
          // If it's old and matches obsolete patterns, mark as obsolete
          if (stats.mtime < oneMonthAgo || isObsoletePattern) {
            obsoleteFiles.push(file)
          }
        } catch (error) {
          // If we can't stat it, it might already be gone
          obsoleteFiles.push(file)
        }
      }
    }

    return obsoleteFiles
  }

  private shouldExclude(relativePath: string): boolean {
    return this.excludePatterns.some(pattern => pattern.test(relativePath))
  }
}