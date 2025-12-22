#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Analisador de complexidade ciclomática simplificado
class ComplexityAnalyzer {
    constructor() {
        this.results = [];
        this.totalComplexity = 0;
        this.fileCount = 0;
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
        
        try {
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
        } catch (error) {
            console.warn(`Erro ao ler diretório ${dirPath}:`, error.message);
        }
        
        return files;
    }

    analyzeFile(filePath) {
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const relativePath = path.relative('src', filePath);
            
            const complexity = this.calculateComplexity(content);
            const lines = content.split('\n').length;
            
            this.results.push({
                file: relativePath,
                complexity,
                lines,
                complexityPerLine: (complexity / lines).toFixed(3)
            });
            
            this.totalComplexity += complexity;
            this.fileCount++;
        } catch (error) {
            console.warn(`Erro ao analisar ${filePath}:`, error.message);
        }
    }

    calculateComplexity(content) {
        let complexity = 1; // Base complexity
        
        // Contar estruturas de controle que aumentam complexidade
        const patterns = [
            /\bif\s*\(/g,           // if statements
            /\belse\s+if\b/g,       // else if
            /\bwhile\s*\(/g,        // while loops
            /\bfor\s*\(/g,          // for loops
            /\bswitch\s*\(/g,       // switch statements
            /\bcase\s+/g,           // case statements
            /\bcatch\s*\(/g,        // catch blocks
            /\?\s*[^:]*:/g,         // ternary operators
            /&&/g,                  // logical AND
            /\|\|/g,                // logical OR
            /\bthrow\s+/g,          // throw statements
            /\breturn\s+/g          // return statements (múltiplos)
        ];
        
        patterns.forEach(pattern => {
            const matches = content.match(pattern);
            if (matches) {
                complexity += matches.length;
            }
        });
        
        // Penalizar funções muito longas
        const functionMatches = content.match(/function\s+\w+|const\s+\w+\s*=\s*\([^)]*\)\s*=>/g);
        if (functionMatches && functionMatches.length > 10) {
            complexity += Math.floor(functionMatches.length / 5);
        }
        
        return complexity;
    }

    generateReport() {
        console.log('\n=== ANÁLISE DE COMPLEXIDADE CICLOMÁTICA ===\n');
        
        const avgComplexity = (this.totalComplexity / this.fileCount).toFixed(2);
        console.log(`📊 MÉTRICAS GERAIS:`);
        console.log(`Total de arquivos analisados: ${this.fileCount}`);
        console.log(`Complexidade total: ${this.totalComplexity}`);
        console.log(`Complexidade média: ${avgComplexity}`);
        
        // Ordenar por complexidade
        const sortedResults = this.results.sort((a, b) => b.complexity - a.complexity);
        
        console.log('\n🔥 TOP 15 ARQUIVOS MAIS COMPLEXOS:');
        sortedResults.slice(0, 15).forEach((result, index) => {
            const status = result.complexity > 50 ? '🚨' : result.complexity > 25 ? '⚠️' : '✅';
            console.log(`${index + 1}. ${status} ${result.file}`);
            console.log(`   Complexidade: ${result.complexity} | Linhas: ${result.lines} | Ratio: ${result.complexityPerLine}`);
        });
        
        console.log('\n📈 DISTRIBUIÇÃO DE COMPLEXIDADE:');
        const lowComplexity = this.results.filter(r => r.complexity <= 10).length;
        const mediumComplexity = this.results.filter(r => r.complexity > 10 && r.complexity <= 25).length;
        const highComplexity = this.results.filter(r => r.complexity > 25 && r.complexity <= 50).length;
        const veryHighComplexity = this.results.filter(r => r.complexity > 50).length;
        
        console.log(`Baixa (≤10): ${lowComplexity} arquivos (${((lowComplexity/this.fileCount)*100).toFixed(1)}%)`);
        console.log(`Média (11-25): ${mediumComplexity} arquivos (${((mediumComplexity/this.fileCount)*100).toFixed(1)}%)`);
        console.log(`Alta (26-50): ${highComplexity} arquivos (${((highComplexity/this.fileCount)*100).toFixed(1)}%)`);
        console.log(`Muito Alta (>50): ${veryHighComplexity} arquivos (${((veryHighComplexity/this.fileCount)*100).toFixed(1)}%)`);
        
        console.log('\n🎯 RECOMENDAÇÕES:');
        const criticalFiles = sortedResults.filter(r => r.complexity > 50);
        if (criticalFiles.length > 0) {
            console.log(`• ${criticalFiles.length} arquivos com complexidade crítica (>50) precisam de refatoração urgente`);
        }
        
        const targetFiles = sortedResults.filter(r => r.complexity > 25);
        console.log(`• ${targetFiles.length} arquivos são candidatos prioritários para refatoração`);
        console.log(`• Meta: Reduzir complexidade média de ${avgComplexity} para ~${(avgComplexity * 0.7).toFixed(2)} (30% de redução)`);
        
        // Salvar relatório
        this.saveComplexityReport(sortedResults);
    }

    saveComplexityReport(sortedResults) {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                totalFiles: this.fileCount,
                totalComplexity: this.totalComplexity,
                averageComplexity: (this.totalComplexity / this.fileCount).toFixed(2)
            },
            distribution: {
                low: this.results.filter(r => r.complexity <= 10).length,
                medium: this.results.filter(r => r.complexity > 10 && r.complexity <= 25).length,
                high: this.results.filter(r => r.complexity > 25 && r.complexity <= 50).length,
                critical: this.results.filter(r => r.complexity > 50).length
            },
            topComplexFiles: sortedResults.slice(0, 20),
            allFiles: sortedResults
        };
        
        fs.writeFileSync('complexity-analysis-report.json', JSON.stringify(report, null, 2));
        console.log('\n📄 Relatório de complexidade salvo em: complexity-analysis-report.json');
    }
}

// Executar análise
const analyzer = new ComplexityAnalyzer();
analyzer.analyzeDirectory('src');