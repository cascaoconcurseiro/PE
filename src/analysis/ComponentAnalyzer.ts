import { BaseAnalyzer } from './BaseAnalyzer';
import { ComponentAnalysis, DeadCodeReport, Issue } from './types';
import { FunctionDeclaration, VariableDeclaration, ArrowFunction, Node } from 'ts-morph';

export class ComponentAnalyzer extends BaseAnalyzer {
  async analyze(): Promise<{ components: ComponentAnalysis[]; deadCode: DeadCodeReport[] }> {
    const sourceFiles = this.getSourceFiles();
    const components: ComponentAnalysis[] = [];
    const deadCode: DeadCodeReport[] = [];
    const componentUsages = new Map<string, number>();

    // First pass: find all components and count usages
    for (const sourceFile of sourceFiles) {
      const filePath = sourceFile.getFilePath();
      
      // Find React components (functions that return JSX)
      const functionDeclarations = sourceFile.getDescendantsOfKind(40); // FunctionDeclaration

      // Analyze function components
      for (const func of functionDeclarations) {
        if (this.isReactComponent(func)) {
          const componentName = func.getName() || 'Anonymous';
          const analysis = this.analyzeComponent(func, componentName, filePath);
          components.push(analysis);
          
          // Count usages across all files
          const usageCount = this.countComponentUsages(componentName, sourceFiles);
          componentUsages.set(componentName, usageCount);
        }
      }
    }

    // Update usage counts and identify dead components
    for (const component of components) {
      const usageCount = componentUsages.get(component.componentName) || 0;
      component.usageCount = usageCount;

      // Mark as dead code if not used (except for default exports and App components)
      if (usageCount === 0 && !this.isMainComponent(component.componentName)) {
        deadCode.push({
          type: 'COMPONENT',
          name: component.componentName,
          filePath: component.filePath,
          reason: 'Component is not referenced anywhere in the codebase',
          safeToRemove: true,
        });
      }
    }

    return { components, deadCode };
  }

  private isReactComponent(node: Node): boolean {
    const text = node.getText();
    
    // Check if it returns JSX (contains JSX elements)
    const hasJSX = text.includes('<') && text.includes('>') && text.includes('return');
    
    // Check if it uses React hooks
    const hasHooks = /use[A-Z]\w*\(/.test(text);
    
    // Check if function name starts with capital letter (React convention)
    let hasCapitalName = false;
    if (node.getKind() === 40) { // FunctionDeclaration
      const func = node as FunctionDeclaration;
      const name = func.getName();
      hasCapitalName = name ? /^[A-Z]/.test(name) : false;
    }

    // Debug logging
    console.log(`Analyzing node: ${node.getKindName()}, hasJSX: ${hasJSX}, hasHooks: ${hasHooks}, hasCapitalName: ${hasCapitalName}`);
    console.log(`Text: ${text.substring(0, 100)}...`);

    return hasJSX || hasHooks || hasCapitalName;
  }

  private analyzeComponent(node: Node, componentName: string, filePath: string): ComponentAnalysis {
    const complexity = this.calculateComplexity(node);
    const issues: Issue[] = [];
    const dependencies: string[] = [];
    
    const text = node.getText();
    
    // Check for complexity issues
    if (complexity === 'VERY_HIGH') {
      issues.push(this.createIssue(
        'OVER_ENGINEERING',
        'HIGH',
        `Component ${componentName} is overly complex and should be broken down`,
        this.createCodeLocation(node),
        'Reduces maintainability and testability'
      ));
    }

    // Check for performance issues
    if (text.includes('useEffect') && !text.includes('[]')) {
      const effectCount = (text.match(/useEffect/g) || []).length;
      if (effectCount > 3) {
        issues.push(this.createIssue(
          'PERFORMANCE',
          'MEDIUM',
          `Component ${componentName} has ${effectCount} useEffect hooks, consider optimization`,
          this.createCodeLocation(node),
          'May cause unnecessary re-renders'
        ));
      }
    }

    // Extract dependencies (imports used in component)
    const imports = text.match(/import\s+.*?\s+from\s+['"]([^'"]+)['"]/g) || [];
    dependencies.push(...imports.map(imp => imp.split('from')[1].trim().replace(/['"]/g, '')));

    return {
      componentName,
      filePath,
      complexity,
      issues,
      suggestions: this.generateSuggestions(node, componentName),
      usageCount: 0, // Will be updated later
      dependencies,
    };
  }

  private countComponentUsages(componentName: string, sourceFiles: any[]): number {
    let count = 0;
    
    for (const sourceFile of sourceFiles) {
      const text = sourceFile.getFullText();
      
      // Count JSX usage: <ComponentName
      const jsxMatches = text.match(new RegExp(`<${componentName}[\\s>]`, 'g')) || [];
      count += jsxMatches.length;
      
      // Count import usage: import { ComponentName }
      const importMatches = text.match(new RegExp(`import.*?{[^}]*${componentName}[^}]*}`, 'g')) || [];
      count += importMatches.length;
      
      // Count direct usage: ComponentName(
      const directMatches = text.match(new RegExp(`${componentName}\\(`, 'g')) || [];
      count += directMatches.length;
    }
    
    return count;
  }

  private isMainComponent(componentName: string): boolean {
    const mainComponents = ['App', 'Main', 'Layout', 'Router'];
    return mainComponents.includes(componentName) || componentName.endsWith('Layout');
  }

  private generateSuggestions(node: Node, componentName: string): any[] {
    const suggestions = [];
    const text = node.getText();
    const lines = text.split('\n').length;

    if (lines > 100) {
      suggestions.push({
        type: 'SIMPLIFY',
        description: `Break down ${componentName} into smaller components`,
        impact: 'HIGH',
      });
    }

    if (text.includes('useState') && (text.match(/useState/g) || []).length > 5) {
      suggestions.push({
        type: 'OPTIMIZE',
        description: `Consider using useReducer instead of multiple useState in ${componentName}`,
        impact: 'MEDIUM',
      });
    }

    return suggestions;
  }
}