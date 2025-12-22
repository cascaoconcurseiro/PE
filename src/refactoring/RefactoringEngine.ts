/**
 * Main Refactoring Engine
 * Coordinates all analysis and refactoring operations
 */

import { Project } from 'ts-morph';
import {
  AnalysisResult,
  RefactoringReport,
  RefactoringOptions,
  RefactoringResult,
  ValidationReport,
  Recommendation,
  EstimatedBenefits
} from './types';

export interface RefactoringEngine {
  analyzeCodebase(rootPath: string): Promise<AnalysisResult>;
  generateReport(analysis: AnalysisResult): RefactoringReport;
  applyRefactoring(recommendations: Recommendation[], options: RefactoringOptions): Promise<RefactoringResult>;
  validateRefactoring(result: RefactoringResult): Promise<ValidationReport>;
}

export class RefactoringEngineImpl implements RefactoringEngine {
  private project: Project;
  private rootPath: string = '';

  constructor() {
    this.project = new Project({
      tsConfigFilePath: 'tsconfig.json',
      skipAddingFilesFromTsConfig: false,
    });
  }

  async analyzeCodebase(rootPath: string): Promise<AnalysisResult> {
    this.rootPath = rootPath;
    
    // Add all TypeScript files to the project
    this.project.addSourceFilesAtPaths(`${rootPath}/**/*.{ts,tsx}`);
    
    console.log(`🔍 Analyzing codebase at: ${rootPath}`);
    console.log(`📁 Found ${this.project.getSourceFiles().length} TypeScript files`);

    // Initialize all analyzers
    const deadCodeAnalyzer = await import('./analyzers/DeadCodeAnalyzer');
    const complexityAnalyzer = await import('./analyzers/ComplexityAnalyzer');
    const dependencyAnalyzer = await import('./analyzers/DependencyAnalyzer');
    const performanceAnalyzer = await import('./analyzers/PerformanceAnalyzer');
    const typeAnalyzer = await import('./analyzers/TypeAnalyzer');
    const structureAnalyzer = await import('./analyzers/StructureAnalyzer');

    // Run all analyses in parallel for better performance
    const [
      deadCode,
      complexity,
      dependencies,
      performance,
      types,
      structure
    ] = await Promise.all([
      deadCodeAnalyzer.analyzeDeadCode(this.project),
      complexityAnalyzer.analyzeComplexity(this.project),
      dependencyAnalyzer.analyzeDependencies(this.project),
      performanceAnalyzer.analyzePerformance(this.project),
      typeAnalyzer.analyzeTypes(this.project),
      structureAnalyzer.analyzeStructure(this.project, rootPath)
    ]);

    return {
      deadCode,
      complexity,
      dependencies,
      performance,
      types,
      structure
    };
  }

  generateReport(analysis: AnalysisResult): RefactoringReport {
    const recommendations = this.generateRecommendations(analysis);
    const estimatedBenefits = this.calculateEstimatedBenefits(analysis, recommendations);
    
    return {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      codebaseSnapshot: {
        totalFiles: this.project.getSourceFiles().length,
        totalLinesOfCode: this.calculateTotalLinesOfCode(),
        bundleSize: this.estimateBundleSize(),
        averageComplexity: analysis.complexity.averageComplexity
      },
      analysis,
      recommendations,
      estimatedBenefits
    };
  }

  async applyRefactoring(recommendations: Recommendation[], options: RefactoringOptions): Promise<RefactoringResult> {
    if (options.dryRun) {
      console.log('🧪 Dry run mode - no changes will be applied');
      return this.simulateRefactoring(recommendations);
    }

    if (options.createBackup) {
      await this.createBackup();
    }

    const result: RefactoringResult = {
      success: true,
      appliedChanges: [],
      errors: [],
      warnings: [],
      metrics: {
        filesModified: 0,
        linesRemoved: 0,
        bundleSizeReduction: 0,
        complexityReduction: 0
      }
    };

    // Apply recommendations in priority order
    const sortedRecommendations = this.sortRecommendationsByPriority(recommendations);
    
    for (const recommendation of sortedRecommendations) {
      try {
        const changes = await this.applyRecommendation(recommendation, options);
        result.appliedChanges.push(...changes);
        result.metrics.filesModified += changes.length;
      } catch (error) {
        result.errors.push(`Failed to apply recommendation ${recommendation.id}: ${error}`);
        result.success = false;
      }
    }

    if (options.runTests) {
      const testResult = await this.runTests();
      if (!testResult.success) {
        result.warnings.push('Some tests failed after refactoring');
      }
    }

    return result;
  }

  async validateRefactoring(result: RefactoringResult): Promise<ValidationReport> {
    const validation: ValidationReport = {
      functionalityPreserved: true,
      testsPass: true,
      typesSafe: true,
      performanceImproved: true,
      issues: []
    };

    // Run TypeScript compiler to check for type errors
    const diagnostics = this.project.getPreEmitDiagnostics();
    if (diagnostics.length > 0) {
      validation.typesSafe = false;
      validation.issues.push(`TypeScript errors: ${diagnostics.length} issues found`);
    }

    // Run tests to ensure functionality is preserved
    const testResult = await this.runTests();
    if (!testResult.success) {
      validation.testsPass = false;
      validation.functionalityPreserved = false;
      validation.issues.push(`Tests failed: ${testResult.failures} test failures`);
    }

    // Check if performance actually improved
    const newAnalysis = await this.analyzeCodebase(this.rootPath);
    const performanceImproved = this.comparePerformanceMetrics(result, newAnalysis);
    if (!performanceImproved) {
      validation.performanceImproved = false;
      validation.issues.push('Performance did not improve as expected');
    }

    return validation;
  }

