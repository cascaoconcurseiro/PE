/**
 * Complexity Analyzer
 * Analyzes component complexity and suggests decomposition
 */

import { Project, SourceFile, SyntaxKind, Node, FunctionDeclaration, VariableDeclaration } from 'ts-morph';
import { ComplexityReport, ComponentComplexity, Responsibility, DecompositionSuggestion, CodeLocation } from '../types';

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

function calculateCyclomaticComplexity(node: Node): number {
  let complexity = 1; // Base complexity
  
  // Count decision points that increase complexity
  const descendants = node.getDescendants();
  
  for (const descendant of descendants) {
    switch (descendant.getKind()) {
      case SyntaxKind.IfStatement:
      case SyntaxKind.ConditionalExpression: // ternary operator
      case SyntaxKind.SwitchStatement:
      case SyntaxKind.CaseClause:
      case SyntaxKind.WhileStatement:
      case SyntaxKind.DoStatement:
      case SyntaxKind.ForStatement:
      case SyntaxKind.ForInStatement:
      case SyntaxKind.ForOfStatement:
      case SyntaxKind.CatchClause:
        complexity++;
        break;
      case SyntaxKind.BinaryExpression:
        // Count logical operators (&&, ||) as decision points
        const binaryExpr = descendant.asKindOrThrow(SyntaxKind.BinaryExpression);
        const operator = binaryExpr.getOperatorToken().getKind();
        if (operator === SyntaxKind.AmpersandAmpersandToken || operator === SyntaxKind.BarBarToken) {
          complexity++;
        }
        break;
    }
  }
  
  return complexity;
}

function countLinesOfCode(node: Node): number {
  const text = node.getFullText();
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  return lines.length;
}

function analyzeComponentProps(node: Node): number {
  let propsCount = 0;
  
  // For function components, look at parameters
  if (Node.isFunctionDeclaration(node) || Node.isArrowFunction(node)) {
    const parameters = node.getParameters();
    if (parameters.length > 0) {
      const firstParam = parameters[0];
      const typeNode = firstParam.getTypeNode();
      
      if (typeNode && typeNode.getKind() === SyntaxKind.TypeLiteralNode) {
        propsCount = typeNode.asKindOrThrow(SyntaxKind.TypeLiteralNode).getMembers().length;
      } else if (typeNode && typeNode.getKind() === SyntaxKind.TypeReferenceNode) {
        // Try to resolve the interface/type
        const typeName = typeNode.getTypeName().getText();
        const sourceFile = node.getSourceFile();
        
        // Look for interface definition
        const interfaces = sourceFile.getInterfaces();
        const matchingInterface = interfaces.find(iface => iface.getName() === typeName);
        if (matchingInterface) {
          propsCount = matchingInterface.getProperties().length;
        }
        
        // Look for type alias
        const typeAliases = sourceFile.getTypeAliases();
        const matchingType = typeAliases.find(type => type.getName() === typeName);
        if (matchingType && matchingType.getTypeNode()?.getKind() === SyntaxKind.TypeLiteralNode) {
          propsCount = matchingType.getTypeNode()!.asKindOrThrow(SyntaxKind.TypeLiteralNode).getMembers().length;
        }
      }
    }
  }
  
  return propsCount;
}

function countHookUsages(node: Node): number {
  let hookCount = 0;
  
  const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const call of callExpressions) {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (name.startsWith('use') && /^use[A-Z]/.test(name)) {
        hookCount++;
      }
    }
  }
  
  return hookCount;
}

function countJSXChildren(node: Node): number {
  const jsxElements = node.getDescendantsOfKind(SyntaxKind.JsxElement);
  const jsxSelfClosing = node.getDescendantsOfKind(SyntaxKind.JsxSelfClosingElement);
  return jsxElements.length + jsxSelfClosing.length;
}

function analyzeResponsibilities(node: Node): Responsibility[] {
  const responsibilities: Responsibility[] = [];
  
  // Analyze different types of responsibilities
  const stateManagement = analyzeStateManagement(node);
  const dataFetching = analyzeDataFetching(node);
  const eventHandling = analyzeEventHandling(node);
  const businessLogic = analyzeBusinessLogic(node);
  
  if (stateManagement.linesOfCode > 0) {
    responsibilities.push(stateManagement);
  }
  if (dataFetching.linesOfCode > 0) {
    responsibilities.push(dataFetching);
  }
  if (eventHandling.linesOfCode > 0) {
    responsibilities.push(eventHandling);
  }
  if (businessLogic.linesOfCode > 0) {
    responsibilities.push(businessLogic);
  }
  
  // UI Rendering is always present in React components
  responsibilities.push({
    type: 'UI_RENDERING',
    description: 'Renders JSX elements and manages component structure',
    linesOfCode: Math.max(1, countJSXChildren(node) / 5) // Rough estimate
  });
  
  return responsibilities;
}

