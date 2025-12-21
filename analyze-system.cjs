const fs = require('fs');
const path = require('path');

class SimpleSystemAnalyzer {
  constructor() {
    this.issues = [];
    this.deadCode = [];
    this.recommendations = [];
  }

  analyzeSystem() {
    console.log('🔍 Iniciando análise do sistema financeiro...');

    this.analyzeUnusedImports();
    this.analyzeDuplicatedCode();
    this.analyzeComplexity();
    this.analyzeCategorySystem();

    return this.generateReport();
  }

  analyzeUnusedImports() {
    console.log('📦 Analisando imports não utilizados...');
    
    const allFiles = this.getAllTsFiles();
    let unusedImportsCount = 0;
    
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const imports = content.match(/import\s+{([^}]+)}\s+from/g) || [];
        
        for (const imp of imports) {
          const match = imp.match(/import\s+{([^}]+)}\s+from/);
          if (match) {
            const importedItems = match[1].split(',').map(item => item.trim());
            
            for (const item of importedItems) {
              const regex = new RegExp(`\\b${item}\\b`, 'g');
              const matches = content.match(regex) || [];
              
              if (matches.length <= 1) {
                unusedImportsCount++;
                this.issues.push({
                  type: 'DEAD_CODE',
                  severity: 'LOW',
                  description: `Import '${item}' não está sendo utilizado`,
                  filePath: file,
                  impact: 'Reduz o tamanho do bundle'
                });
              }
            }
          }
        }
      } catch (error) {
        // Ignorar erros de leitura
      }
    }
    
    console.log(`   Encontrados ${unusedImportsCount} imports não utilizados`);
  }

  analyzeDuplicatedCode() {
    console.log('🔄 Analisando código duplicado...');
    
    const allFiles = this.getAllTsFiles();
    const codePatterns = new Map();
    let duplicationsFound = 0;
    
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        // Procurar padrões comuns
        const patterns = [
          ...content.match(/useState\([^)]*\)/g) || [],
          ...content.match(/useEffect\([^)]+\)/g) || [],
          ...content.match(/if\s*\([^)]+\)\s*{[^}]*}/g) || []
        ];
        
        patterns.forEach(pattern => {
          const normalized = pattern.replace(/\s+/g, ' ').trim();
          if (normalized.length > 20) { // Apenas padrões significativos
            if (!codePatterns.has(normalized)) {
              codePatterns.set(normalized, []);
            }
            codePatterns.get(normalized).push(file);
          }
        });
      } catch (error) {
        // Ignorar erros
      }
    }

    for (const [pattern, files] of codePatterns) {
      if (files.length > 1) {
        duplicationsFound++;
        this.issues.push({
          type: 'DUPLICATION',
          severity: 'MEDIUM',
          description: `Padrão duplicado em ${files.length} arquivos`,
          filePath: files[0],
          impact: 'Dificulta manutenção'
        });
      }
    }
    
    console.log(`   Encontradas ${duplicationsFound} duplicações de código`);
  }

  analyzeComplexity() {
    console.log('🧮 Analisando complexidade...');
    
    const allFiles = this.getAllTsFiles();
    let complexFiles = 0;
    
    for (const file of allFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        const lines = content.split('\n').length;
        
        if (lines > 300) {
          complexFiles++;
          this.issues.push({
            type: 'OVER_ENGINEERING',
            severity: lines > 500 ? 'HIGH' : 'MEDIUM',
            description: `Arquivo muito grande (${lines} linhas)`,
            filePath: file,
            impact: 'Dificulta manutenção'
          });
        }
      } catch (error) {
        // Ignorar erros
      }
    }
    
    console.log(`   Encontrados ${complexFiles} arquivos complexos`);
  }

  analyzeCategorySystem() {
    console.log('🏷️ Analisando sistema de categorias...');
    
    // Verificar se existe agrupamento de categorias
    const typesFile = path.join('./src', 'types.ts');
    let needsCategoryGrouping = false;
    
    if (fs.existsSync(typesFile)) {
      const content = fs.readFileSync(typesFile, 'utf-8');
      
      if (content.includes('enum Category') && !content.includes('// INCOME SPECIFIC')) {
        needsCategoryGrouping = true;
        this.recommendations.push({
          id: 'cat-grouping',
          title: '🎯 IMPLEMENTAR AGRUPAMENTO DE CATEGORIAS',
          description: 'Agrupar categorias por tipo de transação (Receita/Despesa/Transferência)',
          priority: 'HIGH',
          effort: 'SMALL',
          impact: 'HIGH'
        });
      }
    }

    // Verificar formulário de transações
    const formFiles = this.getAllTsFiles().filter(f => f.includes('TransactionForm'));
    let needsCategoryFilter = false;
    
    for (const file of formFiles) {
      try {
        const content = fs.readFileSync(file, 'utf-8');
        
        if (!content.includes('isIncome ?') || !content.includes('isExpense ?')) {
          needsCategoryFilter = true;
          this.recommendations.push({
            id: 'cat-filter',
            title: '🔧 IMPLEMENTAR FILTRO DE CATEGORIAS',
            description: 'Mostrar apenas categorias relevantes baseado no tipo de transação',
            priority: 'HIGH',
            effort: 'SMALL',
            impact: 'HIGH'
          });
        }
      } catch (error) {
        // Ignorar erros
      }
    }
    
    if (needsCategoryGrouping || needsCategoryFilter) {
      console.log('   ✅ Sistema de categorias precisa de melhorias');
    } else {
      console.log('   ✅ Sistema de categorias está bem estruturado');
    }
  }

  getAllTsFiles() {
    const files = [];
    
    const scanDir = (dir) => {
      try {
        const items = fs.readdirSync(dir);
        
        for (const item of items) {
          const fullPath = path.join(dir, item);
          try {
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
              scanDir(fullPath);
            } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
              files.push(fullPath);
            }
          } catch (error) {
            // Ignorar erros de acesso
          }
        }
      } catch (error) {
        // Ignorar erros de leitura de diretório
      }
    };
    
    scanDir('./src');
    return files;
  }

  generateReport() {
    const criticalIssues = this.issues.filter(i => i.severity === 'HIGH').length;
    const totalIssues = this.issues.length;
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues,
        criticalIssues,
        codeReductionPotential: Math.min(this.deadCode.length * 5, 30),
        performanceImprovementPotential: Math.min(this.issues.filter(i => i.type === 'PERFORMANCE').length * 10, 50),
        maintainabilityScore: Math.max(1, 10 - Math.floor(totalIssues / 10))
      },
      issues: this.issues,
      recommendations: this.recommendations
    };
  }
}

