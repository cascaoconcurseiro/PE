/**
 * Testes unitários para FinancialPrecision
 * 
 * Garante que cálculos financeiros são precisos e consistentes
 */

import { describe, it, expect } from 'vitest';
import { FinancialPrecision } from '../services/financialPrecision';

describe('FinancialPrecision', () => {
    describe('round', () => {
        it('deve arredondar para 2 casas decimais', () => {
            expect(FinancialPrecision.round(10.125)).toBe(10.13);
            expect(FinancialPrecision.round(10.124)).toBe(10.12);
            expect(FinancialPrecision.round(10.1)).toBe(10.1);
        });

        it('deve lidar com números negativos', () => {
            // ROUND_HALF_UP: -10.125 arredonda para -10.13 (away from zero)
            expect(FinancialPrecision.round(-10.125)).toBe(-10.13);
            expect(FinancialPrecision.round(-10.124)).toBe(-10.12);
        });

        it('deve lidar com zero', () => {
            expect(FinancialPrecision.round(0)).toBe(0);
            expect(FinancialPrecision.round(0.001)).toBe(0);
        });
    });

    describe('sum', () => {
        it('deve somar valores corretamente', () => {
            expect(FinancialPrecision.sum([10.1, 20.2, 30.3])).toBe(60.6);
        });

        it('deve evitar erros de ponto flutuante', () => {
            // 0.1 + 0.2 em JavaScript puro = 0.30000000000000004
            expect(FinancialPrecision.sum([0.1, 0.2])).toBe(0.3);
        });

        it('deve retornar 0 para array vazio', () => {
            expect(FinancialPrecision.sum([])).toBe(0);
        });

        it('deve lidar com valores negativos', () => {
            expect(FinancialPrecision.sum([100, -30, -20])).toBe(50);
        });
    });

    describe('subtract', () => {
        it('deve subtrair valores corretamente', () => {
            expect(FinancialPrecision.subtract(100, 30)).toBe(70);
        });

        it('deve evitar erros de ponto flutuante', () => {
            expect(FinancialPrecision.subtract(0.3, 0.1)).toBe(0.2);
        });

        it('deve lidar com resultados negativos', () => {
            expect(FinancialPrecision.subtract(30, 100)).toBe(-70);
        });
    });

    describe('multiply', () => {
        it('deve multiplicar valores corretamente', () => {
            expect(FinancialPrecision.multiply(10, 3)).toBe(30);
        });

        it('deve evitar erros de ponto flutuante', () => {
            expect(FinancialPrecision.multiply(0.1, 0.2)).toBe(0.02);
        });

        it('deve lidar com zero', () => {
            expect(FinancialPrecision.multiply(100, 0)).toBe(0);
        });
    });

    describe('divide', () => {
        it('deve dividir valores corretamente', () => {
            expect(FinancialPrecision.divide(100, 3)).toBe(33.33);
        });

        it('deve lançar erro para divisão por zero', () => {
            expect(() => FinancialPrecision.divide(100, 0)).toThrow('Divisão por zero');
        });

        it('deve arredondar resultado para 2 casas', () => {
            expect(FinancialPrecision.divide(10, 3)).toBe(3.33);
        });
    });

    describe('equals', () => {
        it('deve comparar valores iguais', () => {
            expect(FinancialPrecision.equals(10.00, 10)).toBe(true);
        });

        it('deve considerar tolerância padrão de 0.01', () => {
            expect(FinancialPrecision.equals(10.00, 10.005)).toBe(true);
            expect(FinancialPrecision.equals(10.00, 10.02)).toBe(false);
        });

        it('deve permitir tolerância customizada', () => {
            expect(FinancialPrecision.equals(10.00, 10.05, 0.1)).toBe(true);
        });
    });

    describe('validateSplits', () => {
        it('deve validar splits que somam o total', () => {
            const splits = [
                { assignedAmount: 50 },
                { assignedAmount: 30 },
                { assignedAmount: 20 }
            ];
            const result = FinancialPrecision.validateSplits(splits, 100);
            expect(result.valid).toBe(true);
            expect(result.difference).toBe(0);
        });

        it('deve detectar splits que não somam o total', () => {
            const splits = [
                { assignedAmount: 50 },
                { assignedAmount: 30 }
            ];
            const result = FinancialPrecision.validateSplits(splits, 100);
            expect(result.valid).toBe(false);
            expect(result.difference).toBe(20);
        });

        it('deve tolerar diferença de 1 centavo', () => {
            const splits = [
                { assignedAmount: 33.33 },
                { assignedAmount: 33.33 },
                { assignedAmount: 33.33 }
            ];
            const result = FinancialPrecision.validateSplits(splits, 100);
            expect(result.valid).toBe(true);
        });

        it('deve fornecer splits normalizados quando inválido', () => {
            const splits = [
                { assignedAmount: 50 },
                { assignedAmount: 30 }
            ];
            const result = FinancialPrecision.validateSplits(splits, 100);
            expect(result.normalized).toBeDefined();
            
            if (result.normalized) {
                const normalizedSum = FinancialPrecision.sum(result.normalized.map(s => s.assignedAmount));
                expect(normalizedSum).toBe(100);
            }
        });
    });

    describe('normalizeSplits', () => {
        it('deve normalizar splits para somar o total', () => {
            const splits = [
                { assignedAmount: 50 },
                { assignedAmount: 50 }
            ];
            const normalized = FinancialPrecision.normalizeSplits(splits, 120);
            const sum = FinancialPrecision.sum(normalized.map(s => s.assignedAmount));
            expect(sum).toBe(120);
        });

        it('deve dividir igualmente quando soma é zero', () => {
            const splits = [
                { assignedAmount: 0 },
                { assignedAmount: 0 }
            ];
            const normalized = FinancialPrecision.normalizeSplits(splits, 100);
            expect(normalized[0].assignedAmount).toBe(50);
            expect(normalized[1].assignedAmount).toBe(50);
        });

        it('deve retornar array vazio para splits vazios', () => {
            const normalized = FinancialPrecision.normalizeSplits([], 100);
            expect(normalized).toEqual([]);
        });
    });

    describe('calculatePMT', () => {
        it('deve calcular parcela de financiamento', () => {
            // R$ 10.000 em 12x com taxa de 1% ao mês
            const pmt = FinancialPrecision.calculatePMT(10000, 0.01, 12);
            expect(pmt).toBeCloseTo(888.49, 1);
        });

        it('deve calcular parcela sem juros', () => {
            const pmt = FinancialPrecision.calculatePMT(1200, 0, 12);
            expect(pmt).toBe(100);
        });
    });

    describe('compoundInterest', () => {
        it('deve calcular juros compostos', () => {
            // R$ 1.000 com 10% ao ano por 2 anos
            const result = FinancialPrecision.compoundInterest(1000, 0.1, 2);
            expect(result).toBe(1210);
        });

        it('deve retornar principal quando taxa é zero', () => {
            const result = FinancialPrecision.compoundInterest(1000, 0, 5);
            expect(result).toBe(1000);
        });
    });
});

