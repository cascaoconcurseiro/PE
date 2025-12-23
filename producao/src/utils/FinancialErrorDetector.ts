import { Transaction, Account } from '../types';
import { SafeFinancialCalculator } from './SafeFinancialCalculator';

/**
 * Financial Error Detection and Logging System
 * 
 * Provides comprehensive error detection, logging, and health reporting
 * for financial calculations to identify and track NaN sources.
 */

export interface FinancialCalculationError {
  id: string;
  timestamp: Date;
  type: 'NaN_DETECTED' | 'INVALID_INPUT' | 'CALCULATION_ERROR' | 'DATA_CORRUPTION';
  source: string;
  context: {
    operation: string;
    inputs: any[];
    expectedOutput?: any;
    actualOutput?: any;
  };
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  message: string;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export interface FinancialHealthReport {
  timestamp: Date;
  period: {
    start: Date;
    end: Date;
  };
  summary: {
    totalOperations: number;
    successfulOperations: number;
    errorCount: number;
    errorRate: number;
  };
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  topErrorSources: Array<{
    source: string;
    count: number;
    percentage: number;
  }>;
  recommendations: string[];
  dataQualityScore: number; // 0-100
}

export interface SafeCalculationResult<T> {
  success: boolean;
  result: T;
  errors: FinancialCalculationError[];
  warnings: string[];
  metadata: {
    inputsValidated: boolean;
    fallbacksUsed: number;
    calculationTime: number;
  };
}

/**
 * Financial Error Detector - Comprehensive error detection and logging
 */
export class FinancialErrorDetector {
  private static errors: FinancialCalculationError[] = [];
  private static operationCount = 0;
  private static successCount = 0;