// Executar análise
const analyzer = new SimpleSystemAnalyzer();
const result = analyzer.analyzeSystem();

console.log('\n📊 RELATÓRIO DE ANÁLISE DO SISTEMA FINANCEIRO');
console.log('='.repeat(50));

console.log(`\n📈 RESUMO:`);
console.log(`• Total de problemas: ${result.summary.totalIssues}`);
console.log(`• Problemas críticos: ${result.summary.criticalIssues}`);
console.log(`• Score de manutenibilidade: ${result.summary.maintainabilityScore}/10`);

console.log(`\n💡 RECOMENDAÇÕES PRIORITÁRIAS:`);
result.recommendations
  .filter(r => r.priority === 'HIGH')
  .forEach(rec => {
    console.log(`${rec.title}`);
    console.log(`   ${rec.description}`);
    console.log(`   Esforço: ${rec.effort} | Impacto: ${rec.impact}\n`);
  });

console.log(`\n🔧 PRÓXIMOS PASSOS:`);
console.log(`1. Implementar agrupamento de categorias no formulário`);
console.log(`2. Remover imports não utilizados`);
console.log(`3. Consolidar código duplicado`);
console.log(`4. Refatorar arquivos muito grandes`);

// Salvar relatório
fs.writeFileSync('./analysis-report.json', JSON.stringify(result, null, 2));
console.log(`\n📄 Relatório completo salvo em: analysis-report.json`);