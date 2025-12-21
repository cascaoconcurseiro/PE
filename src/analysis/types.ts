// Tipos para análise de código
export interface AnalysisResult {
  id: string;
  timestamp: Date;
  systemVersion: string;
  summary: AnalysisSummary;
  frontend: FrontendReport;
  backend: BackendReport;
  businessLogic: BusinessLogicReport;
  recommendations: Recommendation[];
}

export interface AnalysisSummary {
  totalIssues: number;
  criticalIssues: number;
  codeReductionPotential: number; // percentage
  performanceImprovementPotential: number; // percentage
  maintainabilityScore: number; // 1-10
}

export interface Issue {
  type: 'DEAD_CODE' | 'OVER_ENGINEERING' | 'DUPLICATION' | 'PERFORMANCE' | 'MAINTAINABILITY';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  description: string;
  location: CodeLocation;
  impact: string;
}

export interface CodeLocation {
  filePath: string;
  startLine: number;
  endLine: number;
  startColumn?: number;
  endColumn?: number;
}

export interface Recommendation {
  id: string;
  title: string;
  description: string;
  category: 'REMOVAL' | 'SIMPLIFICATION' | 'CONSOLIDATION' | 'OPTIMIZATION';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  effort: 'SMALL' | 'MEDIUM' | 'LARGE';
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  dependencies: string[];
  codeExample?: CodeExample;
}

export interface CodeExample {
  before: string;
  after: string;
  explanation: string;
}

export interface FrontendReport {
  components: ComponentAnalysis[];
  hooks: HookAnalysis[];
  types: TypeAnalysis[];
  imports: ImportAnalysis[];
  deadCode: DeadCodeReport[];
}

export interface ComponentAnalysis {
  componentName: string;
  filePath: string;
  complexity: ComplexityLevel;
  issues: Issue[];
  suggestions: Suggestion[];
  usageCount: number;
  dependencies: string[];
}

export interface HookAnalysis {
  hookName: string;
  filePath: string;
  complexity: ComplexityLevel;
  duplicatedLogic: string[];
  performanceIssues: string[];
  usageCount: number;
}

export interface TypeAnalysis {
  typeName: string;
  filePath: string;
  isUsed: boolean;
  isRedundant: boolean;
  complexity: ComplexityLevel;
  suggestions: string[];
}

export interface ImportAnalysis {
  filePath: string;
  unusedImports: string[];
  redundantImports: string[];
  heavyImports: string[];
  suggestions: string[];
}

export interface DeadCodeReport {
  type: 'COMPONENT' | 'FUNCTION' | 'TYPE' | 'IMPORT' | 'FILE';
  name: string;
  filePath: string;
  reason: string;
  safeToRemove: boolean;
}

export interface BackendReport {
  tables: TableAnalysis[];
  indexes: IndexAnalysis[];
  functions: FunctionAnalysis[];
  triggers: TriggerAnalysis[];
}

export interface TableAnalysis {
  tableName: string;
  columnCount: number;
  unusedColumns: string[];
  redundantColumns: string[];
  missingIndexes: string[];
  oversizedColumns: string[];
  suggestions: OptimizationSuggestion[];
}

export interface IndexAnalysis {
  indexName: string;
  tableName: string;
  isUsed: boolean;
  isRedundant: boolean;
  performance: 'GOOD' | 'POOR' | 'UNUSED';
  suggestions: string[];
}

export interface FunctionAnalysis {
  functionName: string;
  complexity: ComplexityLevel;
  isUsed: boolean;
  performanceIssues: string[];
  suggestions: string[];
}

export interface TriggerAnalysis {
  triggerName: string;
  tableName: string;
  complexity: ComplexityLevel;
  isOverEngineered: boolean;
  suggestions: string[];
}

export interface BusinessLogicReport {
  calculations: CalculationAnalysis[];
  validations: ValidationAnalysis[];
  transformations: TransformationAnalysis[];
  duplications: DuplicationReport[];
}

export interface CalculationAnalysis {
  functionName: string;
  filePath: string;
  complexity: number;
  duplicatedLogic: string[];
  performanceIssues: string[];
  consolidationOpportunities: string[];
}

export interface ValidationAnalysis {
  validationType: string;
  filePath: string;
  duplicatedRules: string[];
  consolidationOpportunities: string[];
}

export interface TransformationAnalysis {
  transformationType: string;
  filePath: string;
  isRedundant: boolean;
  suggestions: string[];
}

export interface DuplicationReport {
  type: 'LOGIC' | 'VALIDATION' | 'CALCULATION' | 'TRANSFORMATION';
  locations: CodeLocation[];
  similarity: number; // percentage
  consolidationSuggestion: string;
}

export type ComplexityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

export interface Suggestion {
  type: 'SIMPLIFY' | 'REMOVE' | 'CONSOLIDATE' | 'OPTIMIZE';
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface OptimizationSuggestion {
  type: 'ADD_INDEX' | 'REMOVE_COLUMN' | 'CHANGE_TYPE' | 'NORMALIZE';
  description: string;
  impact: 'LOW' | 'MEDIUM' | 'HIGH';
  effort: 'SMALL' | 'MEDIUM' | 'LARGE';
}