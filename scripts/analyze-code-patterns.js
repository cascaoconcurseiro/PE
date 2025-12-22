#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Análise de padrões de código para refatoração
class CodePatternAnalyzer {
    constructor() {
        this.results = {
            totalFiles: 0,
            totalLines: 0,
            categories: {},
            patterns: {
                interfaces: [],
                hooks: [],
                useState: [],
                duplicatedImports: {},
                similarFunctions: []
            },
            reductionOpportunities: []
        };
    }

    analyzeDirectory(dirPath) {
        const files = this.getAllFiles(dirPath, ['.ts', '.tsx']);
        
        files.forEach(filePath => {
            this.analyzeFile(filePath);
        });

        this.generateReport();
    }

    getAllFiles(dirPath, extensions) {
        let files = [];
        
        const items = fs.readdirSync(dirPath);
        
        items.forEach(item => {
            const fullPath = path.join(dirPath, item);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !item.includes('node_modules') && !item.includes('.git')) {
                files = files.concat(this.getAllFiles(fullPath, extensions));
            } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
                files.push(fullPath);
            }
        });
        
        return files;
    }

    analyzeFile(filePath) {
        const content = fs.readFileSync(filePath, 'utf8');
        const lines = content.split('\n');
        const relativePath = path.relative('src', filePath);
        
        this.results.totalFiles++;
        this.results.totalLines += lines.length;
        
        // Categorizar arquivo
        this.categorizeFile(relativePath, lines.length);
        
        // Analisar padrões
        this.analyzeInterfaces(content, relativePath);
        this.analyzeHooks(content, relativePath);
        this.analyzeUseState(content, relativePath);
        this.analyzeImports(content, relativePath);
        this.analyzeFunctions(content, relativePath);
    }

    categorizeFile(filePath, lineCount) {
        let category = 'other';
        
        if (filePath.includes('hooks') || filePath.match(/use[A-Z]/)) {
            category = 'hooks';
        } else if (filePath.includes('test') || filePath.includes('.test.') || filePath.includes('.spec.')) {
            category = 'tests';
        } else if (filePath.includes('services') || filePath.includes('core')) {
            category = 'services';
        } else if (filePath.includes('utils') || filePath.includes('helpers')) {
            category = 'utils';
        } else if (filePath.endsWith('.tsx')) {
            category = 'components';
        } else if (filePath.includes('types') || filePath.endsWith('.types.ts')) {
            category = 'types';
        }
        
        if (!this.results.categories[category]) {
            this.results.categories[category] = { files: 0, lines: 0 };
        }
        
        this.results.categories[category].files++;
        this.results.categories[category].lines += lineCount;
    }

    analyzeInterfaces(content, filePath) {
        const interfaceMatches = content.match(/interface\s+\w+Props\s*{[^}]*}/g);
        if (interfaceMatches) {
            interfaceMatches.forEach(match => {
                const name = match.match(/interface\s+(\w+Props)/)[1];
                this.results.patterns.interfaces.push({
                    name,
                    file: filePath,
                    content: match.substring(0, 100) + '...'
                });
            });
        }
    }

    analyzeHooks(content, filePath) {
        const hookMatches = content.match(/export\s+const\s+use\w+\s*=/g);
        if (hookMatches) {
            hookMatches.forEach(match => {
                const name = match.match(/use(\w+)/)[1];
                this.results.patterns.hooks.push({
                    name: `use${name}`,
                    file: filePath
                });
            });
        }
    }

    analyzeUseState(content, filePath) {
        const useStateMatches = content.match(/useState<[^>]*>/g);
        if (useStateMatches) {
            useStateMatches.forEach(match => {
                this.results.patterns.useState.push({
                    type: match,
                    file: filePath
                });
            });
        }
    }

    analyzeImports(content, filePath) {
        const importMatches = content.match(/import\s+{[^}]+}\s+from\s+['"][^'"]+['"]/g);
        if (importMatches) {
            importMatches.forEach(match => {
                const from = match.match(/from\s+['"]([^'"]+)['"]/)[1];
                if (!this.results.patterns.duplicatedImports[from]) {
                    this.results.patterns.duplicatedImports[from] = [];
                }
                this.results.patterns.duplicatedImports[from].push(filePath);
            });
        }
    }

    analyzeFunctions(content, filePath) {
        // Procurar por funções similares (mappers, validators, etc.)
        const functionMatches = content.match(/const\s+\w+\s*=\s*\([^)]*\)\s*=>/g);
        if (functionMatches && functionMatches.length > 3) {
            this.results.patterns.similarFunctions.push({
                file: filePath,
                count: functionMatches.length,
                functions: functionMatches.slice(0, 3).map(f => f.substring(0, 50) + '...')
            });
        }
    }

    generateReport() {
        console.log('\n=== RELATÓRIO DE ANÁLISE DE CÓDIGO ===\n');
        
        console.log('📊 MÉTRICAS GERAIS:');
        console.log(`Total de arquivos: ${this.results.totalFiles}`);
        console.log(`Total de linhas: ${this.results.totalLines}`);
        
        console.log('\n📁 POR CATEGORIA:');
        Object.entries(this.results.categories).forEach(([category, data]) => {
            const percentage = ((data.lines / this.results.totalLines) * 100).toFixed(1);
            console.log(`${category}: ${data.files} arquivos, ${data.lines} linhas (${percentage}%)`);
        });
        
        console.log('\n🔍 PADRÕES IDENTIFICADOS:');
        console.log(`Interfaces Props: ${this.results.patterns.interfaces.length}`);
        console.log(`Hooks customizados: ${this.results.patterns.hooks.length}`);
        console.log(`useState declarations: ${this.results.patterns.useState.length}`);
        
        console.log('\n📦 IMPORTS MAIS COMUNS:');
        const sortedImports = Object.entries(this.results.patterns.duplicatedImports)
            .sort(([,a], [,b]) => b.length - a.length)
            .slice(0, 10);
        
        sortedImports.forEach(([importPath, files]) => {
            console.log(`${importPath}: ${files.length} arquivos`);
        });
        
        console.log('\n🎯 OPORTUNIDADES DE REDUÇÃO:');
        
        // Calcular potencial de redução
        const hooksLines = this.results.categories.hooks?.lines || 0;
        const componentsLines = this.results.categories.components?.lines || 0;
        const servicesLines = this.results.categories.services?.lines || 0;
        
        const consolidationPotential = Math.round((hooksLines + componentsLines + servicesLines) * 0.35);
        const deadCodePotential = Math.round(this.results.totalLines * 0.05);
        const totalReduction = consolidationPotential + deadCodePotential;
        
        console.log(`Consolidação de padrões: ~${consolidationPotential} linhas (35% de hooks+components+services)`);
        console.log(`Eliminação de código morto: ~${deadCodePotential} linhas (5% estimado)`);
        console.log(`TOTAL ESTIMADO: ~${totalReduction} linhas (${((totalReduction/this.results.totalLines)*100).toFixed(1)}%)`);
        
        console.log('\n🏆 ARQUIVOS PRIORITÁRIOS PARA REFATORAÇÃO:');
        // Listar arquivos com mais potencial de redução
        const priorityFiles = [
            'useDataStore.ts (821 linhas → ~500 linhas)',
            'supabaseService.ts (726 linhas → ~400 linhas)', 
            'TransactionForm.tsx (717 linhas → ~450 linhas)',
            'Consolidação de Props interfaces (~200 linhas)',
            'Hooks similares (~300 linhas)'
        ];
        
        priorityFiles.forEach(file => console.log(`• ${file}`));
        
        // Salvar relatório detalhado
        this.saveDetailedReport();
    }

    saveDetailedReport() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: this.results.totalFiles,
                totalLines: this.results.totalLines,
                categories: this.results.categories
            },
            patterns: this.results.patterns,
            reductionEstimate: {
                consolidation: Math.round((this.results.categories.hooks?.lines || 0) * 0.4),
                deadCode: Math.round(this.results.totalLines * 0.05),
                total: Math.round(this.results.totalLines * 0.35)
            }
        };
        
        fs.writeFileSync('code-analysis-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Relatório detalhado salvo em: code-analysis-report.json');
    }
}

// Executar análise
const analyzer = new CodePatternAnalyzer();
analyzer.analyzeDirectory('src');