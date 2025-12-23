/**
 * Dependency Analyzer - Detects references and dependencies between files
 */

import * as fs from 'fs'
import * as path from 'path'
import { DependencyGraph, DependencyEdge } from './types'

export class DependencyAnalyzer {
  private readonly projectRoot: string

  constructor(projectRoot: string = process.cwd()) {
    this.projectRoot = projectRoot
  }

  /**
   * Analyzes dependencies between files
   */
  async analyzeDependencies(files: string[]): Promise<DependencyGraph> {
    const edges: DependencyEdge[] = []
    const nodes = new Set<string>()

    for (const file of files) {
      nodes.add(file)
      const dependencies = await this.findFileDependencies(file)
      edges.push(...dependencies)
    }

    return {
      nodes: Array.from(nodes),
      edges
    }
  }

  /**
   * Finds all dependencies for a specific file
   */
  private async findFileDependencies(filePath: string): Promise<DependencyEdge[]> {
    const edges: DependencyEdge[] = []
    
    try {
      const fullPath = path.join(this.projectRoot, filePath)
      const content = await fs.promises.readFile(fullPath, 'utf-8')
      const ext = path.extname(filePath).toLowerCase()

      // Analyze based on file type
      if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
        edges.push(...this.analyzeJavaScriptDependencies(filePath, content))
      } else if (ext === '.json') {
        edges.push(...this.analyzeJsonDependencies(filePath, content))
      } else if (ext === '.md') {
        edges.push(...this.analyzeMarkdownDependencies(filePath, content))
      } else if (ext === '.sh' || ext === '.bat' || ext === '.ps1') {
        edges.push(...this.analyzeScriptDependencies(filePath, content))
      }

    } catch (error) {
      console.warn(`Warning: Could not analyze dependencies for ${filePath}:`, error)
    }

