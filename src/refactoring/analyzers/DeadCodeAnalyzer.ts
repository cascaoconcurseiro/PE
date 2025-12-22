/**
 * Dead Code Analyzer
 * Identifies unused imports, components, hooks, and types
 */

import { Project, SourceFile, SyntaxKind, Node } from 'ts-morph';
import { DeadCodeReport, UnusedImport, OrphanedComponent, UnusedHook, UnusedType, CodeLocation } from '../types';

function getCodeLocation(node: Node): CodeLocation {
  const sourceFile = node.getSourceFile();
  const start = node.getStart();
  const end = node.getEnd();
  const startLineAndColumn = sourceFile.getLineAndColumnAtPos(start);
  const endLineAndColumn = sourceFile.getLineAndColumnAtPos(end);
  
  return {
    filePath: sourceFile.getFilePath(),
    startLine: startLineAndColumn.line,
    endLine: endLineAndColumn.line,
    startColumn: startLineAndColumn.column,
    endColumn: endLineAndColumn.column
  };
}

function findUnusedImports(project: Project): UnusedImport[] {
  const unusedImports: UnusedImport[] = [];
  const sourceFiles = project.getSourceFiles();

  for (const sourceFile of sourceFiles) {
    // Skip declaration files and test files
    if (sourceFile.isDeclarationFile() || sourceFile.getFilePath().includes('.test.') || sourceFile.getFilePath().includes('.spec.')) {
      continue;
    }

    const importDeclarations = sourceFile.getImportDeclarations();
    
    for (const importDecl of importDeclarations) {
      const moduleSpecifier = importDecl.getModuleSpecifierValue();
      const namedImports = importDecl.getNamedImports();
      const defaultImport = importDecl.getDefaultImport();
      const namespaceImport = importDecl.getNamespaceImport();

      // Check named imports
      for (const namedImport of namedImports) {
        const importName = namedImport.getName();
        const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
        
        // Count usages (excluding the import declaration itself)
        const usageCount = identifiers.filter(id => 
          id.getText() === importName && 
          !id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        ).length;

        if (usageCount === 0) {
          unusedImports.push({
            importName,
            location: getCodeLocation(namedImport),
            modulePath: moduleSpecifier,
            isTypeOnly: importDecl.isTypeOnly() || namedImport.isTypeOnly()
          });
        }
      }

      // Check default import
      if (defaultImport) {
        const importName = defaultImport.getText();
        const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
        
        const usageCount = identifiers.filter(id => 
          id.getText() === importName && 
          !id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        ).length;

        if (usageCount === 0) {
          unusedImports.push({
            importName,
            location: getCodeLocation(defaultImport),
            modulePath: moduleSpecifier,
            isTypeOnly: importDecl.isTypeOnly()
          });
        }
      }

      // Check namespace import
      if (namespaceImport) {
        const importName = namespaceImport.getText();
        const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
        
        const usageCount = identifiers.filter(id => 
          id.getText() === importName && 
          !id.getFirstAncestorByKind(SyntaxKind.ImportDeclaration)
        ).length;

        if (usageCount === 0) {
          unusedImports.push({
            importName,
            location: getCodeLocation(namespaceImport),
            modulePath: moduleSpecifier,
            isTypeOnly: importDecl.isTypeOnly()
          });
        }
      }
    }
  }

  return unusedImports;
}

function findOrphanedComponents(project: Project): OrphanedComponent[] {
  const orphanedComponents: OrphanedComponent[] = [];
  const sourceFiles = project.getSourceFiles();

  // Build a map of all component usages across the project
  const componentUsages = new Map<string, number>();
  
  for (const sourceFile of sourceFiles) {
    const jsxElements = sourceFile.getDescendantsOfKind(SyntaxKind.JsxOpeningElement);
    const jsxSelfClosing = sourceFile.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
    
    [...jsxElements, ...jsxSelfClosing].forEach(element => {
      const tagName = element.getTagNameNode().getText();
      componentUsages.set(tagName, (componentUsages.get(tagName) || 0) + 1);
    });
  }

  // Find all component definitions
  for (const sourceFile of sourceFiles) {
    // Skip non-component files
    if (!sourceFile.getFilePath().match(/\.(tsx|jsx)$/)) {
      continue;
    }

    // Find function components
    const functionDeclarations = sourceFile.getFunctions();
    const variableStatements = sourceFile.getVariableStatements();
    
    for (const func of functionDeclarations) {
      const name = func.getName();
      if (name && /^[A-Z]/.test(name)) { // Component names start with uppercase
        const isExported = func.isExported();
        const usageCount = componentUsages.get(name) || 0;
        
        // Check if used only in test files
        const usedOnlyInTests = usageCount === 0 && sourceFiles.some(sf => 
          (sf.getFilePath().includes('.test.') || sf.getFilePath().includes('.spec.')) &&
          sf.getText().includes(name)
        );

        if (usageCount === 0 && !usedOnlyInTests) {
          orphanedComponents.push({
            componentName: name,
            location: getCodeLocation(func),
            isExported,
            usedOnlyInTests
          });
        }
      }
    }

    // Find arrow function components
    for (const varStatement of variableStatements) {
      const declarations = varStatement.getDeclarations();
      for (const decl of declarations) {
        const name = decl.getName();
        if (/^[A-Z]/.test(name)) {
          const initializer = decl.getInitializer();
          if (initializer && Node.isArrowFunction(initializer)) {
            const isExported = varStatement.isExported();
            const usageCount = componentUsages.get(name) || 0;
            
            const usedOnlyInTests = usageCount === 0 && sourceFiles.some(sf => 
              (sf.getFilePath().includes('.test.') || sf.getFilePath().includes('.spec.')) &&
              sf.getText().includes(name)
            );

            if (usageCount === 0 && !usedOnlyInTests) {
              orphanedComponents.push({
                componentName: name,
                location: getCodeLocation(decl),
                isExported,
                usedOnlyInTests
              });
            }
          }
        }
      }
    }
  }

  return orphanedComponents;
}

