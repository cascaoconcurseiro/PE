/**
 * DependencyAnalyzer - Analyzes import/export dependencies and circular dependencies
 * Implements Requirements 4.1, 4.2, 4.3, 4.4
 */

import { Project, SourceFile, Node, SyntaxKind } from 'ts-morph';
import { DependencyReport, CircularDependency, UnusedDependency, DependencyGraph } from '../types';
import * as path from 'path';

/**
 * Analyzes dependencies in a TypeScript/React project
 */
export async function analyzeDependencies(project: Project): Promise<DependencyReport> {
  console.log('🔍 Analyzing dependencies...');
  
  const sourceFiles = getSourceFiles(project);
  const dependencyGraph = buildDependencyGraph(sourceFiles);
  const circularDependencies = findCircularDependencies(dependencyGraph);
  const unusedDependencies = findUnusedDependencies(sourceFiles, dependencyGraph);
  const externalDependencies = analyzeExternalDependencies(sourceFiles);
  
  return {
    dependencyGraph,
    circularDependencies,
    unusedDependencies,
    externalDependencies,
    totalFiles: sourceFiles.length,
    totalDependencies: Object.keys(dependencyGraph).length
  };
}

/**
 * Gets source files from the project
 */
function getSourceFiles(project: Project): SourceFile[] {
  return project.getSourceFiles().filter(sf => {
    const filePath = sf.getFilePath();
    return filePath.includes('/src/') && 
           !filePath.includes('/node_modules/') &&
           !filePath.includes('/.kiro/') &&
           (filePath.endsWith('.ts') || filePath.endsWith('.tsx'));
  });
}

/**
 * Builds a dependency graph from source files
 */
function buildDependencyGraph(sourceFiles: SourceFile[]): DependencyGraph {
  const graph: DependencyGraph = {};
  
  for (const sourceFile of sourceFiles) {
    const filePath = normalizeFilePath(sourceFile.getFilePath());
    const dependencies = extractFileDependencies(sourceFile);
    
    graph[filePath] = {
      filePath,
      dependencies: dependencies.internal,
      externalDependencies: dependencies.external,
      exports: extractExports(sourceFile),
      imports: extractImports(sourceFile)
    };
  }
  
  return graph;
}

/**
 * Extracts dependencies from a source file
 */
function extractFileDependencies(sourceFile: SourceFile): {
  internal: string[];
  external: string[];
} {
  const internal: string[] = [];
  const external: string[] = [];
  const sourceDir = path.dirname(sourceFile.getFilePath());
  
  // Get all import declarations
  const importDeclarations = sourceFile.getImportDeclarations();
  
  for (const importDecl of importDeclarations) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    
    if (isRelativeImport(moduleSpecifier)) {
      // Internal dependency - resolve relative path
      const resolvedPath = resolveRelativePath(sourceDir, moduleSpecifier);
      if (resolvedPath) {
        internal.push(normalizeFilePath(resolvedPath));
      }
    } else {
      // External dependency
      external.push(moduleSpecifier);
    }
  }
  
  return { internal, external };
}

/**
 * Extracts exports from a source file
 */
function extractExports(sourceFile: SourceFile): string[] {
  const exports: string[] = [];
  
  // Named exports
  const exportDeclarations = sourceFile.getExportDeclarations();
  for (const exportDecl of exportDeclarations) {
    const namedExports = exportDecl.getNamedExports();
    for (const namedExport of namedExports) {
      exports.push(namedExport.getName());
    }
  }
  
  // Export assignments
  const exportAssignments = sourceFile.getExportAssignments();
  for (const exportAssign of exportAssignments) {
    if (exportAssign.isExportEquals()) {
      exports.push('default');
    }
  }
  
  // Default exports
  const functions = sourceFile.getFunctions();
  const classes = sourceFile.getClasses();
  const variables = sourceFile.getVariableDeclarations();
  
  for (const func of functions) {
    if (func.isDefaultExport()) {
      exports.push('default');
    } else if (func.isExported()) {
      exports.push(func.getName() || 'anonymous');
    }
  }
  
  for (const cls of classes) {
    if (cls.isDefaultExport()) {
      exports.push('default');
    } else if (cls.isExported()) {
      exports.push(cls.getName() || 'anonymous');
    }
  }
  
  for (const variable of variables) {
    const statement = variable.getVariableStatement();
    if (statement?.isDefaultExport()) {
      exports.push('default');
    } else if (statement?.isExported()) {
      exports.push(variable.getName());
    }
  }
  
  return [...new Set(exports)]; // Remove duplicates
}