    return edges
  }

  /**
   * Analyzes JavaScript/TypeScript import dependencies
   */
  private analyzeJavaScriptDependencies(filePath: string, content: string): DependencyEdge[] {
    const edges: DependencyEdge[] = []
    
    // Import statements
    const importRegex = /import\s+.*?\s+from\s+['"`]([^'"`]+)['"`]/g
    let match
    while ((match = importRegex.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath.startsWith('.')) {
        // Relative import
        const resolvedPath = this.resolveRelativePath(filePath, importPath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'import'
          })
        }
      }
    }

    // Require statements
    const requireRegex = /require\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    while ((match = requireRegex.exec(content)) !== null) {
      const requirePath = match[1]
      if (requirePath.startsWith('.')) {
        const resolvedPath = this.resolveRelativePath(filePath, requirePath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'import'
          })
        }
      }
    }

    // Dynamic imports
    const dynamicImportRegex = /import\s*\(\s*['"`]([^'"`]+)['"`]\s*\)/g
    while ((match = dynamicImportRegex.exec(content)) !== null) {
      const importPath = match[1]
      if (importPath.startsWith('.')) {
        const resolvedPath = this.resolveRelativePath(filePath, importPath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'import'
          })
        }
      }
    }

    // File references in comments or strings
    const fileRefRegex = /['"`]([^'"`]*\.(ts|tsx|js|jsx|json|md)['"`])/g
    while ((match = fileRefRegex.exec(content)) !== null) {
      const refPath = match[1]
      if (refPath.startsWith('.')) {
        const resolvedPath = this.resolveRelativePath(filePath, refPath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'reference'
          })
        }
      }
    }

    return edges
  }

  /**
   * Analyzes JSON configuration dependencies
   */
  private analyzeJsonDependencies(filePath: string, content: string): DependencyEdge[] {
    const edges: DependencyEdge[] = []
    
    try {
      const json = JSON.parse(content)
      
      // Package.json scripts
      if (json.scripts) {
        for (const [scriptName, scriptCommand] of Object.entries(json.scripts)) {
          if (typeof scriptCommand === 'string') {
            // Look for file references in scripts
            const fileRefs = this.extractFileReferencesFromScript(scriptCommand as string)
            for (const ref of fileRefs) {
              const resolvedPath = this.resolveRelativePath(filePath, ref)
              if (resolvedPath) {
                edges.push({
                  from: filePath,
                  to: resolvedPath,
                  type: 'script-call'
                })
              }
            }
          }
        }
      }

      // Configuration file references
      const configKeys = ['extends', 'include', 'exclude', 'files', 'references']
      for (const key of configKeys) {
        if (json[key]) {
          const refs = Array.isArray(json[key]) ? json[key] : [json[key]]
          for (const ref of refs) {
            if (typeof ref === 'string' && ref.startsWith('.')) {
              const resolvedPath = this.resolveRelativePath(filePath, ref)
              if (resolvedPath) {
                edges.push({
                  from: filePath,
                  to: resolvedPath,
                  type: 'config-reference'
                })
              }
            }
          }
        }
      }

    } catch (error) {
      // Invalid JSON, skip
    }

    return edges
  }

  /**
   * Analyzes Markdown file references
   */
  private analyzeMarkdownDependencies(filePath: string, content: string): DependencyEdge[] {
    const edges: DependencyEdge[] = []
    
    // Markdown links
    const linkRegex = /\[([^\]]*)\]\(([^)]+)\)/g
    let match
    while ((match = linkRegex.exec(content)) !== null) {
      const linkPath = match[2]
      if (linkPath.startsWith('.') && !linkPath.startsWith('http')) {
        const resolvedPath = this.resolveRelativePath(filePath, linkPath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'reference'
          })
        }
      }
    }

    // File references in code blocks or text
    const fileRefRegex = /`([^`]*\.(ts|tsx|js|jsx|json|md|sql))`/g
    while ((match = fileRefRegex.exec(content)) !== null) {
      const refPath = match[1]
      if (refPath.startsWith('.')) {
        const resolvedPath = this.resolveRelativePath(filePath, refPath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'reference'
          })
        }
      }
    }

    return edges
  }

  /**
   * Analyzes script file dependencies
   */
  private analyzeScriptDependencies(filePath: string, content: string): DependencyEdge[] {
    const edges: DependencyEdge[] = []
    
    // Script file calls
    const scriptCallRegex = /(?:\.\/|\.\.\/|bash\s+|sh\s+|node\s+|npm\s+run\s+)([^\s]+)/g
    let match
    while ((match = scriptCallRegex.exec(content)) !== null) {
      const scriptPath = match[1]
      if (scriptPath.startsWith('.')) {
        const resolvedPath = this.resolveRelativePath(filePath, scriptPath)
        if (resolvedPath) {
          edges.push({
            from: filePath,
            to: resolvedPath,
            type: 'script-call'
          })
        }
      }
    }

    return edges
  }

  /**
   * Extracts file references from script commands
   */
  private extractFileReferencesFromScript(script: string): string[] {
    const refs: string[] = []
    
    // Look for file paths in script commands
    const filePathRegex = /(?:^|\s)(\.\/[^\s]+|\.\.\/[^\s]+)/g
    let match
    while ((match = filePathRegex.exec(script)) !== null) {
      refs.push(match[1])
    }

    return refs
  }

  /**
   * Resolves relative path to absolute path within project
   */
  private resolveRelativePath(fromFile: string, relativePath: string): string | null {
    try {
      const fromDir = path.dirname(fromFile)
      const resolved = path.resolve(fromDir, relativePath)
      const relative = path.relative(this.projectRoot, resolved)
      
      // Ensure it's within the project
      if (relative.startsWith('..')) {
        return null
      }

      // Try different extensions if file doesn't exist
      const extensions = ['', '.ts', '.tsx', '.js', '.jsx', '.json', '.md']
      for (const ext of extensions) {
        const withExt = relative + ext
        const fullPath = path.join(this.projectRoot, withExt)
        if (fs.existsSync(fullPath)) {
          return withExt
        }
      }

      return relative
    } catch (error) {
      return null
    }
  }

  /**
   * Checks if a file is referenced by any other files
   */
  isFileReferenced(filePath: string, dependencyGraph: DependencyGraph): boolean {
    return dependencyGraph.edges.some(edge => edge.to === filePath)
  }

  /**
   * Gets all files that reference a specific file
   */
  getReferencingFiles(filePath: string, dependencyGraph: DependencyGraph): string[] {
    return dependencyGraph.edges
      .filter(edge => edge.to === filePath)
      .map(edge => edge.from)
  }
}