function analyzeStateManagement(node: Node): Responsibility {
  let linesOfCode = 0;
  
  // Count useState, useReducer, useContext calls
  const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const call of callExpressions) {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (['useState', 'useReducer', 'useContext', 'useRef'].includes(name)) {
        linesOfCode += 2; // Estimate 2 lines per state hook
      }
    }
  }
  
  return {
    type: 'STATE_MANAGEMENT',
    description: 'Manages component state using hooks',
    linesOfCode
  };
}

function analyzeDataFetching(node: Node): Responsibility {
  let linesOfCode = 0;
  
  // Look for useEffect with data fetching patterns
  const callExpressions = node.getDescendantsOfKind(SyntaxKind.CallExpression);
  
  for (const call of callExpressions) {
    const expression = call.getExpression();
    if (Node.isIdentifier(expression)) {
      const name = expression.getText();
      if (['useEffect', 'useMemo', 'useCallback'].includes(name)) {
        // Check if it contains fetch, axios, or async patterns
        const callText = call.getText();
        if (callText.includes('fetch') || callText.includes('axios') || callText.includes('async') || callText.includes('await')) {
          linesOfCode += 5; // Estimate 5 lines per data fetching effect
        }
      }
    }
  }
  
  return {
    type: 'DATA_FETCHING',
    description: 'Fetches and manages external data',
    linesOfCode
  };
}

function analyzeEventHandling(node: Node): Responsibility {
  let linesOfCode = 0;
  
  // Count event handler functions
  const functionDeclarations = node.getDescendantsOfKind(SyntaxKind.FunctionDeclaration);
  const arrowFunctions = node.getDescendantsOfKind(SyntaxKind.ArrowFunction);
  const variableDeclarations = node.getDescendantsOfKind(SyntaxKind.VariableDeclaration);
  
  [...functionDeclarations, ...arrowFunctions].forEach(func => {
    const name = Node.isFunctionDeclaration(func) ? func.getName() : '';
    if (name && (name.startsWith('handle') || name.startsWith('on'))) {
      linesOfCode += countLinesOfCode(func);
    }
  });
  
  variableDeclarations.forEach(varDecl => {
    const name = varDecl.getName();
    if (name.startsWith('handle') || name.startsWith('on')) {
      const initializer = varDecl.getInitializer();
      if (initializer && Node.isArrowFunction(initializer)) {
        linesOfCode += countLinesOfCode(initializer);
      }
    }
  });
  
  return {
    type: 'EVENT_HANDLING',
    description: 'Handles user interactions and events',
    linesOfCode
  };
}

function analyzeBusinessLogic(node: Node): Responsibility {
  let linesOfCode = 0;
  
  // Look for complex calculations, validations, transformations
  const descendants = node.getDescendants();
  
  for (const descendant of descendants) {
    // Count complex expressions and calculations
    if (Node.isBinaryExpression(descendant) || 
        Node.isConditionalExpression(descendant) ||
        Node.isCallExpression(descendant)) {
      
      const text = descendant.getText();
      // Look for business logic patterns
      if (text.includes('calculate') || 
          text.includes('validate') || 
          text.includes('transform') ||
          text.includes('format') ||
          text.includes('filter') ||
          text.includes('map') ||
          text.includes('reduce')) {
        linesOfCode += 1;
      }
    }
  }
  
  return {
    type: 'BUSINESS_LOGIC',
    description: 'Performs calculations, validations, and data transformations',
    linesOfCode
  };
}

