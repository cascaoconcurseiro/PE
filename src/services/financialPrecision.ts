/**
 * Biblioteca ÚNICA de Precisão Financeira
 * 
 * Usa Decimal.js para cálculos exatos (sem erros de ponto flutuante)
 * Garante cálculos financeiros precisos e consistentes
 * Padrão: 2 casas decimais para valores monetários
 */

import Decimal from 'decimal.js';

/**
 * Classe estática para operações financeiras precisas
 */
export class FinancialPrecision {
  private static readonly DECIMALS = 2;
  private static readonly PRECISION = 10; // Casas decimais internas

  /**
   * Arredonda para 2 casas decimais (padrão monetário)
   * CRÍTICO: Usa Decimal.js para evitar erros de ponto flutuante
   */
  static round(value: number | string | Decimal): number {
    return new Decimal(value)
      .toDecimalPlaces(this.DECIMALS, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Arredonda para N casas decimais
   */
  static roundTo(value: number | string | Decimal, decimals: number = 2): number {
    return new Decimal(value)
      .toDecimalPlaces(decimals, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Soma valores monetários com precisão
   */
  static sum(values: (number | string | Decimal)[]): number {
    if (values.length === 0) return 0;
    const result = values.reduce((acc: Decimal, val) => {
      return acc.plus(new Decimal(val));
    }, new Decimal(0));
    return result
      .toDecimalPlaces(this.DECIMALS, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Subtrai valores monetários com precisão
   */
  static subtract(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a)
      .minus(new Decimal(b))
      .toDecimalPlaces(this.DECIMALS, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Multiplica valores monetários com precisão
   */
  static multiply(a: number | string | Decimal, b: number | string | Decimal): number {
    return new Decimal(a)
      .times(new Decimal(b))
      .toDecimalPlaces(this.DECIMALS, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Divide valores monetários com precisão
   */
  static divide(a: number | string | Decimal, b: number | string | Decimal): number {
    const divisor = new Decimal(b);
    if (divisor.equals(0)) {
      throw new Error('Divisão por zero');
    }
    return new Decimal(a)
      .dividedBy(divisor)
      .toDecimalPlaces(this.DECIMALS, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Valida se dois valores são iguais (tolerância de 0.01 centavos)
   */
  static equals(
    a: number | string | Decimal,
    b: number | string | Decimal,
    tolerance: number = 0.01
  ): boolean {
    const diff = new Decimal(a).minus(new Decimal(b)).abs();
    return diff.lessThanOrEqualTo(tolerance);
  }

  /**
   * Valida soma de splits contra total
   */
  static validateSplits(
    splits: { assignedAmount: number }[],
    total: number
  ): { valid: boolean; difference: number; normalized?: { assignedAmount: number }[] } {
    const sum = this.sum(splits.map(s => s.assignedAmount));
    const difference = Math.abs(this.subtract(sum, total));
    const valid = difference <= 0.01; // Tolerância de 1 centavo

    if (!valid) {
      // Normalizar automaticamente
      const normalized = this.normalizeSplits(splits, total);
      return { valid: false, difference, normalized };
    }

    return { valid: true, difference: 0 };
  }

  /**
   * Normaliza splits para somar exatamente o total
   */
  static normalizeSplits(
    splits: { assignedAmount: number }[],
    total: number
  ): { assignedAmount: number }[] {
    if (splits.length === 0) return [];

    const currentSum = this.sum(splits.map(s => s.assignedAmount));
    
    if (currentSum === 0) {
      // Dividir igualmente
      const equalAmount = this.round(this.divide(total, splits.length));
      return splits.map(() => ({ assignedAmount: equalAmount }));
    }

    // Normalizar proporcionalmente
    const ratio = this.divide(total, currentSum);
    const normalized = splits.map(s => ({
      assignedAmount: this.round(this.multiply(s.assignedAmount, ratio))
    }));

    // Ajustar última parcela para garantir soma exata
    const normalizedSum = this.sum(normalized.map(s => s.assignedAmount));
    const difference = this.subtract(total, normalizedSum);

    if (Math.abs(difference) > 0.001 && normalized.length > 0) {
      const lastIndex = normalized.length - 1;
      normalized[lastIndex].assignedAmount = this.round(
        this.sum([normalized[lastIndex].assignedAmount, difference])
      );
    }

    return normalized;
  }

  /**
   * Valida se a soma de valores está correta
   */
  static validateSum(
    values: number[],
    expectedTotal: number,
    tolerance: number = 0.01
  ): { valid: boolean; actualSum: number; difference: number } {
    const actualSum = this.sum(values);
    const difference = Math.abs(this.subtract(actualSum, expectedTotal));
    const valid = difference <= tolerance;
    
    return { valid, actualSum, difference };
  }

  /**
   * Calcula juros compostos
   */
  static compoundInterest(
    principal: number | string | Decimal,
    rate: number | string | Decimal, // Taxa decimal (ex: 0.01 = 1%)
    periods: number
  ): number {
    const principalDec = new Decimal(principal);
    const rateDec = new Decimal(rate);
    const onePlusRate = new Decimal(1).plus(rateDec);
    const result = principalDec.times(onePlusRate.pow(periods));
    return this.round(result);
  }

  /**
   * Calcula valor presente
   */
  static presentValue(
    futureValue: number | string | Decimal,
    rate: number | string | Decimal,
    periods: number
  ): number {
    const futureDec = new Decimal(futureValue);
    const rateDec = new Decimal(rate);
    const onePlusRate = new Decimal(1).plus(rateDec);
    const result = futureDec.dividedBy(onePlusRate.pow(periods));
    return this.round(result);
  }

  /**
   * Calcula valor futuro
   */
  static futureValue(
    presentValue: number | string | Decimal,
    rate: number | string | Decimal,
    periods: number
  ): number {
    return this.compoundInterest(presentValue, rate, periods);
  }

  /**
   * Calcula parcela de financiamento (PMT)
   */
  static calculatePMT(
    principal: number | string | Decimal,
    rate: number | string | Decimal, // Taxa mensal
    periods: number
  ): number {
    const principalDec = new Decimal(principal);
    const rateDec = new Decimal(rate);

    if (rateDec.equals(0)) {
      return this.round(this.divide(principalDec, periods));
    }

    const onePlusRate = new Decimal(1).plus(rateDec);
    const factor = onePlusRate.pow(periods);
    const numerator = principalDec.times(rateDec).times(factor);
    const denominator = factor.minus(1);
    const pmt = numerator.dividedBy(denominator);

    return this.round(pmt);
  }

  /**
   * Valida cálculo financeiro
   */
  static validateFinancialCalculation(
    expected: number | string | Decimal,
    actual: number | string | Decimal,
    tolerance: number = 0.01,
    context?: string
  ): { valid: boolean; error?: string } {
    const difference = new Decimal(expected).minus(new Decimal(actual)).abs();
    const valid = difference.lessThanOrEqualTo(tolerance);
    
    if (!valid) {
      return {
        valid: false,
        error: `Cálculo inválido${context ? ` (${context})` : ''}: esperado ${expected}, obtido ${actual}, diferença ${difference.toNumber()}`
      };
    }
    
    return { valid: true };
  }
}

// ============================================================================
// EXPORTAR FUNÇÕES DE CONVENIÊNCIA (backward compatibility)
// ============================================================================

/**
 * @deprecated Use FinancialPrecision.round() instead
 * Mantido para compatibilidade com código existente
 */
export const round2dec = (num: number): number => {
  return FinancialPrecision.round(num);
};

/**
 * @deprecated Use FinancialPrecision.roundTo() instead
 */
export const round = (num: number, decimals: number = 2): number => {
  return FinancialPrecision.roundTo(num, decimals);
};

/**
 * @deprecated Use FinancialPrecision.equals() instead
 */
export const isEqual = (
  a: number,
  b: number,
  tolerance: number = 0.01
): boolean => {
  return FinancialPrecision.equals(a, b, tolerance);
};

/**
 * @deprecated Use FinancialPrecision.validateSum() instead
 */
export const validateSum = (
  values: number[],
  expectedTotal: number,
  tolerance: number = 0.01
): { valid: boolean; actualSum: number; difference: number } => {
  return FinancialPrecision.validateSum(values, expectedTotal, tolerance);
};

/**
 * @deprecated Use FinancialPrecision.normalizeSplits() instead
 */
export const normalizeSplits = (
  splits: { assignedAmount: number }[],
  total: number
): { assignedAmount: number }[] => {
  return FinancialPrecision.normalizeSplits(splits, total);
};

/**
 * @deprecated Use FinancialPrecision.compoundInterest() instead
 */
export const compoundInterest = (
  principal: number,
  rate: number,
  periods: number
): number => {
  return FinancialPrecision.compoundInterest(principal, rate, periods);
};

/**
 * @deprecated Use FinancialPrecision.presentValue() instead
 */
export const presentValue = (
  futureValue: number,
  rate: number,
  periods: number
): number => {
  return FinancialPrecision.presentValue(futureValue, rate, periods);
};

/**
 * @deprecated Use FinancialPrecision.futureValue() instead
 */
export const futureValue = (
  presentValue: number,
  rate: number,
  periods: number
): number => {
  return FinancialPrecision.futureValue(presentValue, rate, periods);
};

/**
 * @deprecated Use FinancialPrecision.calculatePMT() instead
 */
export const calculatePMT = (
  principal: number,
  rate: number,
  periods: number
): number => {
  return FinancialPrecision.calculatePMT(principal, rate, periods);
};

/**
 * @deprecated Use FinancialPrecision.validateFinancialCalculation() instead
 */
export const validateFinancialCalculation = (
  expected: number,
  actual: number,
  tolerance: number = 0.01,
  context?: string
): { valid: boolean; error?: string } => {
  return FinancialPrecision.validateFinancialCalculation(expected, actual, tolerance, context);
};
