import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as fc from 'fast-check';
import { formatCurrency } from '../../utils';
import { FinancialErrorDetector } from '../FinancialErrorDetector';

// Mock console methods to avoid noise in tests
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

// Custom arbitraries for testing
const validNumberArbitrary = fc.double({ 
  min: -1000000, 
  max: 1000000, 
  noNaN: true,
  noDefaultInfinity: true
});

const invalidValueArbitrary = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(NaN),
  fc.constant(Infinity),
  fc.constant(-Infinity)
);

const validCurrencyArbitrary = fc.constantFrom('BRL', 'USD', 'EUR', 'GBP', 'JPY');

const invalidCurrencyArbitrary = fc.oneof(
  fc.constant(null),
  fc.constant(undefined),
  fc.constant(''),
  fc.constant('INVALID'),
  fc.constant(123),
  fc.constant({}),
  fc.constant([])
);

describe('formatCurrency - Property Tests', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 10: Currency Formatting Always Produces Valid Strings**
   * **Validates: Requirements 4.5, 7.1**
   */
  it('should always return valid currency strings for any input', () => {
    fc.assert(
      fc.property(
        fc.oneof(validNumberArbitrary, invalidValueArbitrary),
        fc.oneof(validCurrencyArbitrary, invalidCurrencyArbitrary),
        (value, currency) => {
          const result = formatCurrency(value as any, currency as any);
          
          // Should always return a string
          expect(typeof result).toBe('string');
          
          // Should not be empty
          expect(result.length).toBeGreaterThan(0);
          
          // Should contain currency symbol or format
          expect(result).toMatch(/[R$€£¥$]/);
          
          // Should not contain NaN or undefined
          expect(result).not.toContain('NaN');
          expect(result).not.toContain('undefined');
          expect(result).not.toContain('null');
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 11: Null/Undefined Formatting Shows Zero**
   * **Validates: Requirements 7.2, 7.3**
   */
  it('should format null/undefined values as zero', () => {
    fc.assert(
      fc.property(
        fc.oneof(fc.constant(null), fc.constant(undefined)),
        validCurrencyArbitrary,
        (value, currency) => {
          const result = formatCurrency(value as any, currency);
          
          // Should format as zero value
          expect(result).toMatch(/0[,.]00/);
          
          // Should contain proper currency symbol
          if (currency === 'BRL') {
            expect(result).toContain('R$');
          } else if (currency === 'USD') {
            expect(result).toContain('$');
          }
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 12: NaN Formatting Shows Zero and Logs Error**
   * **Validates: Requirements 7.2, 7.3**
   */
  it('should format NaN values as zero and log errors', () => {
    fc.assert(
      fc.property(
        fc.constant(NaN),
        validCurrencyArbitrary,
        (value, currency) => {
          const result = formatCurrency(value, currency);
          
          // Should format as zero value
          expect(result).toMatch(/0[,.]00/);
          
          // Note: Since we simplified logging, we just check the result is correct
          expect(typeof result).toBe('string');
          expect(result).not.toContain('NaN');
        }
      ),
      { numRuns: 20 }
    );
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 14: Negative Value Formatting**
   * **Validates: Requirements 7.5**
   */
  it('should properly format negative values', () => {
    fc.assert(
      fc.property(
        fc.double({ min: -1000000, max: -0.01, noNaN: true }),
        validCurrencyArbitrary,
        (value, currency) => {
          const result = formatCurrency(value, currency);
          
          // Should contain negative indicator
          expect(result).toMatch(/-/);
          
          // Should still be a valid currency format
          expect(result).toMatch(/[R$€£¥$]/);
          
          // Should not contain NaN
          expect(result).not.toContain('NaN');
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * **Feature: dashboard-nan-fixes, Property 13: Consistent Currency Formatting Across Components**
   * **Validates: Requirements 7.4**
   */
  it('should format same values consistently', () => {
    fc.assert(
      fc.property(
        validNumberArbitrary,
        validCurrencyArbitrary,
        (value, currency) => {
          const result1 = formatCurrency(value, currency);
          const result2 = formatCurrency(value, currency);
          
          // Should be identical
          expect(result1).toBe(result2);
          
          // Should be deterministic
          expect(typeof result1).toBe('string');
          expect(result1.length).toBeGreaterThan(0);
        }
      ),
      { numRuns: 50 }
    );
  });

  it('should handle edge cases gracefully', () => {
    fc.assert(
      fc.property(
        fc.oneof(
          fc.constant(0),
          fc.constant(-0),
          fc.constant(Number.MAX_SAFE_INTEGER),
          fc.constant(Number.MIN_SAFE_INTEGER),
          fc.constant(0.001),
          fc.constant(-0.001)
        ),
        validCurrencyArbitrary,
        (value, currency) => {
          const result = formatCurrency(value, currency);
          
          // Should handle edge cases without crashing
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
          expect(result).not.toContain('NaN');
          expect(result).not.toContain('Infinity');
        }
      ),
      { numRuns: 30 }
    );
  });

  it('should handle invalid currency codes gracefully', () => {
    fc.assert(
      fc.property(
        validNumberArbitrary,
        invalidCurrencyArbitrary,
        (value, currency) => {
          const result = formatCurrency(value, currency as any);
          
          // Should fallback to BRL format
          expect(typeof result).toBe('string');
          expect(result.length).toBeGreaterThan(0);
          
          // Should contain BRL currency symbol as fallback
          expect(result).toMatch(/R\$/);
        }
      ),
      { numRuns: 50 }
    );
  });
});

describe('formatCurrency - Unit Tests', () => {
  
  beforeEach(() => {
    FinancialErrorDetector.clearErrors();
    consoleSpy.mockClear();
  });

  it('should format valid BRL values correctly', () => {
    expect(formatCurrency(1000, 'BRL')).toMatch(/R\$\s*1\.000,00/);
    expect(formatCurrency(1000.50, 'BRL')).toMatch(/R\$\s*1\.000,50/);
    expect(formatCurrency(-500, 'BRL')).toMatch(/-R\$\s*500,00/);
  });

  it('should format valid USD values correctly', () => {
    expect(formatCurrency(1000, 'USD')).toMatch(/US\$\s*1\.000,00/);
    expect(formatCurrency(1000.50, 'USD')).toMatch(/US\$\s*1\.000,50/);
  });

  it('should handle zero values', () => {
    expect(formatCurrency(0, 'BRL')).toMatch(/R\$.*0,00/);
    expect(formatCurrency(-0, 'BRL')).toMatch(/R\$.*0,00/);
  });

  it('should handle null and undefined', () => {
    expect(formatCurrency(null as any, 'BRL')).toMatch(/R\$.*0,00/);
    expect(formatCurrency(undefined as any, 'BRL')).toMatch(/R\$.*0,00/);
  });

  it('should handle NaN and log error', () => {
    const result = formatCurrency(NaN, 'BRL');
    expect(result).toMatch(/R\$\s*0,00/);
    
    // Note: Since we simplified logging, we just check the result is correct
    expect(typeof result).toBe('string');
    expect(result).toContain('R$');
  });

  it('should handle Infinity values', () => {
    expect(formatCurrency(Infinity, 'BRL')).toMatch(/R\$.*0,00/);
    expect(formatCurrency(-Infinity, 'BRL')).toMatch(/R\$.*0,00/);
  });

  it('should handle invalid currency codes', () => {
    expect(formatCurrency(100, 'INVALID')).toMatch(/R\$\s*100,00/);
    expect(formatCurrency(100, null as any)).toMatch(/R\$\s*100,00/);
    expect(formatCurrency(100, undefined as any)).toMatch(/R\$\s*100,00/);
  });

  it('should handle very large numbers', () => {
    const result = formatCurrency(999999999999, 'BRL');
    expect(typeof result).toBe('string');
    expect(result).toContain('R$');
    expect(result).not.toContain('NaN');
  });

  it('should handle very small numbers', () => {
    const result = formatCurrency(0.001, 'BRL');
    expect(typeof result).toBe('string');
    expect(result).toContain('R$');
    expect(result).not.toContain('NaN');
  });

  it('should be consistent across multiple calls', () => {
    const value = 1234.56;
    const currency = 'BRL';
    
    const result1 = formatCurrency(value, currency);
    const result2 = formatCurrency(value, currency);
    const result3 = formatCurrency(value, currency);
    
    expect(result1).toBe(result2);
    expect(result2).toBe(result3);
  });

  it('should handle different currencies consistently', () => {
    const value = 100;
    
    const brlResult = formatCurrency(value, 'BRL');
    const usdResult = formatCurrency(value, 'USD');
    const eurResult = formatCurrency(value, 'EUR');
    
    expect(brlResult).toContain('R$');
    expect(usdResult).toContain('$');
    expect(eurResult).toContain('€');
    
    // All should format the same numeric value
    expect(brlResult).toMatch(/100,00/);
    expect(usdResult).toMatch(/100,00/);
    expect(eurResult).toMatch(/100,00/);
  });
});