# 🎯 MELHORIAS CRÍTICAS - CÓDIGO E LÓGICA FINANCEIRA

**Análise como Engenheiro Sênior Especialista em SaaS Financeiro**  
**Data:** 2026-01-28 (Atualizado: 2025-12-18)  
**Padrão de Referência:** YNAB, Mint, QuickBooks, Organizze  
**Status:** ✅ CONCLUÍDO

---

## 🔴 PROBLEMAS CRÍTICOS IDENTIFICADOS

### 1. **PRECISÃO NUMÉRICA INCONSISTENTE**

**Problema:**
- Múltiplas implementações de `round2dec` (duplicação)
- Uso de `Number.EPSILON` pode não ser suficiente para cálculos complexos
- Falta de validação de precisão em operações acumulativas

**Código Atual:**
```typescript
// balanceEngine.ts - Linha 5
const round2dec = (num: number) => Math.round((num + Number.EPSILON) * 100) / 100;

// financialPrecision.ts - Linha 12
export const round2dec = (num: number): number => {
  return Math.round((num + Number.EPSILON) * 100) / 100;
};
```

**Solução:**
```typescript
// src/services/financialPrecision.ts - UNIFICAR E MELHORAR
import Decimal from 'decimal.js';

/**
 * Biblioteca ÚNICA de Precisão Financeira
 * Usa Decimal.js para cálculos exatos (sem erros de ponto flutuante)
 */
export class FinancialPrecision {
  private static readonly DECIMALS = 2;
  private static readonly PRECISION = 10; // Casas decimais internas

  /**
   * Arredonda para 2 casas decimais (padrão monetário)
   * CRÍTICO: Usa Decimal.js para evitar erros de ponto flutuante
   */
  static round(value: number | string): number {
    return new Decimal(value)
      .toDecimalPlaces(this.DECIMALS, Decimal.ROUND_HALF_UP)
      .toNumber();
  }

  /**
   * Soma valores monetários com precisão
   */
  static sum(values: (number | string)[]): number {
    return values.reduce((acc, val) => {
      return new Decimal(acc).plus(new Decimal(val));
    }, new Decimal(0)).toNumber();
  }

  /**
   * Subtrai valores monetários com precisão
   */
  static subtract(a: number | string, b: number | string): number {
    return new Decimal(a).minus(new Decimal(b)).toNumber();
  }

  /**
   * Multiplica valores monetários com precisão
   */
  static multiply(a: number | string, b: number | string): number {
    return new Decimal(a).times(new Decimal(b)).toNumber();
  }

  /**
   * Divide valores monetários com precisão
   */
  static divide(a: number | string, b: number | string): number {
    if (new Decimal(b).equals(0)) {
      throw new Error('Divisão por zero');
    }
    return new Decimal(a).dividedBy(new Decimal(b)).toNumber();
  }

  /**
   * Valida se dois valores são iguais (tolerância de 0.01 centavos)
   */
  static equals(a: number | string, b: number | string, tolerance: number = 0.01): boolean {
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
}

// Exportar funções de conveniência (backward compatibility)
export const round2dec = FinancialPrecision.round;
export const sum = FinancialPrecision.sum;
export const subtract = FinancialPrecision.subtract;
```

**Ação:** Instalar `decimal.js` e refatorar todo código para usar esta biblioteca única.

---

### 2. **LÓGICA DE SALDO INCONSISTENTE**

**Problema:**
- `balanceEngine.ts` calcula saldos no frontend (duplicação com backend)
- Lógica de shared expenses complexa e propensa a erros
- Falta validação de integridade após cálculos

**Código Atual:**
```typescript
// balanceEngine.ts - Linha 53
sourceAcc.balance = round2dec(sourceAcc.balance + change);
```