  /**
   * Detects and logs financial calculation errors
   * @param error - Error details to log
   */
  static detectAndLog(error: Omit<FinancialCalculationError, 'id' | 'timestamp'>): void {
    const fullError: FinancialCalculationError = {
      ...error,
      id: `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date()
    };

    this.errors.push(fullError);

    // Log to console based on severity
    switch (error.severity) {
      case 'CRITICAL':
        console.error('🚨 CRITICAL Financial Error:', fullError);
        break;
      case 'HIGH':
        console.error('❌ HIGH Financial Error:', fullError);
        break;
      case 'MEDIUM':
        console.warn('⚠️ MEDIUM Financial Error:', fullError);
        break;
      case 'LOW':
        console.info('ℹ️ LOW Financial Error:', fullError);
        break;
    }

    // Keep only last 1000 errors to prevent memory issues
    if (this.errors.length > 1000) {
      this.errors = this.errors.slice(-1000);
    }
  }

  /**
   * Logs a structured error with context
   * @param type - Type of error
   * @param source - Source of the error
   * @param operation - Operation that failed
   * @param inputs - Input values that caused the error
   * @param message - Human-readable error message
   * @param severity - Error severity level
   * @param metadata - Additional metadata
   */
  static logError(
    type: FinancialCalculationError['type'],
    source: string,
    operation: string,
    inputs: any[],
    message: string,
    severity: FinancialCalculationError['severity'] = 'MEDIUM',
    metadata?: Record<string, any>
  ): void {
    this.detectAndLog({
      type,
      source,
      context: {
        operation,
        inputs: this.sanitizeInputsForLogging(inputs)
      },
      severity,
      message,
      stackTrace: new Error().stack,
      metadata
    });
  }

  /**
   * Detects NaN values in calculation results and logs them
   * @param result - Calculation result to check
   * @param source - Source of the calculation
   * @param operation - Operation that produced the result
   * @param inputs - Input values used in calculation
   * @returns True if NaN was detected
   */
  static detectNaN(
    result: any,
    source: string,
    operation: string,
    inputs: any[]
  ): boolean {
    if (typeof result === 'number' && isNaN(result)) {
      this.logError(
        'NaN_DETECTED',
        source,
        operation,
        inputs,
        `NaN detected in ${operation} from ${source}`,
        'HIGH',
        { result, detectedAt: new Date().toISOString() }
      );
      return true;
    }

    // Check for NaN in objects/arrays
    if (typeof result === 'object' && result !== null) {
      const hasNaN = this.deepNaNCheck(result);
      if (hasNaN) {
        this.logError(
          'NaN_DETECTED',
          source,
          operation,
          inputs,
          `NaN detected in object result from ${operation} in ${source}`,
          'HIGH',
          { result: this.sanitizeInputsForLogging([result])[0] }
        );
        return true;
      }
    }

    return false;
  }

  /**
   * Performs a safe calculation with comprehensive error detection
   * @param operation - Function to execute safely
   * @param source - Source identifier for logging
   * @param operationName - Name of the operation
   * @param inputs - Input values for the operation
   * @param fallback - Fallback value if operation fails
   * @returns Safe calculation result with error tracking
   */
  static safeCalculate<T>(
    operation: () => T,
    source: string,
    operationName: string,
    inputs: any[],
    fallback: T
  ): SafeCalculationResult<T> {
    const startTime = performance.now();
    const errors: FinancialCalculationError[] = [];
    const warnings: string[] = [];
    let fallbacksUsed = 0;
    let inputsValidated = false;

    this.operationCount++;

    try {
      // Validate inputs first
      const inputValidation = this.validateInputs(inputs);
      inputsValidated = inputValidation.valid;
      
      if (!inputValidation.valid) {
        warnings.push(...inputValidation.warnings);
        fallbacksUsed += inputValidation.sanitizedCount;
      }

      // Execute operation
      const result = operation();
      const calculationTime = performance.now() - startTime;

      // Check for NaN in result
      const hasNaN = this.detectNaN(result, source, operationName, inputs);
      
      if (hasNaN) {
        // Return fallback if NaN detected
        this.logError(
          'NaN_DETECTED',
          source,
          operationName,
          inputs,
          `Operation returned NaN, using fallback value`,
          'HIGH',
          { originalResult: result, fallbackValue: fallback }
        );
        
        return {
          success: false,
          result: fallback,
          errors: this.getRecentErrors(1),
          warnings,
          metadata: {
            inputsValidated,
            fallbacksUsed: fallbacksUsed + 1,
            calculationTime
          }
        };
      }

      this.successCount++;
      
      return {
        success: true,
        result,
        errors: [],
        warnings,
        metadata: {
          inputsValidated,
          fallbacksUsed,
          calculationTime
        }
      };

    } catch (error) {
      const calculationTime = performance.now() - startTime;
      
      this.logError(
        'CALCULATION_ERROR',
        source,
        operationName,
        inputs,
        `Calculation failed: ${error instanceof Error ? error.message : String(error)}`,
        'HIGH',
        { 
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined
        }
      );

      return {
        success: false,
        result: fallback,
        errors: this.getRecentErrors(1),
        warnings,
        metadata: {
          inputsValidated,
          fallbacksUsed: fallbacksUsed + 1,
          calculationTime
        }
      };
    }
  }

  /**
   * Generates a comprehensive health report
   * @param periodHours - Number of hours to include in report (default: 24)
   * @returns Financial health report
   */
  static getHealthReport(periodHours: number = 24): FinancialHealthReport {
    const now = new Date();
    const periodStart = new Date(now.getTime() - (periodHours * 60 * 60 * 1000));
    
    const periodErrors = this.errors.filter(
      error => error.timestamp >= periodStart && error.timestamp <= now
    );

    const errorsByType = this.groupBy(periodErrors, 'type');
    const errorsBySeverity = this.groupBy(periodErrors, 'severity');
    const errorsBySource = this.groupBy(periodErrors, 'source');

    const topErrorSources = Object.entries(errorsBySource)
      .map(([source, count]) => ({
        source,
        count,
        percentage: (count / periodErrors.length) * 100
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const errorRate = this.operationCount > 0 ? 
      ((this.operationCount - this.successCount) / this.operationCount) * 100 : 0;

    const dataQualityScore = Math.max(0, 100 - (errorRate * 2));

    const recommendations = this.generateRecommendations(
      errorsByType,
      errorsBySeverity,
      errorRate,
      topErrorSources
    );

    return {
      timestamp: now,
      period: {
        start: periodStart,
        end: now
      },
      summary: {
        totalOperations: this.operationCount,
        successfulOperations: this.successCount,
        errorCount: periodErrors.length,
        errorRate
      },
      errorsByType,
      errorsBySeverity,
      topErrorSources,
      recommendations,
      dataQualityScore
    };
  }

  /**
   * Clears error history (useful for testing or memory management)
   */
  static clearErrors(): void {
    this.errors = [];
    this.operationCount = 0;
    this.successCount = 0;
  }

  /**
   * Gets recent errors for debugging
   * @param count - Number of recent errors to return
   * @returns Array of recent errors
   */
  static getRecentErrors(count: number = 10): FinancialCalculationError[] {
    return this.errors.slice(-count);
  }

  /**
   * Validates inputs for financial calculations
   * @param inputs - Array of input values
   * @returns Validation result
   */
  private static validateInputs(inputs: any[]): {
    valid: boolean;
    warnings: string[];
    sanitizedCount: number;
  } {
    const warnings: string[] = [];
    let sanitizedCount = 0;

    for (let i = 0; i < inputs.length; i++) {
      const input = inputs[i];
      
      if (input === null || input === undefined) {
        warnings.push(`Input ${i} is null/undefined`);
        sanitizedCount++;
      } else if (typeof input === 'number' && (isNaN(input) || !isFinite(input))) {
        warnings.push(`Input ${i} is invalid number: ${input}`);
        sanitizedCount++;
      } else if (Array.isArray(input) && input.some(item => 
        typeof item === 'number' && (isNaN(item) || !isFinite(item))
      )) {
        warnings.push(`Input ${i} array contains invalid numbers`);
        sanitizedCount++;
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      sanitizedCount
    };
  }

  /**
   * Deep check for NaN values in nested objects/arrays
   * @param obj - Object to check
   * @returns True if NaN found
   */
  private static deepNaNCheck(obj: any): boolean {
    if (typeof obj === 'number') {
      return isNaN(obj);
    }
    
    if (Array.isArray(obj)) {
      return obj.some(item => this.deepNaNCheck(item));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).some(value => this.deepNaNCheck(value));
    }
    
    return false;
  }

  /**
   * Sanitizes inputs for safe logging (removes sensitive data, limits size)
   * @param inputs - Raw inputs
   * @returns Sanitized inputs safe for logging
   */
  private static sanitizeInputsForLogging(inputs: any[]): any[] {
    return inputs.map(input => {
      if (input === null || input === undefined) {
        return input;
      }
      
      if (typeof input === 'object') {
        // Limit object size and remove sensitive fields
        const sanitized: any = {};
        const keys = Object.keys(input).slice(0, 10); // Limit to 10 keys
        
        for (const key of keys) {
          if (key.toLowerCase().includes('password') || 
              key.toLowerCase().includes('secret') ||
              key.toLowerCase().includes('token')) {
            sanitized[key] = '[REDACTED]';
          } else {
            sanitized[key] = input[key];
          }
        }
        
        return sanitized;
      }
      
      return input;
    });
  }

  /**
   * Groups array of objects by a property
   * @param array - Array to group
   * @param property - Property to group by
   * @returns Object with grouped counts
   */
  private static groupBy<T>(array: T[], property: keyof T): Record<string, number> {
    return array.reduce((acc, item) => {
      const key = String(item[property]);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  /**
   * Generates recommendations based on error patterns
   * @param errorsByType - Errors grouped by type
   * @param errorsBySeverity - Errors grouped by severity
   * @param errorRate - Overall error rate
   * @param topErrorSources - Top error sources
   * @returns Array of recommendations
   */
  private static generateRecommendations(
    errorsByType: Record<string, number>,
    errorsBySeverity: Record<string, number>,
    errorRate: number,
    topErrorSources: Array<{ source: string; count: number; percentage: number }>
  ): string[] {
    const recommendations: string[] = [];

    if (errorRate > 10) {
      recommendations.push('High error rate detected. Consider reviewing data validation processes.');
    }

    if (errorsByType.NaN_DETECTED > 0) {
      recommendations.push('NaN values detected. Review mathematical operations and input validation.');
    }

    if (errorsByType.INVALID_INPUT > 5) {
      recommendations.push('Multiple invalid inputs detected. Strengthen input validation at data entry points.');
    }

    if (errorsBySeverity.CRITICAL > 0) {
      recommendations.push('Critical errors detected. Immediate investigation required.');
    }

    if (topErrorSources.length > 0 && topErrorSources[0].percentage > 50) {
      recommendations.push(`Primary error source: ${topErrorSources[0].source}. Focus debugging efforts here.`);
    }

    if (errorsByType.DATA_CORRUPTION > 0) {
      recommendations.push('Data corruption detected. Review data storage and retrieval processes.');
    }

    if (recommendations.length === 0) {
      recommendations.push('Financial calculations are operating normally. Continue monitoring.');
    }

    return recommendations;
  }
}