describe('Cenários de Uso Real', () => {
    it('deve calcular divisão de conta de restaurante', () => {
        const total = 157.50;
        const pessoas = 3;
        const porPessoa = FinancialPrecision.divide(total, pessoas);
        
        // Verificar que a soma das partes é igual ao total
        const soma = FinancialPrecision.sum([porPessoa, porPessoa, porPessoa]);
        
        // Pode haver diferença de centavos devido ao arredondamento
        expect(FinancialPrecision.equals(soma, total, 0.03)).toBe(true);
    });

    it('deve calcular parcelamento de compra', () => {
        const valorTotal = 1000;
        const parcelas = 3;
        const valorParcela = FinancialPrecision.divide(valorTotal, parcelas);
        
        // Última parcela ajustada
        const primeiras = FinancialPrecision.multiply(valorParcela, parcelas - 1);
        const ultima = FinancialPrecision.subtract(valorTotal, primeiras);
        
        const soma = FinancialPrecision.sum([primeiras, ultima]);
        expect(soma).toBe(valorTotal);
    });

    it('deve calcular split de despesa compartilhada', () => {
        const despesa = 250.00;
        const splits = [
            { assignedAmount: 125.00 }, // 50%
            { assignedAmount: 75.00 },  // 30%
            { assignedAmount: 50.00 }   // 20%
        ];
        
        const result = FinancialPrecision.validateSplits(splits, despesa);
        expect(result.valid).toBe(true);
    });
});