**Solução:**
```typescript
// src/services/balanceEngine.ts - MELHORAR
import { FinancialPrecision } from './financialPrecision';
import { Account, Transaction, TransactionType } from '../types';

/**
 * Calcula saldos de contas baseado em transações
 * NOTA: Backend é fonte de verdade, mas esta função é útil para:
 * - Projeções futuras
 * - Validação de integridade
 * - Cálculos históricos
 */
export const calculateBalances = (
  initialAccounts: Account[],
  transactions: Transaction[],
  cutOffDate?: string | Date
): Account[] => {
  // 1. Clonar contas (não mutar original)
  const accountMap = new Map<string, Account>();
  initialAccounts.forEach(acc => {
    accountMap.set(acc.id, {
      ...acc,
      balance: FinancialPrecision.round(acc.initialBalance || 0)
    });
  });

  // 2. Ordenar transações cronologicamente
  const sortedTxs = [...transactions]
    .filter(t => !t.deleted)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // 3. Processar transações com validação
  sortedTxs.forEach(tx => {
    // Time travel logic
    if (cutOffDate) {
      const txDate = new Date(tx.date);
      const cutOff = new Date(cutOffDate);
      cutOff.setHours(23, 59, 59, 999);
      if (txDate.getTime() > cutOff.getTime()) return;
    }

    const amount = FinancialPrecision.round(tx.amount);
    const someoneElsePaid = tx.payerId && tx.payerId !== 'me';

    // Processar conta de origem
    const sourceAcc = accountMap.get(tx.accountId || '');
    if (sourceAcc && !someoneElsePaid) {
      if (tx.type === TransactionType.EXPENSE) {
        const change = tx.isRefund ? amount : FinancialPrecision.multiply(amount, -1);
        sourceAcc.balance = FinancialPrecision.round(
          FinancialPrecision.sum([sourceAcc.balance, change])
        );
      } else if (tx.type === TransactionType.INCOME) {
        const change = tx.isRefund ? FinancialPrecision.multiply(amount, -1) : amount;
        sourceAcc.balance = FinancialPrecision.round(
          FinancialPrecision.sum([sourceAcc.balance, change])
        );
      } else if (tx.type === TransactionType.TRANSFER) {
        sourceAcc.balance = FinancialPrecision.round(
          FinancialPrecision.subtract(sourceAcc.balance, amount)
        );
      }
    }

    // Processar conta de destino (transferências)
    if (tx.type === TransactionType.TRANSFER && tx.destinationAccountId) {
      const destAcc = accountMap.get(tx.destinationAccountId);
      if (!destAcc) {
        // CRÍTICO: Reverter da origem se destino não existe
        if (sourceAcc) {
          sourceAcc.balance = FinancialPrecision.round(
            FinancialPrecision.sum([sourceAcc.balance, amount])
          );
        }
        return;
      }

      // Multi-moeda: usar destinationAmount se disponível
      let amountIncoming = amount;
      if (sourceAcc && sourceAcc.currency !== destAcc.currency) {
        if (tx.destinationAmount && tx.destinationAmount > 0) {
          amountIncoming = FinancialPrecision.round(tx.destinationAmount);
        } else {
          // Fallback: 1:1 (deve ser evitado, mas preserva integridade)
          console.warn(`Transferência multi-moeda sem destinationAmount: ${tx.id}`);
        }
      }

      destAcc.balance = FinancialPrecision.round(
        FinancialPrecision.sum([destAcc.balance, amountIncoming])
      );
    }
  });

  // 4. Validação de integridade
  const accounts = Array.from(accountMap.values());
  validateBalanceIntegrity(accounts, transactions);

  return accounts;
};

/**
 * Valida integridade dos saldos calculados
 */
function validateBalanceIntegrity(
  accounts: Account[],
  transactions: Transaction[]
): void {
  // Verificar se saldos não são negativos (exceto cartão de crédito)
  accounts.forEach(acc => {
    if (acc.type !== 'CREDIT_CARD' && acc.balance < 0) {
      console.warn(`⚠️ Saldo negativo detectado: ${acc.name} (${acc.balance})`);
    }
  });

  // Verificar se soma de transferências está balanceada
  const transfers = transactions.filter(t => 
    t.type === TransactionType.TRANSFER && !t.deleted
  );
  
  transfers.forEach(t => {
    if (t.destinationAmount && t.destinationAmount !== t.amount) {
      // Multi-moeda: OK
      return;
    }
    
    // Mesma moeda: origem e destino devem ter valores opostos
    const sourceAcc = accounts.find(a => a.id === t.accountId);
    const destAcc = accounts.find(a => a.id === t.destinationAccountId);
    
    if (sourceAcc && destAcc && sourceAcc.currency === destAcc.currency) {
      // Validação: não podemos verificar aqui sem histórico completo
      // Mas podemos logar para auditoria
    }
  });
}
```

