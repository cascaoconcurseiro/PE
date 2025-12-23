import { Project, SourceFile, Node } from 'ts-morph';
import { AnalysisResult, Issue, CodeLocation, ComplexityLevel } from './types';

export abstract class BaseAnalyzer {
  protected project: Project;

  constructor() {
    this.project = new Project({
      tsConfigFilePath: './tsconfig.json',
    });
  }

  protected createCodeLocation(node: Node): CodeLocation {
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
      endColumn: endLineAndColumn.column,
    };
  }

  protected calculateComplexity(node: Node): ComplexityLevel {
    // Simplified complexity calculation based on node type and children count
    const childrenCount = node.getChildren().length;
    const text = node.getText();
    const lines = text.split('\n').length;

    if (lines > 100 || childrenCount > 50) return 'VERY_HIGH';
    if (lines > 50 || childrenCount > 25) return 'HIGH';
    if (lines > 20 || childrenCount > 10) return 'MEDIUM';
    return 'LOW';
  }

  protected createIssue(
    type: Issue['type'],
    severity: Issue['severity'],
    description: string,
    location: CodeLocation,
    impact: string
  ): Issue {
    return {
      type,
      severity,
      description,
      location,
      impact,
    };
  }

  protected getSourceFiles(): SourceFile[] {
    return this.project.getSourceFiles().filter(sf => {
      const filePath = sf.getFilePath();
      return filePath.includes('/src/') && 
             !filePath.includes('/node_modules/') &&
             !filePath.includes('/.kiro/') &&
             (filePath.endsWith('.ts') || filePath.endsWith('.tsx'));
    });
  }

  abstract analyze(): Promise<any>;
}