function findUnusedHooks(project: Project): UnusedHook[] {
  const unusedHooks: UnusedHook[] = [];
  const sourceFiles = project.getSourceFiles();

  // Build a map of all hook usages
  const hookUsages = new Map<string, number>();
  
  for (const sourceFile of sourceFiles) {
    const identifiers = sourceFile.getDescendantsOfKind(SyntaxKind.Identifier);
    identifiers.forEach(id => {
      const text = id.getText();
      if (text.startsWith('use') && /^use[A-Z]/.test(text)) {
        hookUsages.set(text, (hookUsages.get(text) || 0) + 1);
      }
    });
  }

  // Find all custom hook definitions
  for (const sourceFile of sourceFiles) {
    const functionDeclarations = sourceFile.getFunctions();
    const variableStatements = sourceFile.getVariableStatements();
    
    for (const func of functionDeclarations) {
      const name = func.getName();
      if (name && /^use[A-Z]/.test(name)) {
        const usageCount = hookUsages.get(name) || 0;
        
        if (usageCount <= 1) { // Only the definition itself
          unusedHooks.push({
            hookName: name,
            location: getCodeLocation(func),
            isCustomHook: true,
            dependencies: [] // TODO: Extract dependencies from hook body
          });
        }
      }
    }

    for (const varStatement of variableStatements) {
      const declarations = varStatement.getDeclarations();
      for (const decl of declarations) {
        const name = decl.getName();
        if (/^use[A-Z]/.test(name)) {
          const usageCount = hookUsages.get(name) || 0;
          
          if (usageCount <= 1) { // Only the definition itself
            unusedHooks.push({
              hookName: name,
              location: getCodeLocation(decl),
              isCustomHook: true,
              dependencies: []
            });
          }
        }
      }
    }
  }

  return unusedHooks;
}

function findUnusedTypes(project: Project): UnusedType[] {
  const unusedTypes: UnusedType[] = [];
  const sourceFiles = project.getSourceFiles();

  // Build a map of all type usages
  const typeUsages = new Map<string, number>();
  
  for (const sourceFile of sourceFiles) {
    const typeReferences = sourceFile.getDescendantsOfKind(SyntaxKind.TypeReference);
    typeReferences.forEach(ref => {
      const typeName = ref.getTypeName().getText();
      typeUsages.set(typeName, (typeUsages.get(typeName) || 0) + 1);
    });
  }

  // Find all type definitions
  for (const sourceFile of sourceFiles) {
    // Skip declaration files
    if (sourceFile.isDeclarationFile()) {
      continue;
    }

    // Find interfaces
    const interfaces = sourceFile.getInterfaces();
    for (const iface of interfaces) {
      const name = iface.getName();
      const usageCount = typeUsages.get(name) || 0;
      
      if (usageCount === 0) {
        unusedTypes.push({
          typeName: name,
          location: getCodeLocation(iface),
          kind: 'interface',
          isExported: iface.isExported()
        });
      }
    }

    // Find type aliases
    const typeAliases = sourceFile.getTypeAliases();
    for (const typeAlias of typeAliases) {
      const name = typeAlias.getName();
      const usageCount = typeUsages.get(name) || 0;
      
      if (usageCount === 0) {
        unusedTypes.push({
          typeName: name,
          location: getCodeLocation(typeAlias),
          kind: 'type',
          isExported: typeAlias.isExported()
        });
      }
    }

    // Find enums
    const enums = sourceFile.getEnums();
    for (const enumDecl of enums) {
      const name = enumDecl.getName();
      const usageCount = typeUsages.get(name) || 0;
      
      if (usageCount === 0) {
        unusedTypes.push({
          typeName: name,
          location: getCodeLocation(enumDecl),
          kind: 'enum',
          isExported: enumDecl.isExported()
        });
      }
    }
  }

  return unusedTypes;
}

export async function analyzeDeadCode(project: Project): Promise<DeadCodeReport> {
  console.log('🔍 Analyzing dead code...');
  
  const unusedImports = findUnusedImports(project);
  const orphanedComponents = findOrphanedComponents(project);
  const unusedHooks = findUnusedHooks(project);
  const unusedTypes = findUnusedTypes(project);

  // Calculate total savings
  const totalLinesOfCode = unusedImports.length + 
    orphanedComponents.length * 10 + // Assume average component is 10 lines
    unusedHooks.length * 15 + // Assume average hook is 15 lines
    unusedTypes.length * 5; // Assume average type is 5 lines

  const affectedFiles = new Set([
    ...unusedImports.map(i => i.location.filePath),
    ...orphanedComponents.map(c => c.location.filePath),
    ...unusedHooks.map(h => h.location.filePath),
    ...unusedTypes.map(t => t.location.filePath)
  ]);

  console.log(`  ✓ Found ${unusedImports.length} unused imports`);
  console.log(`  ✓ Found ${orphanedComponents.length} orphaned components`);
  console.log(`  ✓ Found ${unusedHooks.length} unused hooks`);
  console.log(`  ✓ Found ${unusedTypes.length} unused types`);
  
  return {
    unusedImports,
    orphanedComponents,
    unusedHooks,
    unusedTypes,
    totalSavings: {
      linesOfCode: totalLinesOfCode,
      bundleSize: totalLinesOfCode * 50, // Rough estimate: 50 bytes per line
      files: affectedFiles.size
    }
  };
}