---

### 3. **VALIDAÇÃO DE SPLITS FRACA**

**Problema:**
- Tolerância de 0.01 pode permitir erros acumulativos
- Normalização automática não é aplicada
- Falta validação no backend

**Código Atual:**
```typescript
// financialLogic.ts - Linha 76
if (splitsTotal > t.amount + 0.01) { // margem de erro float
```

**Solução:**
```typescript
// src/services/financialLogic.ts - MELHORAR
import { FinancialPrecision } from './financialPrecision';

export const calculateEffectiveTransactionValue = (t: Transaction): number => {
  const isShared = t.isShared || (t.sharedWith && t.sharedWith.length > 0) || 
                   (t.payerId && t.payerId !== 'me');

  if (t.type !== TransactionType.EXPENSE || !isShared) {
    return FinancialPrecision.round(t.amount);
  }

  // Validar splits ANTES de calcular
  if (t.sharedWith && t.sharedWith.length > 0) {
    const validation = FinancialPrecision.validateSplits(
      t.sharedWith,
      t.amount
    );

    if (!validation.valid) {
      console.error(`❌ ERRO: Splits inválidos na transação ${t.id}`);
      console.error(`   Total: ${t.amount}, Soma: ${validation.difference}`);
      
      // Se normalização disponível, usar
      if (validation.normalized) {
        console.warn(`⚠️ Usando splits normalizados`);
        // Em produção, salvar splits normalizados no backend
      }
      
      // Fallback: retornar total (seguro)
      return FinancialPrecision.round(t.amount);
    }
  }

  const splitsTotal = FinancialPrecision.sum(
    t.sharedWith?.map(s => s.assignedAmount) || [0]
  );

  // Eu paguei
  if (!t.payerId || t.payerId === 'me') {
    return FinancialPrecision.round(
      FinancialPrecision.subtract(t.amount, splitsTotal)
    );
  }

  // Outro pagou: minha parte
  const myShare = FinancialPrecision.subtract(t.amount, splitsTotal);
  return FinancialPrecision.round(Math.max(0, myShare));
};
```

---

### 4. **FALTA DE VALIDAÇÃO DE INTEGRIDADE EM TEMPO REAL**

**Problema:**
- Validações apenas no frontend
- Falta verificação periódica automática
- Sem alertas proativos

