/**
 * Core types for the Refactoring Engine
 */

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn: number;
  endColumn: number;
}

export interface UnusedImport {
  importName: string;
  location: CodeLocation;
  modulePath: string;
  isTypeOnly: boolean;
}

export interface OrphanedComponent {
  componentName: string;
  location: CodeLocation;
  isExported: boolean;
  usedOnlyInTests: boolean;
}

export interface UnusedHook {
  hookName: string;
  location: CodeLocation;
  isCustomHook: boolean;
  dependencies: string[];
}

export interface UnusedType {
  typeName: string;
  location: CodeLocation;
  kind: 'interface' | 'type' | 'enum';
  isExported: boolean;
}

export interface DeadCodeReport {
  unusedImports: UnusedImport[];
  orphanedComponents: OrphanedComponent[];
  unusedHooks: UnusedHook[];
  unusedTypes: UnusedType[];
  totalSavings: {
    linesOfCode: number;
    bundleSize: number;
    files: number;
  };
}

export interface ComponentComplexity {
  componentName: string;
  location: CodeLocation;
  cyclomaticComplexity: number;
  linesOfCode: number;
  numberOfProps: number;
  numberOfHooks: number;
  numberOfChildren: number;
  responsibilities: Responsibility[];
  decompositionSuggestions: DecompositionSuggestion[];
}

export interface Responsibility {
  type: 'STATE_MANAGEMENT' | 'DATA_FETCHING' | 'UI_RENDERING' | 'EVENT_HANDLING' | 'BUSINESS_LOGIC';
  description: string;
  linesOfCode: number;
}

