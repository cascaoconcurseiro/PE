import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { FinancialErrorDetector } from '../FinancialErrorDetector';

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
const consoleInfoSpy = vi.spyOn(console, 'info').mockImplementation(() => {});

describe('FinancialErrorDetector - Property Tests', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleInfoSpy.mockClear();
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 9: NaN Detection and Error Source Identification**
   * **Validates: Requirements 6.2, 6.3**
   */
  it('should always detect NaN values in calculation results', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(NaN),
          fc.constant(Infinity),
          fc.constant(-Infinity),
          fc.double({ min: -1000, max: 1000, noNaN: true }),
          fc.record({
            value: fc.constant(NaN),
            nested: fc.record({ amount: fc.constant(NaN) })
          }),
          fc.array(fc.oneof(fc.constant(NaN), fc.double({ noNaN: true })))
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (result, source, operation) => {
          const inputs = [100, 200, 'test'];
          const hasNaN = FinancialErrorDetector.detectNaN(result, source, operation, inputs);
          
          // Should detect NaN correctly
          const expectedNaN = typeof result === 'number' ? isNaN(result) : 
                             (typeof result === 'object' && result !== null);
          
          if (typeof result === 'number' && isNaN(result)) {
            expect(hasNaN).toBe(true);
          }
          
          // Should always return boolean
          expect(typeof hasNaN).toBe('boolean');
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should safely execute any calculation with error handling', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          // Safe operations
          fc.constant(() => 42),
          fc.constant(() => 100 + 200),
          fc.constant(() => 1000),
          // Unsafe operations
          fc.constant(() => NaN),
          fc.constant(() => { throw new Error('Test error'); }),
          fc.constant(() => 1 / 0),
          fc.constant(() => Math.sqrt(-1))
        ),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.oneof(fc.double({ noNaN: true }), fc.constant(0), fc.constant(null)),
        (operation, source, operationName, fallback) => {
          const inputs = [1, 2, 3];
          const result = FinancialErrorDetector.safeCalculate(
            operation,
            source,
            operationName,
            inputs,
            fallback
          );
          
          // Should always return a result object
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
          expect(Array.isArray(result.errors)).toBe(true);
          expect(Array.isArray(result.warnings)).toBe(true);
          expect(result.metadata).toBeDefined();
          expect(typeof result.metadata.inputsValidated).toBe('boolean');
          expect(typeof result.metadata.fallbacksUsed).toBe('number');
          expect(typeof result.metadata.calculationTime).toBe('number');
          
          // Should never return undefined result
          expect(result.result).toBeDefined();
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle any input validation scenario', () => {
    fc.assert(
      fc.property(
        fc.array(fc.oneof(
          fc.double({ noNaN: true }),
          fc.constant(NaN),
          fc.constant(null),
          fc.constant(undefined),
          fc.constant(Infinity),
          fc.string(),
          fc.boolean(),
          fc.array(fc.oneof(fc.double({ noNaN: true }), fc.constant(NaN))),
          fc.record({ amount: fc.oneof(fc.double({ noNaN: true }), fc.constant(NaN)) })
        ), { maxLength: 10 }),
        (inputs) => {
          const operation = () => inputs.reduce((sum: number, val: any) => {
            const num = typeof val === 'number' ? val : 0;
            return sum + num;
          }, 0);
          
          const result = FinancialErrorDetector.safeCalculate(
            operation,
            'test-source',
            'test-operation',
            inputs,
            0
          );
          
          // Should handle any inputs without crashing
          expect(result).toBeDefined();
          expect(typeof result.success).toBe('boolean');
          
          // Result should be a valid number (never NaN)
          if (typeof result.result === 'number') {
            expect(isNaN(result.result)).toBe(false);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should generate health reports for any error history', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          type: fc.constantFrom('NaN_DETECTED', 'INVALID_INPUT', 'CALCULATION_ERROR', 'DATA_CORRUPTION'),
          source: fc.string({ minLength: 1, maxLength: 20 }),
          severity: fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
          message: fc.string({ minLength: 1, maxLength: 100 })
        }), { maxLength: 50 }),
        fc.integer({ min: 1, max: 168 }), // 1 to 168 hours (1 week)
        (errorData, periodHours) => {
          // Clear and add test errors
          FinancialErrorDetector.clearErrors();
          
          errorData.forEach(error => {
            FinancialErrorDetector.detectAndLog({
              type: error.type as any,
              source: error.source,
              context: {
                operation: 'test-operation',
                inputs: [1, 2, 3]
              },
              severity: error.severity as any,
              message: error.message
            });
          });
          
          const report = FinancialErrorDetector.getHealthReport(periodHours);
          
          // Should always return a valid report structure
          expect(report).toBeDefined();
          expect(report.timestamp).toBeInstanceOf(Date);
          expect(report.period.start).toBeInstanceOf(Date);
          expect(report.period.end).toBeInstanceOf(Date);
          expect(typeof report.summary.totalOperations).toBe('number');
          expect(typeof report.summary.successfulOperations).toBe('number');
          expect(typeof report.summary.errorCount).toBe('number');
          expect(typeof report.summary.errorRate).toBe('number');
          expect(typeof report.errorsByType).toBe('object');
          expect(typeof report.errorsBySeverity).toBe('object');
          expect(Array.isArray(report.topErrorSources)).toBe(true);
          expect(Array.isArray(report.recommendations)).toBe(true);
          expect(typeof report.dataQualityScore).toBe('number');
          expect(report.dataQualityScore).toBeGreaterThanOrEqual(0);
          expect(report.dataQualityScore).toBeLessThanOrEqual(100);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should log errors with consistent structure', () => {
    fc.assert(
      fc.property(
        fc.constantFrom('NaN_DETECTED', 'INVALID_INPUT', 'CALCULATION_ERROR', 'DATA_CORRUPTION'),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.array(fc.oneof(fc.double({ noNaN: true }), fc.string(), fc.boolean()), { maxLength: 5 }),
        fc.string({ minLength: 1, maxLength: 100 }),
        fc.constantFrom('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'),
        (type, source, operation, inputs, message, severity) => {
          FinancialErrorDetector.clearErrors();
          
          FinancialErrorDetector.logError(
            type as any,
            source,
            operation,
            inputs,
            message,
            severity as any
          );
          
          const recentErrors = FinancialErrorDetector.getRecentErrors(1);
          
          // Should have logged exactly one error
          expect(recentErrors).toHaveLength(1);
          
          const error = recentErrors[0];
          expect(error.type).toBe(type);
          expect(error.source).toBe(source);
          expect(error.context.operation).toBe(operation);
          expect(error.severity).toBe(severity);
          expect(error.message).toBe(message);
          expect(error.id).toBeDefined();
          expect(error.timestamp).toBeInstanceOf(Date);
          expect(Array.isArray(error.context.inputs)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('should handle memory management correctly', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1000, max: 2000 }),
        (errorCount) => {
          FinancialErrorDetector.clearErrors();
          
          // Generate many errors
          for (let i = 0; i < errorCount; i++) {
            FinancialErrorDetector.logError(
              'INVALID_INPUT',
              `source-${i}`,
              `operation-${i}`,
              [i],
              `Error ${i}`,
              'LOW'
            );
          }
          
          const recentErrors = FinancialErrorDetector.getRecentErrors(2000);
          
          // Should not exceed memory limit (1000 errors max)
          expect(recentErrors.length).toBeLessThanOrEqual(1000);
          
          // Should keep the most recent errors
          if (errorCount > 1000) {
            expect(recentErrors.length).toBe(1000);
            // Last error should be the most recent one
            expect(recentErrors[recentErrors.length - 1].source).toBe(`source-${errorCount - 1}`);
          }
        }
      ),
      { numRuns: 10 } // Fewer runs for performance
    );
  });
});

describe('FinancialErrorDetector - Unit Tests', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
    consoleWarnSpy.mockClear();
    consoleInfoSpy.mockClear();
  });

  it('should detect NaN in simple numbers', () => {
    const hasNaN = FinancialErrorDetector.detectNaN(NaN, 'test-source', 'test-op', []);
    expect(hasNaN).toBe(true);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it('should not detect NaN in valid numbers', () => {
    const hasNaN = FinancialErrorDetector.detectNaN(42, 'test-source', 'test-op', []);
    expect(hasNaN).toBe(false);
  });

  it('should detect NaN in nested objects', () => {
    const obj = { balance: NaN, nested: { amount: 100 } };
    const hasNaN = FinancialErrorDetector.detectNaN(obj, 'test-source', 'test-op', []);
    expect(hasNaN).toBe(true);
  });

  it('should detect NaN in arrays', () => {
    const arr = [100, NaN, 200];
    const hasNaN = FinancialErrorDetector.detectNaN(arr, 'test-source', 'test-op', []);
    expect(hasNaN).toBe(true);
  });

  it('should handle successful calculations', () => {
    const result = FinancialErrorDetector.safeCalculate(
      () => 100 + 200,
      'test-source',
      'addition',
      [100, 200],
      0
    );
    
    expect(result.success).toBe(true);
    expect(result.result).toBe(300);
    expect(result.errors).toHaveLength(0);
  });

  it('should handle failed calculations with fallback', () => {
    const result = FinancialErrorDetector.safeCalculate(
      () => { throw new Error('Test error'); },
      'test-source',
      'failing-op',
      [1, 2],
      999
    );
    
    expect(result.success).toBe(false);
    expect(result.result).toBe(999);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should handle NaN results with fallback', () => {
    const result = FinancialErrorDetector.safeCalculate(
      () => NaN,
      'test-source',
      'nan-op',
      [1, 2],
      0
    );
    
    expect(result.success).toBe(false);
    expect(result.result).toBe(0);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  it('should log different severity levels correctly', () => {
    FinancialErrorDetector.logError('DATA_CORRUPTION', 'test', 'op', [], 'Critical error', 'CRITICAL');
    FinancialErrorDetector.logError('CALCULATION_ERROR', 'test', 'op', [], 'High error', 'HIGH');
    FinancialErrorDetector.logError('INVALID_INPUT', 'test', 'op', [], 'Medium error', 'MEDIUM');
    FinancialErrorDetector.logError('NaN_DETECTED', 'test', 'op', [], 'Low error', 'LOW');
    
    expect(consoleSpy).toHaveBeenCalledTimes(2); // CRITICAL and HIGH
    expect(consoleWarnSpy).toHaveBeenCalledTimes(1); // MEDIUM
    expect(consoleInfoSpy).toHaveBeenCalledTimes(1); // LOW
  });

  it('should generate health report with correct structure', () => {
    // Add some test errors
    FinancialErrorDetector.logError('NaN_DETECTED', 'source1', 'op1', [], 'Error 1', 'HIGH');
    FinancialErrorDetector.logError('INVALID_INPUT', 'source2', 'op2', [], 'Error 2', 'MEDIUM');
    FinancialErrorDetector.logError('NaN_DETECTED', 'source1', 'op3', [], 'Error 3', 'HIGH');
    
    const report = FinancialErrorDetector.getHealthReport(24);
    
    expect(report.summary.errorCount).toBe(3);
    expect(report.errorsByType.NaN_DETECTED).toBe(2);
    expect(report.errorsByType.INVALID_INPUT).toBe(1);
    expect(report.errorsBySeverity.HIGH).toBe(2);
    expect(report.errorsBySeverity.MEDIUM).toBe(1);
    expect(report.topErrorSources[0].source).toBe('source1');
    expect(report.topErrorSources[0].count).toBe(2);
    expect(Array.isArray(report.recommendations)).toBe(true);
  });

  it('should clear errors correctly', () => {
    FinancialErrorDetector.logError('INVALID_INPUT', 'test', 'op', [], 'Error', 'LOW');
    expect(FinancialErrorDetector.getRecentErrors(1)).toHaveLength(1);
    
    FinancialErrorDetector.clearErrors();
    expect(FinancialErrorDetector.getRecentErrors(1)).toHaveLength(0);
  });

  it('should sanitize sensitive data in inputs', () => {
    const sensitiveInputs = [
      { password: 'secret123', amount: 100 },
      { token: 'abc123', balance: 200 },
      { secret: 'hidden', value: 300 }
    ];
    
    FinancialErrorDetector.logError(
      'INVALID_INPUT',
      'test-source',
      'test-op',
      sensitiveInputs,
      'Test error',
      'LOW'
    );
    
    const errors = FinancialErrorDetector.getRecentErrors(1);
    const loggedInputs = errors[0].context.inputs;
    
    expect(loggedInputs[0].password).toBe('[REDACTED]');
    expect(loggedInputs[1].token).toBe('[REDACTED]');
    expect(loggedInputs[2].secret).toBe('[REDACTED]');
    expect(loggedInputs[0].amount).toBe(100); // Non-sensitive data preserved
  });

  it('should validate inputs correctly', () => {
    const validInputs = [100, 200, 'test'];
    const invalidInputs = [NaN, null, undefined, Infinity];
    
    // Test with valid inputs
    const validResult = FinancialErrorDetector.safeCalculate(
      () => 300,
      'test',
      'valid-test',
      validInputs,
      0
    );
    expect(validResult.metadata.inputsValidated).toBe(true);
    expect(validResult.warnings).toHaveLength(0);
    
    // Test with invalid inputs
    const invalidResult = FinancialErrorDetector.safeCalculate(
      () => 300,
      'test',
      'invalid-test',
      invalidInputs,
      0
    );
    expect(invalidResult.metadata.inputsValidated).toBe(false);
    expect(invalidResult.warnings.length).toBeGreaterThan(0);
  });

  it('should generate appropriate recommendations', () => {
    // Clear and add specific error patterns
    FinancialErrorDetector.clearErrors();
    
    // Add multiple NaN errors
    for (let i = 0; i < 5; i++) {
      FinancialErrorDetector.logError('NaN_DETECTED', 'calc-engine', 'sum', [], 'NaN detected', 'HIGH');
    }
    
    // Add critical error
    FinancialErrorDetector.logError('DATA_CORRUPTION', 'database', 'fetch', [], 'Critical error', 'CRITICAL');
    
    const report = FinancialErrorDetector.getHealthReport(1);
    
    expect(report.recommendations).toContain('NaN values detected. Review mathematical operations and input validation.');
    expect(report.recommendations).toContain('Critical errors detected. Immediate investigation required.');
    expect(report.recommendations).toContain('Data corruption detected. Review data storage and retrieval processes.');
  });
});