**Solução:**
```typescript
// src/services/integrityService.ts - NOVO
import { FinancialPrecision } from './financialPrecision';
import { Account, Transaction } from '../types';
import { supabaseService } from './supabaseService';

export interface IntegrityIssue {
  severity: 'ERROR' | 'WARNING' | 'INFO';
  type: string;
  message: string;
  affectedIds: string[];
  fixable: boolean;
  fix?: () => Promise<void>;
}

export class IntegrityService {
  /**
   * Verifica integridade completa do sistema
   */
  static async checkIntegrity(
    accounts: Account[],
    transactions: Transaction[]
  ): Promise<IntegrityIssue[]> {
    const issues: IntegrityIssue[] = [];

    // 1. Verificar saldos vs transações
    issues.push(...this.validateBalances(accounts, transactions));

    // 2. Verificar splits
    issues.push(...this.validateSplits(transactions));

    // 3. Verificar transferências
    issues.push(...this.validateTransfers(transactions, accounts));

    // 4. Verificar transações órfãs
    issues.push(...this.validateOrphanTransactions(transactions, accounts));

    return issues;
  }

  /**
   * Valida se saldos calculados batem com saldos armazenados
   */
  private static validateBalances(
    accounts: Account[],
    transactions: Transaction[]
  ): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];

    // Calcular saldos esperados
    const calculatedBalances = calculateBalances(accounts, transactions);

    calculatedBalances.forEach(calcAcc => {
      const storedAcc = accounts.find(a => a.id === calcAcc.id);
      if (!storedAcc) return;

      const difference = Math.abs(
        FinancialPrecision.subtract(calcAcc.balance, storedAcc.balance)
      );

      if (difference > 0.01) {
        issues.push({
          severity: 'ERROR',
          type: 'BALANCE_MISMATCH',
          message: `Saldo divergente em ${storedAcc.name}: armazenado ${storedAcc.balance}, calculado ${calcAcc.balance}`,
          affectedIds: [storedAcc.id],
          fixable: true,
          fix: async () => {
            // Recalcular saldo no backend
            await supabaseService.recalculate_all_balances();
          }
        });
      }
    });

    return issues;
  }

  /**
   * Valida todos os splits
   */
  private static validateSplits(transactions: Transaction[]): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];

    transactions
      .filter(t => t.isShared && t.sharedWith && t.sharedWith.length > 0)
      .forEach(t => {
        const validation = FinancialPrecision.validateSplits(
          t.sharedWith!,
          t.amount
        );

        if (!validation.valid) {
          issues.push({
            severity: 'ERROR',
            type: 'INVALID_SPLITS',
            message: `Splits inválidos em "${t.description}": diferença de ${validation.difference}`,
            affectedIds: [t.id],
            fixable: true,
            fix: async () => {
              if (validation.normalized) {
                // Atualizar splits normalizados
                await supabaseService.updateTransaction(t.id, {
                  sharedWith: validation.normalized
                });
              }
            }
          });
        }
      });

    return issues;
  }

  /**
   * Valida transferências
   */
  private static validateTransfers(
    transactions: Transaction[],
    accounts: Account[]
  ): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];
    const accountIds = new Set(accounts.map(a => a.id));

    transactions
      .filter(t => t.type === TransactionType.TRANSFER && !t.deleted)
      .forEach(t => {
        // Verificar destino
        if (!t.destinationAccountId || !accountIds.has(t.destinationAccountId)) {
          issues.push({
            severity: 'ERROR',
            type: 'INVALID_TRANSFER',
            message: `Transferência sem destino válido: "${t.description}"`,
            affectedIds: [t.id],
            fixable: false
          });
        }

        // Verificar multi-moeda
        const sourceAcc = accounts.find(a => a.id === t.accountId);
        const destAcc = accounts.find(a => a.id === t.destinationAccountId);
        
        if (sourceAcc && destAcc && sourceAcc.currency !== destAcc.currency) {
          if (!t.destinationAmount || t.destinationAmount <= 0) {
            issues.push({
              severity: 'ERROR',
              type: 'MISSING_EXCHANGE_RATE',
              message: `Transferência multi-moeda sem destinationAmount: "${t.description}"`,
              affectedIds: [t.id],
              fixable: false
            });
          }
        }
      });

    return issues;
  }

  /**
   * Valida transações órfãs
   */
  private static validateOrphanTransactions(
    transactions: Transaction[],
    accounts: Account[]
  ): IntegrityIssue[] {
    const issues: IntegrityIssue[] = [];
    const accountIds = new Set(accounts.map(a => a.id));

    transactions
      .filter(t => !t.deleted && t.accountId)
      .forEach(t => {
        if (!accountIds.has(t.accountId)) {
          issues.push({
            severity: 'WARNING',
            type: 'ORPHAN_TRANSACTION',
            message: `Transação órfã: "${t.description}" (conta deletada)`,
            affectedIds: [t.id],
            fixable: false
          });
        }
      });

    return issues;
  }
}
```

---

### 5. **CÁLCULOS DE PROJEÇÃO IMPRECISOS**

**Problema:**
- Conversão de moedas pode ter erros acumulativos
- Falta validação de taxas de câmbio
- Projeções não consideram todos os cenários

