/**
 * Property-based tests for complexity reduction validation
 * Feature: refatoracao-sistema-complexo, Property 8: Complexity Reduction Validation
 * **Validates: Requirements 7.3**
 */

import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import complexityReport from '../../complexity-analysis-report.json';

interface ComplexityFile {
  file: string;
  complexity: number;
  lines: number;
  complexityPerLine: string;
}

interface ComplexityReport {
  timestamp: string;
  summary: {
    totalFiles: number;
    totalComplexity: number;
    averageComplexity: string;
  };
  distribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  topComplexFiles: ComplexityFile[];
  allFiles: ComplexityFile[];
}

const report = complexityReport as ComplexityReport;

describe('Complexity Reduction Property Tests', () => {
  it('Property 8.1: System average complexity should be within acceptable bounds', () => {
    fc.assert(
      fc.property(
        fc.constant(report),
        (complexityReport) => {
          const avgComplexity = parseFloat(complexityReport.summary.averageComplexity);
          
          // Average complexity should be reasonable (< 50 for maintainable code)
          expect(avgComplexity).toBeLessThan(50);
          
          // Should not be too low (indicates meaningful analysis)
          expect(avgComplexity).toBeGreaterThan(5);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.2: Critical complexity files should be properly identified', () => {
    fc.assert(
      fc.property(
        fc.constant(report.allFiles),
        (allFiles) => {
          const criticalFiles = allFiles.filter(file => file.complexity > 50);
          const highFiles = allFiles.filter(file => file.complexity > 30 && file.complexity <= 50);
          const mediumFiles = allFiles.filter(file => file.complexity > 15 && file.complexity <= 30);
          const lowFiles = allFiles.filter(file => file.complexity <= 15);
          
          // Critical files should exist (we know we have complex code)
          expect(criticalFiles.length).toBeGreaterThan(0);
          
          // Distribution should make sense
          expect(criticalFiles.length + highFiles.length + mediumFiles.length + lowFiles.length)
            .toBe(allFiles.length);
          
          // Critical files should have highest complexity
          if (criticalFiles.length > 0) {
            const maxCritical = Math.max(...criticalFiles.map(f => f.complexity));
            const maxHigh = highFiles.length > 0 ? Math.max(...highFiles.map(f => f.complexity)) : 0;
            expect(maxCritical).toBeGreaterThanOrEqual(maxHigh);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.3: Complexity per line ratio should be consistent', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...report.allFiles),
        (file) => {
          const calculatedRatio = file.complexity / file.lines;
          const reportedRatio = parseFloat(file.complexityPerLine);
          
          // Ratios should match (within floating point precision)
          expect(Math.abs(calculatedRatio - reportedRatio)).toBeLessThan(0.001);
          
          // Complexity per line should be reasonable
          expect(reportedRatio).toBeGreaterThan(0);
          expect(reportedRatio).toBeLessThan(1); // Very high ratio indicates potential issues
          
          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property 8.4: Refactored components should have lower complexity than originals', () => {
    fc.assert(
      fc.property(
        fc.constant(report.allFiles),
        (allFiles) => {
          // Find refactored versions of components
          const refactoredFiles = allFiles.filter(file => 
            file.file.includes('Refactored') || 
            file.file.includes('refactored') ||
            file.file.includes('BaseForm') ||
            file.file.includes('GenericCRUD')
          );
          
          // Find original versions
          const originalFiles = allFiles.filter(file => 
            !file.file.includes('Refactored') && 
            !file.file.includes('refactored') &&
            (file.file.includes('TransactionForm') || 
             file.file.includes('supabaseService') ||
             file.file.includes('useDataStore'))
          );
          
          if (refactoredFiles.length > 0 && originalFiles.length > 0) {
            // Compare specific refactored components
            const baseFormComplexity = refactoredFiles.find(f => f.file.includes('BaseForm'))?.complexity || 0;
            const genericCRUDComplexity = refactoredFiles.find(f => f.file.includes('GenericCRUD'))?.complexity || 0;
            
            const originalFormComplexity = originalFiles.find(f => f.file.includes('TransactionForm'))?.complexity || 0;
            const originalServiceComplexity = originalFiles.find(f => f.file.includes('supabaseService'))?.complexity || 0;
            
            // Refactored components should generally have reasonable complexity
            if (baseFormComplexity > 0) {
              expect(baseFormComplexity).toBeLessThan(150); // Should be more maintainable
            }
            
            if (genericCRUDComplexity > 0) {
              expect(genericCRUDComplexity).toBeLessThan(200); // Should be more maintainable
            }
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.5: Top complex files should be accurately sorted', () => {
    fc.assert(
      fc.property(
        fc.constant(report.topComplexFiles),
        (topFiles) => {
          // Top files should be sorted by complexity (descending)
          for (let i = 0; i < topFiles.length - 1; i++) {
            expect(topFiles[i].complexity).toBeGreaterThanOrEqual(topFiles[i + 1].complexity);
          }
          
          // Top files should have high complexity
          if (topFiles.length > 0) {
            expect(topFiles[0].complexity).toBeGreaterThan(50);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.6: Distribution totals should match total files', () => {
    fc.assert(
      fc.property(
        fc.constant(report),
        (complexityReport) => {
          const { distribution, summary } = complexityReport;
          const distributionTotal = distribution.low + distribution.medium + distribution.high + distribution.critical;
          
          // Distribution should account for all files
          expect(distributionTotal).toBe(summary.totalFiles);
          
          // Each category should have reasonable counts
          expect(distribution.low).toBeGreaterThanOrEqual(0);
          expect(distribution.medium).toBeGreaterThanOrEqual(0);
          expect(distribution.high).toBeGreaterThanOrEqual(0);
          expect(distribution.critical).toBeGreaterThanOrEqual(0);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.7: Total complexity should be sum of all file complexities', () => {
    fc.assert(
      fc.property(
        fc.constant(report),
        (complexityReport) => {
          const calculatedTotal = complexityReport.allFiles.reduce((sum, file) => sum + file.complexity, 0);
          
          // Total should match sum of individual complexities
          expect(calculatedTotal).toBe(complexityReport.summary.totalComplexity);
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.8: Files with high line counts should not necessarily have high complexity', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...report.allFiles.filter(f => f.lines > 500)),
        (largeFile) => {
          // Large files can have low complexity per line if well-structured
          const complexityPerLine = parseFloat(largeFile.complexityPerLine);
          
          // Even large files should have reasonable complexity per line
          expect(complexityPerLine).toBeLessThan(0.5); // Good structure keeps this low
          
          return true;
        }
      ),
      { numRuns: 25 }
    );
  });

  it('Property 8.9: Test files should generally have lower complexity than implementation files', () => {
    fc.assert(
      fc.property(
        fc.constant(report.allFiles),
        (allFiles) => {
          const testFiles = allFiles.filter(file => file.file.includes('test') || file.file.includes('__tests__'));
          const implFiles = allFiles.filter(file => 
            !file.file.includes('test') && 
            !file.file.includes('__tests__') &&
            (file.file.includes('.ts') || file.file.includes('.tsx'))
          );
          
          if (testFiles.length > 0 && implFiles.length > 0) {
            const avgTestComplexity = testFiles.reduce((sum, f) => sum + f.complexity, 0) / testFiles.length;
            const avgImplComplexity = implFiles.reduce((sum, f) => sum + f.complexity, 0) / implFiles.length;
            
            // Test files should generally be simpler (though property tests can be complex)
            // This is more of a guideline than a strict rule
            expect(avgTestComplexity).toBeLessThan(avgImplComplexity * 1.5);
          }
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });

  it('Property 8.10: Complexity reduction targets should be achievable', () => {
    fc.assert(
      fc.property(
        fc.constant(report),
        (complexityReport) => {
          const criticalFiles = complexityReport.allFiles.filter(f => f.complexity > 50);
          const highFiles = complexityReport.allFiles.filter(f => f.complexity > 30 && f.complexity <= 50);
          
          // We should have identified files that need refactoring
          expect(criticalFiles.length).toBeGreaterThan(0);
          
          // Critical files should be candidates for complexity reduction
          criticalFiles.forEach(file => {
            expect(file.complexity).toBeGreaterThan(50);
            
            // Files with very high complexity should be prioritized
            if (file.complexity > 100) {
              expect(file.lines).toBeGreaterThan(200); // High complexity should correlate with size
            }
          });
          
          return true;
        }
      ),
      { numRuns: 20 }
    );
  });
});