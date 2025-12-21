import * as fs from 'fs';
import * as path from 'path';
import { AnalysisResult, Issue, DeadCodeReport, Recommendation } from './types';

export class SystemAnalyzer {
  private srcPath: string;
  private issues: Issue[] = [];
  private deadCode: DeadCodeReport[] = [];
  private recommendations: Recommendation[] = [];

  constructor(srcPath: string = './src') {
    this.srcPath = srcPath;
  }

  async analyzeSystem(): Promise<AnalysisResult> {
    console.log('🔍 Iniciando análise do sistema financeiro...');

    // Análise de arquivos não utilizados
    await this.analyzeUnusedFiles();
    
    // Análise de imports não utilizados
    await this.analyzeUnusedImports();
    
    // Análise de duplicação de código
    await this.analyzeDuplicatedCode();
    
    // Análise de complexidade
    await this.analyzeComplexity();
    
    // Análise específica do sistema de categorias
    await this.analyzeCategorySystem();

    return this.generateReport();
  }

  private async analyzeUnusedFiles(): Promise<void> {
    console.log('📁 Analisando arquivos não utilizados...');
    
    const allFiles = this.getAllTsFiles();
    const importedFiles = new Set<string>();
    
    // Encontrar todos os imports
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const imports = content.match(/import.*?from\s+['"]([^'"]+)['"]/g) || [];
      
      for (const imp of imports) {
        const match = imp.match(/from\s+['"]([^'"]+)['"]/);
        if (match) {
          let importPath = match[1];
          
          // Resolver path relativo
          if (importPath.startsWith('./') || importPath.startsWith('../')) {
            const resolvedPath = path.resolve(path.dirname(file), importPath);
            const possibleExtensions = ['.ts', '.tsx', '.js', '.jsx'];
            
            for (const ext of possibleExtensions) {
              const fullPath = resolvedPath + ext;
              if (fs.existsSync(fullPath)) {
                importedFiles.add(fullPath);
                break;
              }
            }
          }
        }
      }
    }