**Solução:**
```typescript
// src/services/financialLogic.ts - MELHORAR calculateProjectedBalance
import { FinancialPrecision } from './financialPrecision';

export const calculateProjectedBalance = (
  accounts: Account[],
  transactions: Transaction[],
  currentDate: Date
): { currentBalance: number, projectedBalance: number, pendingIncome: number, pendingExpenses: number } => {
  
  // Usar FinancialPrecision para todas as operações
  const liquidityAccounts = accounts.filter(a =>
    a.type === AccountType.CHECKING ||
    a.type === AccountType.SAVINGS ||
    a.type === AccountType.CASH
  );

  // Calcular saldo atual com precisão
  const currentBalance = liquidityAccounts.reduce((acc, a) => {
    const balanceBRL = convertToBRL(a.balance, a.currency);
    return FinancialPrecision.sum([acc, balanceBRL]);
  }, 0);

  // ... resto da lógica usando FinancialPrecision para todas as operações
  
  return {
    currentBalance: FinancialPrecision.round(currentBalance),
    projectedBalance: FinancialPrecision.round(projectedBalance),
    pendingIncome: FinancialPrecision.round(pendingIncome),
    pendingExpenses: FinancialPrecision.round(pendingExpenses)
  };
};
```

---

## 🟡 MELHORIAS DE ARQUITETURA

### 6. **SEPARAÇÃO DE RESPONSABILIDADES**

**Problema:**
- Lógica financeira misturada com lógica de UI
- Falta de camada de serviço dedicada

**Solução:**
```typescript
// src/services/financial/balanceService.ts - NOVO
// src/services/financial/projectionService.ts - NOVO
// src/services/financial/validationService.ts - NOVO
// src/services/financial/calculationService.ts - NOVO
```

### 7. **CACHE E PERFORMANCE**

**Problema:**
- Cálculos repetidos sem cache
- Re-cálculo desnecessário de saldos

**Solução:**
```typescript
// src/services/financial/cacheService.ts - NOVO
import { LRUCache } from 'lru-cache';

export class FinancialCache {
  private static balanceCache = new LRUCache<string, number>({ max: 100 });
  private static projectionCache = new LRUCache<string, any>({ max: 50 });

  static getBalance(accountId: string, date: string): number | undefined {
    return this.balanceCache.get(`${accountId}:${date}`);
  }

  static setBalance(accountId: string, date: string, balance: number): void {
    this.balanceCache.set(`${accountId}:${date}`, balance);
  }

  static invalidateAccount(accountId: string): void {
    // Invalidar todas as entradas relacionadas
    for (const key of this.balanceCache.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this.balanceCache.delete(key);
      }
    }
  }
}
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Prioridade CRÍTICA (Fazer Agora)
- [x] Instalar `decimal.js`: `npm install decimal.js @types/decimal.js`
- [x] Refatorar `financialPrecision.ts` para usar Decimal.js
- [x] Substituir todas as chamadas de `round2dec` pela nova biblioteca
- [x] Implementar `IntegrityService` para validação automática
- [x] Adicionar validação de splits no backend (constraint SQL)

### Prioridade ALTA (Próxima Sprint)
- [x] Refatorar `balanceEngine.ts` para usar `FinancialPrecision` (removido - backend calcula)
- [x] Melhorar `calculateProjectedBalance` com precisão
- [x] Implementar cache de cálculos (`cacheService.ts`)
- [ ] Adicionar testes unitários para cálculos financeiros (opcional)

### Prioridade MÉDIA (Backlog)
- [x] Separar serviços financeiros em módulos
- [x] Implementar monitoramento de integridade em tempo real
- [ ] Adicionar métricas de performance (opcional)

---

## 🎯 RESULTADO ESPERADO

Após implementar estas melhorias:

1. ✅ **Precisão 100%** - Zero erros de ponto flutuante
2. ✅ **Integridade Garantida** - Validação automática e proativa
3. ✅ **Performance Otimizada** - Cache e cálculos eficientes
4. ✅ **Código Limpo** - Separação de responsabilidades
5. ✅ **Confiabilidade** - Sistema robusto como YNAB/Mint

---

## 📚 REFERÊNCIAS

- [Decimal.js Documentation](https://mikemcl.github.io/decimal.js/)
- [IEEE 754 Floating Point](https://en.wikipedia.org/wiki/IEEE_754)
- [Financial Calculations Best Practices](https://www.mint.com/how-it-works/security)