function generateDecompositionSuggestions(complexity: ComponentComplexity): DecompositionSuggestion[] {
  const suggestions: DecompositionSuggestion[] = [];
  
  // Suggest extracting components if too many JSX children
  if (complexity.numberOfChildren > 10) {
    suggestions.push({
      type: 'EXTRACT_COMPONENT',
      description: `Extract sub-components from the ${complexity.numberOfChildren} JSX elements to reduce complexity`,
      extractedCode: '// Extract repeated JSX patterns into separate components',
      remainingCode: '// Keep main component structure with extracted components',
      benefits: ['Improved readability', 'Better reusability', 'Easier testing'],
      effort: 'MEDIUM'
    });
  }
  
  // Suggest extracting hooks if too many hook calls
  if (complexity.numberOfHooks > 8) {
    suggestions.push({
      type: 'EXTRACT_HOOK',
      description: `Extract custom hooks from the ${complexity.numberOfHooks} hook calls to simplify component`,
      extractedCode: '// Create custom hooks for related state and effects',
      remainingCode: '// Use custom hooks in component',
      benefits: ['Better separation of concerns', 'Improved testability', 'Hook reusability'],
      effort: 'MEDIUM'
    });
  }
  
  // Suggest splitting responsibilities if multiple concerns
  if (complexity.responsibilities.length > 3) {
    suggestions.push({
      type: 'SPLIT_RESPONSIBILITIES',
      description: `Split the ${complexity.responsibilities.length} different responsibilities into separate components`,
      extractedCode: '// Create focused components for each responsibility',
      remainingCode: '// Compose components together',
      benefits: ['Single Responsibility Principle', 'Easier maintenance', 'Better testing'],
      effort: 'HIGH'
    });
  }
  
  // Suggest extraction based on cyclomatic complexity
  if (complexity.cyclomaticComplexity > 15) {
    suggestions.push({
      type: 'EXTRACT_COMPONENT',
      description: `Reduce cyclomatic complexity (${complexity.cyclomaticComplexity}) by extracting conditional logic`,
      extractedCode: '// Extract complex conditional rendering into separate components',
      remainingCode: '// Simplify main component logic',
      benefits: ['Reduced complexity', 'Improved readability', 'Easier debugging'],
      effort: 'HIGH'
    });
  }
  
  return suggestions;
}

function analyzeComponent(node: Node, componentName: string): ComponentComplexity {
  const complexity: ComponentComplexity = {
    componentName,
    location: getCodeLocation(node),
    cyclomaticComplexity: calculateCyclomaticComplexity(node),
    linesOfCode: countLinesOfCode(node),
    numberOfProps: analyzeComponentProps(node),
    numberOfHooks: countHookUsages(node),
    numberOfChildren: countJSXChildren(node),
    responsibilities: analyzeResponsibilities(node),
    decompositionSuggestions: []
  };
  
  // Generate suggestions based on complexity metrics
  complexity.decompositionSuggestions = generateDecompositionSuggestions(complexity);
  
  return complexity;
}

export async function analyzeComplexity(project: Project): Promise<ComplexityReport> {
  console.log('🔍 Analyzing complexity...');
  
  const sourceFiles = project.getSourceFiles();
  const components: ComponentComplexity[] = [];
  
  for (const sourceFile of sourceFiles) {
    // Skip non-component files
    if (!sourceFile.getFilePath().match(/\.(tsx|jsx)$/)) {
      continue;
    }
    
    // Skip test files
    if (sourceFile.getFilePath().includes('.test.') || sourceFile.getFilePath().includes('.spec.')) {
      continue;
    }
    
    // Analyze function components
    const functionDeclarations = sourceFile.getFunctions();
    for (const func of functionDeclarations) {
      const name = func.getName();
      if (name && /^[A-Z]/.test(name)) { // Component names start with uppercase
        const complexity = analyzeComponent(func, name);
        components.push(complexity);
      }
    }
    
    // Analyze arrow function components
    const variableStatements = sourceFile.getVariableStatements();
    for (const varStatement of variableStatements) {
      const declarations = varStatement.getDeclarations();
      for (const decl of declarations) {
        const name = decl.getName();
        if (/^[A-Z]/.test(name)) {
          const initializer = decl.getInitializer();
          if (initializer && Node.isArrowFunction(initializer)) {
            const complexity = analyzeComponent(initializer, name);
            components.push(complexity);
          }
        }
      }
    }
  }
  
  // Calculate average complexity
  const totalComplexity = components.reduce((sum, comp) => sum + comp.cyclomaticComplexity, 0);
  const averageComplexity = components.length > 0 ? totalComplexity / components.length : 0;
  
  // Identify complex components (complexity > 15)
  const complexComponents = components.filter(comp => comp.cyclomaticComplexity > 15);
  
  console.log(`  ✓ Analyzed ${components.length} components`);
  console.log(`  ✓ Average complexity: ${averageComplexity.toFixed(2)}`);
  console.log(`  ✓ Found ${complexComponents.length} complex components (>15)`);
  
  return {
    components,
    averageComplexity,
    complexComponents
  };
}