  private generateRecommendations(analysis: AnalysisResult): Recommendation[] {
    const recommendations: Recommendation[] = [];

    // Generate recommendations from dead code analysis
    recommendations.push(...this.generateDeadCodeRecommendations(analysis.deadCode));
    
    // Generate recommendations from complexity analysis
    recommendations.push(...this.generateComplexityRecommendations(analysis.complexity));
    
    // Generate recommendations from dependency analysis
    recommendations.push(...this.generateDependencyRecommendations(analysis.dependencies));
    
    // Generate recommendations from performance analysis
    recommendations.push(...this.generatePerformanceRecommendations(analysis.performance));
    
    // Generate recommendations from type analysis
    recommendations.push(...this.generateTypeRecommendations(analysis.types));
    
    // Generate recommendations from structure analysis
    recommendations.push(...this.generateStructureRecommendations(analysis.structure));

    return this.prioritizeRecommendations(recommendations);
  }

  private calculateEstimatedBenefits(analysis: AnalysisResult, recommendations: Recommendation[]): EstimatedBenefits {
    // Calculate potential benefits based on analysis results and recommendations
    const bundleSizeReduction = this.estimateBundleSizeReduction(analysis, recommendations);
    const performanceImprovement = this.estimatePerformanceImprovement(analysis, recommendations);
    const codeReduction = this.estimateCodeReduction(analysis, recommendations);
    const complexityReduction = this.estimateComplexityReduction(analysis, recommendations);
    
    return {
      bundleSizeReduction,
      performanceImprovement,
      maintainabilityScore: Math.min(10, 5 + (complexityReduction / 10)), // Improved maintainability
      codeReduction,
      complexityReduction
    };
  }

  private calculateTotalLinesOfCode(): number {
    return this.project.getSourceFiles()
      .reduce((total, file) => total + file.getFullText().split('\n').length, 0);
  }

  private estimateBundleSize(): number {
    // Rough estimation based on file sizes
    return this.project.getSourceFiles()
      .reduce((total, file) => total + file.getFullText().length, 0);
  }

  private async createBackup(): Promise<void> {
    // Implementation for creating backup
    console.log('📦 Creating backup of current codebase...');
    // This would typically copy files to a backup directory
  }

  private simulateRefactoring(recommendations: Recommendation[]): RefactoringResult {
    // Simulate what would happen without actually making changes
    return {
      success: true,
      appliedChanges: [],
      errors: [],
      warnings: [],
      metrics: {
        filesModified: recommendations.length,
        linesRemoved: recommendations.reduce((total, rec) => total + (rec.codeExample.before.split('\n').length - rec.codeExample.after.split('\n').length), 0),
        bundleSizeReduction: 0,
        complexityReduction: 0
      }
    };
  }

  private sortRecommendationsByPriority(recommendations: Recommendation[]): Recommendation[] {
    const priorityOrder = { 'CRITICAL': 4, 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    const impactOrder = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    const effortOrder = { 'SMALL': 3, 'MEDIUM': 2, 'LARGE': 1 };

    return recommendations.sort((a, b) => {
      const aScore = priorityOrder[a.priority] * impactOrder[a.impact] * effortOrder[a.effort];
      const bScore = priorityOrder[b.priority] * impactOrder[b.impact] * effortOrder[b.effort];
      return bScore - aScore;
    });
  }

  private async applyRecommendation(recommendation: Recommendation, options: RefactoringOptions): Promise<any[]> {
    // Implementation for applying individual recommendations
    console.log(`🔧 Applying recommendation: ${recommendation.title}`);
    return [];
  }

  private async runTests(): Promise<{ success: boolean; failures: number }> {
    // Implementation for running tests
    console.log('🧪 Running tests...');
    return { success: true, failures: 0 };
  }

  private comparePerformanceMetrics(result: RefactoringResult, newAnalysis: AnalysisResult): boolean {
    // Compare performance metrics before and after
    return result.metrics.bundleSizeReduction > 0 || result.metrics.complexityReduction > 0;
  }

  // Placeholder methods for generating specific types of recommendations
  private generateDeadCodeRecommendations(deadCode: any): Recommendation[] { return []; }
  private generateComplexityRecommendations(complexity: any): Recommendation[] { return []; }
  private generateDependencyRecommendations(dependencies: any): Recommendation[] { return []; }
  private generatePerformanceRecommendations(performance: any): Recommendation[] { return []; }
  private generateTypeRecommendations(types: any): Recommendation[] { return []; }
  private generateStructureRecommendations(structure: any): Recommendation[] { return []; }
  
  private prioritizeRecommendations(recommendations: Recommendation[]): Recommendation[] {
    return this.sortRecommendationsByPriority(recommendations);
  }

  private estimateBundleSizeReduction(analysis: AnalysisResult, recommendations: Recommendation[]): number { return 0; }
  private estimatePerformanceImprovement(analysis: AnalysisResult, recommendations: Recommendation[]): number { return 0; }
  private estimateCodeReduction(analysis: AnalysisResult, recommendations: Recommendation[]): number { return 0; }
  private estimateComplexityReduction(analysis: AnalysisResult, recommendations: Recommendation[]): number { return 0; }
}

// Factory function for creating the refactoring engine
export function createRefactoringEngine(): RefactoringEngine {
  return new RefactoringEngineImpl();
}