    // Identificar arquivos não importados
    for (const file of allFiles) {
      if (!importedFiles.has(file) && !this.isMainFile(file)) {
        this.deadCode.push({
          type: 'FILE',
          name: path.basename(file),
          filePath: file,
          reason: 'Arquivo não é importado por nenhum outro arquivo',
          safeToRemove: !this.isCriticalFile(file)
        });
      }
    }
  }

  private async analyzeUnusedImports(): Promise<void> {
    console.log('📦 Analisando imports não utilizados...');
    
    const allFiles = this.getAllTsFiles();
    
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const imports = content.match(/import\s+{([^}]+)}\s+from/g) || [];
      
      for (const imp of imports) {
        const match = imp.match(/import\s+{([^}]+)}\s+from/);
        if (match) {
          const importedItems = match[1].split(',').map(item => item.trim());
          
          for (const item of importedItems) {
            // Verificar se o item é usado no arquivo
            const regex = new RegExp(`\\b${item}\\b`, 'g');
            const matches = content.match(regex) || [];
            
            // Se aparece apenas no import (1 vez), não está sendo usado
            if (matches.length <= 1) {
              this.issues.push({
                type: 'DEAD_CODE',
                severity: 'LOW',
                description: `Import '${item}' não está sendo utilizado`,
                location: {
                  filePath: file,
                  startLine: this.getLineNumber(content, imp),
                  endLine: this.getLineNumber(content, imp)
                },
                impact: 'Reduz o tamanho do bundle e melhora a performance'
              });
            }
          }
        }
      }
    }
  }

  private async analyzeDuplicatedCode(): Promise<void> {
    console.log('🔄 Analisando código duplicado...');
    
    const allFiles = this.getAllTsFiles();
    const codeBlocks = new Map<string, string[]>();
    
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Procurar por padrões comuns de duplicação
      const functions = content.match(/function\s+\w+\([^)]*\)\s*{[^}]+}/g) || [];
      const useEffects = content.match(/useEffect\([^)]+\)/g) || [];
      const validations = content.match(/if\s*\([^)]+\)\s*{[^}]*error[^}]*}/g) || [];
      
      // Agrupar por similaridade
      [...functions, ...useEffects, ...validations].forEach(block => {
        const normalized = this.normalizeCode(block);
        if (!codeBlocks.has(normalized)) {
          codeBlocks.set(normalized, []);
        }
        codeBlocks.get(normalized)!.push(file);
      });
    }

    // Identificar duplicações
    for (const [code, files] of codeBlocks) {
      if (files.length > 1) {
        this.issues.push({
          type: 'DUPLICATION',
          severity: 'MEDIUM',
          description: `Código duplicado encontrado em ${files.length} arquivos`,
          location: {
            filePath: files[0],
            startLine: 1,
            endLine: 1
          },
          impact: 'Dificulta manutenção e aumenta o tamanho do código'
        });

        this.recommendations.push({
          id: `dup-${Date.now()}`,
          title: 'Consolidar código duplicado',
          description: `Extrair lógica comum para um utilitário reutilizável`,
          category: 'CONSOLIDATION',
          priority: 'MEDIUM',
          effort: 'MEDIUM',
          impact: 'MEDIUM',
          dependencies: [],
          codeExample: {
            before: code.substring(0, 100) + '...',
            after: '// Extrair para utils/commonLogic.ts',
            explanation: 'Criar função reutilizável para evitar duplicação'
          }
        });
      }
    }
  }

  private async analyzeComplexity(): Promise<void> {
    console.log('🧮 Analisando complexidade do código...');
    
    const allFiles = this.getAllTsFiles();
    
    for (const file of allFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      const lines = content.split('\n');
      
      // Arquivos muito grandes
      if (lines.length > 500) {
        this.issues.push({
          type: 'OVER_ENGINEERING',
          severity: 'HIGH',
          description: `Arquivo muito grande (${lines.length} linhas)`,
          location: {
            filePath: file,
            startLine: 1,
            endLine: lines.length
          },
          impact: 'Dificulta manutenção e compreensão do código'
        });
      }

      // Funções muito complexas
      const functions = content.match(/function\s+\w+[^{]*{[^}]+}/g) || [];
      for (const func of functions) {
        const funcLines = func.split('\n').length;
        if (funcLines > 50) {
          this.issues.push({
            type: 'OVER_ENGINEERING',
            severity: 'MEDIUM',
            description: `Função muito complexa (${funcLines} linhas)`,
            location: {
              filePath: file,
              startLine: this.getLineNumber(content, func),
              endLine: this.getLineNumber(content, func) + funcLines
            },
            impact: 'Dificulta testes e manutenção'
          });
        }
      }
    }
  }

  private async analyzeCategorySystem(): Promise<void> {
    console.log('🏷️ Analisando sistema de categorias...');
    
    // Analisar o arquivo de tipos para categorias
    const typesFile = path.join(this.srcPath, 'types.ts');
    if (fs.existsSync(typesFile)) {
      const content = fs.readFileSync(typesFile, 'utf-8');
      
      // Verificar se as categorias estão bem organizadas
      const categoryEnum = content.match(/export enum Category\s*{([^}]+)}/s);
      if (categoryEnum) {
        const categories = categoryEnum[1];
        
        // Verificar se há agrupamento lógico
        if (!categories.includes('// INCOME SPECIFIC') && !categories.includes('💰')) {
          this.recommendations.push({
            id: 'cat-grouping',
            title: 'Implementar agrupamento de categorias',
            description: 'Agrupar categorias por tipo de transação para melhor UX',
            category: 'SIMPLIFICATION',
            priority: 'HIGH',
            effort: 'SMALL',
            impact: 'HIGH',
            dependencies: [],
            codeExample: {
              before: 'Categorias misturadas sem agrupamento',
              after: 'Categorias agrupadas por: Receitas, Despesas, Transferências',
              explanation: 'Facilita a seleção de categoria no formulário'
            }
          });
        }
      }
    }

    // Analisar o formulário de transações
    const formFiles = this.getAllTsFiles().filter(f => f.includes('TransactionForm'));
    for (const file of formFiles) {
      const content = fs.readFileSync(file, 'utf-8');
      
      // Verificar se há filtro de categorias por tipo
      if (!content.includes('isIncome') || !content.includes('isExpense')) {
        this.recommendations.push({
          id: 'cat-filter',
          title: 'Implementar filtro de categorias por tipo',
          description: 'Mostrar apenas categorias relevantes baseado no tipo de transação',
          category: 'SIMPLIFICATION',
          priority: 'HIGH',
          effort: 'SMALL',
          impact: 'HIGH',
          dependencies: ['cat-grouping']
        });
      }
    }
  }

  private getAllTsFiles(): string[] {
    const files: string[] = [];
    
    const scanDir = (dir: string) => {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
          scanDir(fullPath);
        } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
          files.push(fullPath);
        }
      }
    };
    
    scanDir(this.srcPath);
    return files;
  }

  private isMainFile(file: string): boolean {
    const mainFiles = ['App.tsx', 'main.tsx', 'index.tsx', 'index.ts'];
    return mainFiles.some(main => file.endsWith(main));
  }

  private isCriticalFile(file: string): boolean {
    const criticalPatterns = ['types.ts', 'config', 'utils', 'hooks', 'services'];
    return criticalPatterns.some(pattern => file.includes(pattern));
  }

  private normalizeCode(code: string): string {
    return code
      .replace(/\s+/g, ' ')
      .replace(/\/\*.*?\*\//g, '')
      .replace(/\/\/.*$/gm, '')
      .trim()
      .toLowerCase();
  }

  private getLineNumber(content: string, searchText: string): number {
    const lines = content.substring(0, content.indexOf(searchText)).split('\n');
    return lines.length;
  }

  private generateReport(): AnalysisResult {
    const criticalIssues = this.issues.filter(i => i.severity === 'CRITICAL').length;
    const totalIssues = this.issues.length;
    
    return {
      id: `analysis-${Date.now()}`,
      timestamp: new Date(),
      systemVersion: '0.0.2',
      summary: {
        totalIssues,
        criticalIssues,
        codeReductionPotential: Math.min(this.deadCode.length * 5, 30), // Estimativa
        performanceImprovementPotential: Math.min(this.issues.filter(i => i.type === 'PERFORMANCE').length * 10, 50),
        maintainabilityScore: Math.max(1, 10 - Math.floor(totalIssues / 10))
      },
      frontend: {
        components: [],
        hooks: [],
        types: [],
        imports: [],
        deadCode: this.deadCode
      },
      backend: {
        tables: [],
        indexes: [],
        functions: [],
        triggers: []
      },
      businessLogic: {
        calculations: [],
        validations: [],
        transformations: [],
        duplications: []
      },
      recommendations: this.recommendations
    };
  }
}