export interface DecompositionSuggestion {
  type: 'EXTRACT_COMPONENT' | 'EXTRACT_HOOK' | 'SPLIT_RESPONSIBILITIES';
  description: string;
  extractedCode: string;
  remainingCode: string;
  benefits: string[];
  effort: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface ComplexityReport {
  components: ComponentComplexity[];
  averageComplexity: number;
  complexComponents: ComponentComplexity[]; // Components with complexity > 15
}

export interface DependencyNode {
  id: string;
  filePath: string;
  type: 'COMPONENT' | 'HOOK' | 'SERVICE' | 'TYPE' | 'UTILITY';
  exports: string[];
  imports: string[];
}

export interface DependencyEdge {
  from: string;
  to: string;
  importedSymbols: string[];
}

export interface DependencyCluster {
  id: string;
  nodes: string[];
  type: 'FEATURE' | 'DOMAIN' | 'UTILITY';
}

export interface CircularDependency {
  cycle: string[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  suggestedResolution: string;
}

export interface DependencyGraph {
  nodes: DependencyNode[];
  edges: DependencyEdge[];
  clusters: DependencyCluster[];
}

export interface ConsolidationOpportunity {
  type: 'MERGE_HOOKS' | 'MERGE_SERVICES' | 'EXTRACT_SHARED_UTILITY';
  targets: string[];
  sharedFunctionality: string[];
  consolidatedInterface: string;
  migrationSteps: MigrationStep[];
}

export interface MigrationStep {
  id: string;
  description: string;
  type: 'REMOVE' | 'MODIFY' | 'CREATE' | 'MOVE';
  files: string[];
  automatable: boolean;
}

export interface DependencyReport {
  graph: DependencyGraph;
  circularDependencies: CircularDependency[];
  consolidationOpportunities: ConsolidationOpportunity[];
}

export interface HeavyDependency {
  packageName: string;
  bundleSize: number;
  usageCount: number;
  alternatives: string[];
}

export interface TreeshakingOpportunity {
  packageName: string;
  unusedExports: string[];
  potentialSavings: number;
}

export interface LazyLoadingCandidate {
  componentName: string;
  location: CodeLocation;
  bundleSize: number;
  loadFrequency: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface BundleSizeReport {
  totalSize: number;
  heavyDependencies: HeavyDependency[];
  unusedDependencies: string[];
  treeshakingOpportunities: TreeshakingOpportunity[];
  lazyLoadingCandidates: LazyLoadingCandidate[];
}

export interface RerenderIssue {
  componentName: string;
  location: CodeLocation;
  cause: 'MISSING_MEMO' | 'UNSTABLE_PROPS' | 'INLINE_OBJECTS' | 'MISSING_CALLBACK_DEPS';
  suggestion: string;
}

export interface PerformanceImprovement {
  metric: 'BUNDLE_SIZE' | 'LOAD_TIME' | 'RENDER_TIME' | 'MEMORY_USAGE';
  expectedImprovement: number; // percentage
  confidence: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OptimizationOpportunity {
  type: 'MEMOIZATION' | 'LAZY_LOADING' | 'CODE_SPLITTING' | 'TREE_SHAKING';
  location: CodeLocation;
  description: string;
  expectedImprovement: PerformanceImprovement;
  implementation: string;
}

export interface ComputationReport {
  heavyFunctions: {
    functionName: string;
    location: CodeLocation;
    complexity: number;
    optimizationSuggestions: string[];
  }[];
}

export interface PerformanceReport {
  bundleSize: BundleSizeReport;
  rerenderIssues: RerenderIssue[];
  computations: ComputationReport;
  optimizationOpportunities: OptimizationOpportunity[];
}

export interface TypeReport {
  duplicateTypes: {
    typeName: string;
    locations: CodeLocation[];
    similarity: number;
    consolidationSuggestion: string;
  }[];
  unusedTypes: UnusedType[];
  inconsistentTypes: {
    typeName: string;
    variations: CodeLocation[];
    suggestedUnification: string;
  }[];
}

export interface StructureReport {
  inconsistentNaming: {
    pattern: string;
    files: string[];
    suggestedPattern: string;
  }[];
  misplacedFiles: {
    filePath: string;
    currentLocation: string;
    suggestedLocation: string;
    reason: string;
  }[];
  organizationSuggestions: {
    type: 'FEATURE_BASED' | 'DOMAIN_BASED' | 'LAYER_BASED';
    description: string;
    migrationPlan: MigrationStep[];
  }[];
}

export interface AnalysisResult {
  deadCode: DeadCodeReport;
  complexity: ComplexityReport;
  dependencies: DependencyReport;
  performance: PerformanceReport;
  types: TypeReport;
  structure: StructureReport;
}

export interface Risk {
  type: 'BREAKING_CHANGE' | 'PERFORMANCE_REGRESSION' | 'DATA_LOSS' | 'FUNCTIONALITY_LOSS';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  mitigation: string;
}

export interface CodeExample {
  before: string;
  after: string;
  explanation: string;
  benefits: string[];
  breakingChanges: string[];
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'DEAD_CODE' | 'COMPLEXITY' | 'PERFORMANCE' | 'STRUCTURE' | 'TYPES';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  effort: 'SMALL' | 'MEDIUM' | 'LARGE';
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  codeExample: CodeExample;
  dependencies: string[];
  risks: Risk[];
}

export interface EstimatedBenefits {
  bundleSizeReduction: number; // percentage
  performanceImprovement: number; // percentage
  maintainabilityScore: number; // 1-10
  codeReduction: number; // lines of code
  complexityReduction: number; // percentage
}

export interface RefactoringReport {
  id: string;
  timestamp: Date;
  codebaseSnapshot: {
    totalFiles: number;
    totalLinesOfCode: number;
    bundleSize: number;
    averageComplexity: number;
  };
  analysis: AnalysisResult;
  recommendations: Recommendation[];
  estimatedBenefits: EstimatedBenefits;
}

export interface RefactoringOptions {
  preserveFunctionality: boolean;
  createBackup: boolean;
  runTests: boolean;
  dryRun: boolean;
}

export interface RefactoringResult {
  success: boolean;
  appliedChanges: MigrationStep[];
  errors: string[];
  warnings: string[];
  metrics: {
    filesModified: number;
    linesRemoved: number;
    bundleSizeReduction: number;
    complexityReduction: number;
  };
}

export interface ValidationReport {
  functionalityPreserved: boolean;
  testsPass: boolean;
  typesSafe: boolean;
  performanceImproved: boolean;
  issues: string[];
}