/**
 * Extracts imports from a source file
 */
function extractImports(sourceFile: SourceFile): Array<{ name: string; from: string; isDefault: boolean }> {
  const imports: Array<{ name: string; from: string; isDefault: boolean }> = [];
  
  const importDeclarations = sourceFile.getImportDeclarations();
  for (const importDecl of importDeclarations) {
    const moduleSpecifier = importDecl.getModuleSpecifierValue();
    
    // Default import
    const defaultImport = importDecl.getDefaultImport();
    if (defaultImport) {
      imports.push({
        name: defaultImport.getText(),
        from: moduleSpecifier,
        isDefault: true
      });
    }
    
    // Named imports
    const namedImports = importDecl.getNamedImports();
    for (const namedImport of namedImports) {
      imports.push({
        name: namedImport.getName(),
        from: moduleSpecifier,
        isDefault: false
      });
    }
    
    // Namespace import
    const namespaceImport = importDecl.getNamespaceImport();
    if (namespaceImport) {
      imports.push({
        name: namespaceImport.getText(),
        from: moduleSpecifier,
        isDefault: false
      });
    }
  }
  
  return imports;
}

/**
 * Finds circular dependencies using DFS
 */
function findCircularDependencies(graph: DependencyGraph): CircularDependency[] {
  const visited = new Set<string>();
  const recursionStack = new Set<string>();
  const cycles: CircularDependency[] = [];
  
  function dfs(filePath: string, path: string[]): void {
    if (recursionStack.has(filePath)) {
      // Found a cycle
      const cycleStart = path.indexOf(filePath);
      const cyclePath = [...path.slice(cycleStart), filePath];
      
      cycles.push({
        files: cyclePath,
        severity: calculateCycleSeverity(cyclePath, graph),
        description: `Circular dependency detected: ${cyclePath.join(' → ')}`
      });
      return;
    }
    
    if (visited.has(filePath)) {
      return;
    }
    
    visited.add(filePath);
    recursionStack.add(filePath);
    
    const node = graph[filePath];
    if (node) {
      for (const dependency of node.dependencies) {
        dfs(dependency, [...path, filePath]);
      }
    }
    
    recursionStack.delete(filePath);
  }
  
  for (const filePath of Object.keys(graph)) {
    if (!visited.has(filePath)) {
      dfs(filePath, []);
    }
  }
  
  return cycles;
}

/**
 * Calculates the severity of a circular dependency
 */
function calculateCycleSeverity(cyclePath: string[], graph: DependencyGraph): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
  const cycleLength = cyclePath.length - 1; // Subtract 1 because last element is duplicate of first
  
  // Check if any files in the cycle are core/critical files
  const hasCoreFiles = cyclePath.some(filePath => 
    filePath.includes('index.') || 
    filePath.includes('App.') ||
    filePath.includes('main.') ||
    filePath.includes('config.')
  );
  
  // Check complexity of files in cycle
  const totalDependencies = cyclePath.reduce((sum, filePath) => {
    const node = graph[filePath];
    return sum + (node ? node.dependencies.length + node.externalDependencies.length : 0);
  }, 0);
  
  if (hasCoreFiles || cycleLength > 5) {
    return 'CRITICAL';
  } else if (cycleLength > 3 || totalDependencies > 20) {
    return 'HIGH';
  } else if (cycleLength > 2 || totalDependencies > 10) {
    return 'MEDIUM';
  } else {
    return 'LOW';
  }
}

