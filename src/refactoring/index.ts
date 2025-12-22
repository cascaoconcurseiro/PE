/**
 * Refactoring Engine - Main exports
 */

export { RefactoringEngine, RefactoringEngineImpl, createRefactoringEngine } from './RefactoringEngine';
export * from './types';

// Analyzer exports
export { analyzeDeadCode } from './analyzers/DeadCodeAnalyzer';
export { analyzeComplexity } from './analyzers/ComplexityAnalyzer';
export { analyzeDependencies } from './analyzers/DependencyAnalyzer';
export { analyzePerformance } from './analyzers/PerformanceAnalyzer';
export { analyzeTypes } from './analyzers/TypeAnalyzer';
export { analyzeStructure } from './analyzers/StructureAnalyzer';