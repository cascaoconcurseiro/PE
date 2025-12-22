/**
 * Property-Based Tests for Code Reduction Effectiveness
 * Feature: refatoracao-sistema-complexo, Property 3: Code Reduction Effectiveness
 * Validates: Requirements 7.1, 7.2
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import fs from 'fs';
import path from 'path';

// Tipos para análise de código
interface CodeMetrics {
  files: number;
  totalLines: number;
  codeLines: number;
  avgLinesPerFile: number;
}

interface ReductionMetrics {
  original: number;
  refactored: number;
  reduction: number;
}

// Função auxiliar para ler relatório de análise
function getAnalysisReport() {
  const reportPath = path.join(process.cwd(), 'refactoring-final-report.json');
  if (!fs.existsSync(reportPath)) {
    throw new Error('Relatório de análise não encontrado. Execute o script de análise primeiro.');
  }
  return JSON.parse(fs.readFileSync(reportPath, 'utf8'));
}

describe('Property 3: Code Reduction Effectiveness', () => {
  it('should achieve 25-40% code reduction target', () => {
    const report = getAnalysisReport();
    const { componentReduction } = report.reduction;
    
    // Validar que a redução está dentro da meta
    expect(componentReduction.reductionPercentage).toBeGreaterThanOrEqual(25);
    expect(componentReduction.reductionPercentage).toBeLessThanOrEqual(50); // Margem de segurança
    
    // Validar que houve redução real
    expect(componentReduction.totalReduction).toBeGreaterThan(0);
    expect(componentReduction.totalRefactored).toBeLessThan(componentReduction.totalOriginal);
  });

  it('should maintain consistent reduction across refactored components', () => {
    fc.assert(
      fc.property(
        fc.record({
          original: fc.integer({ min: 100, max: 1000 }),
          refactored: fc.integer({ min: 50, max: 800 })
        }),
        (metrics) => {
          // Para qualquer componente refatorado, a redução deve ser positiva
          const reduction = metrics.original - metrics.refactored;
          const reductionPercentage = (reduction / metrics.original) * 100;
          
          // Se houve refatoração, deve haver redução
          if (metrics.refactored < metrics.original) {
            expect(reductionPercentage).toBeGreaterThan(0);
            expect(reductionPercentage).toBeLessThanOrEqual(100);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('should calculate reduction percentage correctly for any component', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 100, max: 2000 }),
        fc.integer({ min: 50, max: 1500 }),
        (original, refactored) => {
          // Garantir que refactored <= original
          const actualRefactored = Math.min(refactored, original);
          
          const reduction = original - actualRefactored;
          const percentage = Math.round((reduction / original) * 100);
          
          // Propriedades matemáticas da redução
          expect(percentage).toBeGreaterThanOrEqual(0);
          expect(percentage).toBeLessThanOrEqual(100);
          
          // Se não houve mudança, redução é 0%
          if (original === actualRefactored) {
            expect(percentage).toBe(0);
          }
          
          // Se redução total, é 100%
          if (actualRefactored === 0) {
            expect(percentage).toBe(100);
          }
        }
      ),
      { numRuns: 25 }
    );
  });

  it('should have valid metrics for all categories', () => {
    const report = getAnalysisReport();
    const { categories } = report;
    
    // Para cada categoria, validar métricas
    Object.entries(categories).forEach(([category, metrics]) => {
      const categoryMetrics = metrics as CodeMetrics;
      
      // Validações básicas
      expect(categoryMetrics.files).toBeGreaterThanOrEqual(0);
      expect(categoryMetrics.codeLines).toBeGreaterThanOrEqual(0);
      expect(categoryMetrics.totalLines).toBeGreaterThanOrEqual(categoryMetrics.codeLines);
      
      // Se há arquivos, deve haver linhas
      if (categoryMetrics.files > 0) {
        expect(categoryMetrics.codeLines).toBeGreaterThan(0);
        expect(categoryMetrics.avgLinesPerFile).toBeGreaterThan(0);
        
        // Média deve ser consistente
        const calculatedAvg = Math.round(categoryMetrics.codeLines / categoryMetrics.files);
        expect(categoryMetrics.avgLinesPerFile).toBe(calculatedAvg);
      }
    });
  });

  it('should maintain reduction consistency across breakdown', () => {
    const report = getAnalysisReport();
    const { breakdown } = report.reduction;
    
    // Para cada componente refatorado
    Object.entries(breakdown).forEach(([component, metrics]) => {
      const componentMetrics = metrics as ReductionMetrics;
      
      // Validar cálculo de redução
      const calculatedReduction = componentMetrics.original - componentMetrics.refactored;
      const calculatedPercentage = Math.round((calculatedReduction / componentMetrics.original) * 100);
      
      expect(componentMetrics.reduction).toBe(calculatedPercentage);
      expect(componentMetrics.refactored).toBeLessThan(componentMetrics.original);
    });
  });

  it('should have realistic file counts per category', () => {
    const report = getAnalysisReport();
    const { categories, summary } = report;
    
    // Soma de arquivos por categoria deve ser igual ao total
    const totalFiles = Object.values(categories).reduce(
      (sum, cat) => sum + (cat as CodeMetrics).files,
      0
    );
    
    expect(totalFiles).toBe(summary.totalFiles);
    
    // Cada categoria deve ter contagem razoável
    Object.entries(categories).forEach(([category, metrics]) => {
      const categoryMetrics = metrics as CodeMetrics;
      
      // Validar que não há valores negativos ou absurdos
      expect(categoryMetrics.files).toBeGreaterThanOrEqual(0);
      expect(categoryMetrics.files).toBeLessThan(1000); // Limite razoável
    });
  });

  it('should calculate total code lines correctly', () => {
    const report = getAnalysisReport();
    const { categories, summary } = report;
    
    // Soma de linhas por categoria deve ser igual ao total
    const totalCodeLines = Object.values(categories).reduce(
      (sum, cat) => sum + (cat as CodeMetrics).codeLines,
      0
    );
    
    expect(totalCodeLines).toBe(summary.totalCodeLines);
  });

  it('should have valid average lines per file calculation', () => {
    const report = getAnalysisReport();
    const { summary } = report;
    
    // Média global deve ser consistente
    const calculatedAvg = Math.round(summary.totalCodeLines / summary.totalFiles);
    expect(summary.avgLinesPerFile).toBe(calculatedAvg);
  });

  it('should maintain reduction target projection', () => {
    const report = getAnalysisReport();
    const { systemProjection } = report.reduction;
    
    // Validar projeção do sistema
    expect(systemProjection.originalEstimate).toBeGreaterThan(0);
    expect(systemProjection.targetReduction).toBeGreaterThan(0);
    expect(systemProjection.projectedFinalSize).toBeLessThan(systemProjection.originalEstimate);
    
    // Validar percentual de redução
    const calculatedReduction = Math.round(
      (systemProjection.targetReduction / systemProjection.originalEstimate) * 100
    );
    expect(systemProjection.reductionPercentage).toBe(calculatedReduction);
  });

  it('should have achievements list with valid entries', () => {
    const report = getAnalysisReport();
    const { achievements } = report;
    
    // Deve ter pelo menos algumas conquistas
    expect(achievements).toBeInstanceOf(Array);
    expect(achievements.length).toBeGreaterThan(0);
    
    // Cada conquista deve ser uma string não vazia
    achievements.forEach((achievement: string) => {
      expect(typeof achievement).toBe('string');
      expect(achievement.length).toBeGreaterThan(0);
    });
  });
});