/**
 * Finds unused dependencies
 */
function findUnusedDependencies(sourceFiles: SourceFile[], graph: DependencyGraph): UnusedDependency[] {
  const unused: UnusedDependency[] = [];
  
  // Check each file for unused imports
  for (const sourceFile of sourceFiles) {
    const filePath = normalizeFilePath(sourceFile.getFilePath());
    const node = graph[filePath];
    
    if (node) {
      // Check if imports are actually used in the file
      const fileText = sourceFile.getFullText();
      
      for (const importInfo of node.imports) {
        // Skip checking usage for side-effect imports
        if (importInfo.name === '*' || importInfo.name === '') {
          continue;
        }
        
        // Check if the imported name is used in the file
        const importName = importInfo.name;
        const isUsed = checkImportUsage(fileText, importName, sourceFile);
        
        if (!isUsed) {
          unused.push({
            filePath,
            importName,
            from: importInfo.from,
            reason: `Import '${importName}' is declared but never used`,
            suggestion: `Remove unused import: import { ${importName} } from '${importInfo.from}'`
          });
        }
      }
    }
  }
  
  return unused;
}

/**
 * Checks if an import is actually used in the file
 */
function checkImportUsage(fileText: string, importName: string, sourceFile: SourceFile): boolean {
  // Remove the import statement itself from the search
  const importRegex = new RegExp(`import\\s+.*${importName}.*from`, 'g');
  const textWithoutImports = fileText.replace(importRegex, '');
  
  // Look for usage of the imported name
  const usageRegex = new RegExp(`\\b${importName}\\b`, 'g');
  const matches = textWithoutImports.match(usageRegex);
  
  return matches && matches.length > 0;
}

/**
 * Analyzes external dependencies
 */
function analyzeExternalDependencies(sourceFiles: SourceFile[]): Array<{ name: string; usageCount: number; files: string[] }> {
  const externalDeps = new Map<string, { count: number; files: Set<string> }>();
  
  for (const sourceFile of sourceFiles) {
    const filePath = normalizeFilePath(sourceFile.getFilePath());
    const importDeclarations = sourceFile.getImportDeclarations();
    
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      
      if (!isRelativeImport(moduleSpecifier)) {
        // Extract package name (handle scoped packages)
        const packageName = extractPackageName(moduleSpecifier);
        
        if (!externalDeps.has(packageName)) {
          externalDeps.set(packageName, { count: 0, files: new Set() });
        }
        
        const dep = externalDeps.get(packageName)!;
        dep.count++;
        dep.files.add(filePath);
      }
    }
  }
  
  return Array.from(externalDeps.entries()).map(([name, data]) => ({
    name,
    usageCount: data.count,
    files: Array.from(data.files)
  }));
}

// Utility functions

function isRelativeImport(moduleSpecifier: string): boolean {
  return moduleSpecifier.startsWith('./') || moduleSpecifier.startsWith('../');
}

function normalizeFilePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

function resolveRelativePath(sourceDir: string, relativePath: string): string | null {
  try {
    // For in-memory file system, we need to handle paths differently
    const resolved = path.posix.join(sourceDir, relativePath);
    
    // Try common extensions if no extension provided
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    for (const ext of extensions) {
      const withExt = resolved + ext;
      // Return the path with extension
      return withExt;
    }
    
    return resolved + '.ts'; // Default to .ts
  } catch {
    return null;
  }
}

function extractPackageName(moduleSpecifier: string): string {
  // Handle scoped packages like @types/node
  if (moduleSpecifier.startsWith('@')) {
    const parts = moduleSpecifier.split('/');
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : moduleSpecifier;
  }
  
  // Handle regular packages
  const parts = moduleSpecifier.split('/');
  return parts[0];
}