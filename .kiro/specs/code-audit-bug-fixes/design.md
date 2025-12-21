# Design Document - Code Audit and Bug Fixes

## Overview

Este documento detalha o design das correções para bugs críticos identificados durante auditoria completa do código. As correções focam em três áreas principais:

1. **Lógica de Transações Compartilhadas**: Correção da distinção entre dívidas pagas e não pagas
2. **Validação e Sanitização**: Fortalecimento da camada de validação de dados
3. **Cálculos Financeiros**: Correção de bugs em projeções, fluxo de caixa e totais mensais

## Architecture

### Camadas do Sistema

```
┌─────────────────────────────────────────┐
│         UI Components (Dashboard)        │
├─────────────────────────────────────────┤
│    Hooks (useSafeFinancialDashboard)    │
├─────────────────────────────────────────┤
│  Engines (dashboardEngine, balanceEngine)│
├─────────────────────────────────────────┤
│   Validation Layer (NEW/ENHANCED)        │
├─────────────────────────────────────────┤
│  Safe Calculators (SafeFinancialCalc)   │
├─────────────────────────────────────────┤
│    Data Store (useTransactionStore)      │
└─────────────────────────────────────────┘
```

### Fluxo de Dados Corrigido

```
Transaction Input
    ↓
[Validation Layer] ← Valida estrutura, tipos, ranges
    ↓
[Sanitization] ← Corrige valores inválidos
    ↓
[Business Logic] ← Aplica regras de negócio
    ↓
[Safe Calculations] ← Cálculos protegidos contra NaN
    ↓
[Error Detection] ← Detecta e loga problemas
    ↓
Result (sempre válido)
```

## Components and Interfaces

### 1. Enhanced Transaction Validation

**Problema Identificado**: Transações com valores inválidos, datas impossíveis, e splits maiores que o total.

**Solução**:

```typescript
interface EnhancedTransactionValidation {
  // Validação de valores
  validateAmount(amount: any): ValidationResult;
  validateDate(date: string): ValidationResult;
  validateSplits(splits: Split[], total: number): ValidationResult;
  
  // Validação de transferências
  validateTransfer(tx: Transaction, accounts: Account[]): ValidationResult;
  validateMultiCurrencyTransfer(tx: Transaction): ValidationResult;
  
  // Validação de parcelas
  validateInstallments(tx: Transaction): ValidationResult;
}
```

**Regras de Validação**:
- Valores devem ser números positivos (exceto refunds)
- Datas devem existir no calendário (ex: 30/02 é inválido)
- Splits não podem exceder o total da transação
- Transferências devem ter origem ≠ destino
- Multi-moeda deve ter destinationAmount

### 2. Shared Transaction Logic Fix

**Problema Identificado**: Dívidas não pagas sendo incluídas em despesas do dashboard.

**Solução**:

```typescript
interface SharedTransactionFilter {
  // Filtro para dashboard
  shouldIncludeInCashFlow(tx: Transaction): boolean;
  shouldIncludeInExpenses(tx: Transaction): boolean;
  
  // Cálculo de valor efetivo
  calculateEffectiveValue(tx: Transaction): number;
  
  // Classificação
  isReceivable(tx: Transaction): boolean;
  isPayable(tx: Transaction): boolean;
}
```

**Lógica Corrigida**:

```
SE transação é compartilhada E outro pagou E não está quitada:
  - NÃO incluir em despesas do dashboard
  - NÃO incluir em fluxo de caixa
  - Incluir em "A Pagar" (liabilities)
  
SE transação é compartilhada E eu paguei:
  - Incluir apenas minha parte em despesas
  - Incluir splits não quitados em "A Receber" (assets)
  
SE transação é compartilhada E está quitada:
  - Processar normalmente como transação regular
```

### 3. Projected Balance Calculation Fix

**Problema Identificado**: Projeção incluindo transações passadas e dívidas não pagas incorretamente.

**Solução**:

```typescript
interface ProjectedBalanceCalculation {
  // Saldo atual (apenas contas líquidas)
  calculateCurrentBalance(accounts: Account[]): number;
  
  // Receitas pendentes (futuras + recebíveis)
  calculatePendingIncome(
    transactions: Transaction[],
    currentDate: Date
  ): number;
  
  // Despesas pendentes (futuras + a pagar)
  calculatePendingExpenses(
    transactions: Transaction[],
    currentDate: Date
  ): number;
  
  // Projeção final
  calculateProjectedBalance(
    current: number,
    income: number,
    expenses: number
  ): number;
}
```

**Lógica Corrigida**:

```
Saldo Atual = Soma(contas líquidas em BRL)

Receitas Pendentes = 
  + Receitas futuras do mês
  + Splits não quitados (eu paguei, outros devem)

Despesas Pendentes =
  + Despesas futuras do mês
  + Dívidas não quitadas (outros pagaram, eu devo)

Saldo Projetado = Saldo Atual + Receitas Pendentes - Despesas Pendentes
```

### 4. Monthly Totals Calculation Fix

**Problema Identificado**: Totais mensais incluindo dívidas não pagas como despesas.

**Solução**:

```typescript
interface MonthlyTotalsCalculation {
  // Filtrar transações do mês
  filterMonthlyTransactions(
    transactions: Transaction[],
    date: Date
  ): Transaction[];
  
  // Calcular receitas (excluindo refunds negativos)
  calculateMonthlyIncome(transactions: Transaction[]): number;
  
  // Calcular despesas (excluindo dívidas não pagas)
  calculateMonthlyExpenses(transactions: Transaction[]): number;
  
  // Fluxo líquido
  calculateNetFlow(income: number, expenses: number): number;
}
```

**Lógica Corrigida**:

```
Para cada transação do mês:
  SE é RECEITA:
    Adicionar a receitas (ou subtrair se refund)
  
  SE é DESPESA:
    SE outro pagou E não está quitada:
      PULAR (não é minha despesa ainda)
    SENÃO SE é compartilhada E eu paguei:
      Adicionar apenas minha parte
    SENÃO:
      Adicionar valor total
```

### 5. Cash Flow Data Calculation Fix

**Problema Identificado**: Fluxo de caixa incluindo dívidas não pagas e calculando saldo inicial incorretamente.

**Solução**:

```typescript
interface CashFlowCalculation {
  // Calcular saldo inicial do ano
  calculateYearStartBalance(
    accounts: Account[],
    transactions: Transaction[],
    year: number
  ): number;
  
  // Agregar dados mensais
  aggregateMonthlyData(
    transactions: Transaction[],
    year: number
  ): MonthlyData[];
  
  // Calcular curva acumulada
  calculateAccumulatedCurve(
    monthlyData: MonthlyData[],
    startBalance: number
  ): MonthlyData[];
}
```

**Lógica Corrigida**:

```
1. Começar com saldo atual das contas líquidas
2. Trabalhar para trás até 1º de janeiro:
   - Subtrair receitas que ocorreram
   - Adicionar despesas que ocorreram
   - EXCLUIR dívidas não pagas
3. Resultado = Saldo em 1º de janeiro
4. Para cada mês do ano:
   - Somar receitas do mês
   - Somar despesas do mês (excluindo dívidas não pagas)
   - Acumular: saldo anterior + receitas - despesas
```

### 6. Spending Chart Data Fix

**Problema Identificado**: Gráfico de gastos incluindo dívidas não pagas.

**Solução**:

```typescript
interface SpendingChartCalculation {
  // Filtrar transações para o gráfico
  filterChartTransactions(transactions: Transaction[]): Transaction[];
  
  // Agrupar por categoria
  groupByCategory(transactions: Transaction[]): CategoryData[];
  
  // Agrupar por fonte
  groupBySource(
    transactions: Transaction[],
    accounts: Account[]
  ): SourceData[];
}
```

**Lógica Corrigida**:

```
Para cada transação:
  SE é DESPESA:
    SE outro pagou E não está quitada:
      PULAR (não incluir no gráfico)
    SENÃO:
      Calcular valor efetivo
      Adicionar ao grupo (categoria ou fonte)
```

### 7. Installment Generation Fix

**Problema Identificado**: Parcelas com valores que não somam exatamente o total devido a arredondamento.

**Solução**:

```typescript
interface InstallmentGeneration {
  // Gerar parcelas com precisão
  generateInstallments(
    transaction: Transaction,
    count: number
  ): Transaction[];
  
  // Calcular valor base da parcela
  calculateBaseInstallmentValue(total: number, count: number): number;
  
  // Ajustar última parcela
  adjustLastInstallment(
    installments: Transaction[],
    originalTotal: number
  ): Transaction[];
}
```

**Lógica Corrigida**:

```
1. Calcular valor base: total / número de parcelas
2. Para parcelas 1 a N-1:
   - Usar valor base
   - Acumular total usado
3. Para última parcela:
   - Valor = total original - total acumulado
   - Garante soma exata
4. Para splits compartilhados:
   - Aplicar mesma lógica proporcionalmente
   - Ajustar última parcela de cada split
```

### 8. Date Validation Fix

**Problema Identificado**: Datas inválidas (ex: 30/02) sendo aceitas.

**Solução**:

```typescript
interface DateValidation {
  // Validar se data existe
  isValidDate(dateString: string): boolean;
  
  // Validar se dia existe no mês
  isDayValidForMonth(year: number, month: number, day: number): boolean;
  
  // Reconstruir data para validação
  reconstructDate(dateString: string): Date | null;
}
```

**Lógica Corrigida**:

```
1. Parse da string de data (YYYY-MM-DD)
2. Criar objeto Date com os componentes
3. Verificar se Date resultante tem os mesmos valores:
   - Se ano, mês ou dia mudaram = data inválida
   - Exemplo: new Date(2024, 1, 30) vira 2024-03-01
4. Rejeitar se inválida
```

### 9. Error Detection and Logging Enhancement

**Problema Identificado**: Erros silenciosos sem contexto suficiente para debugging.

**Solução**:

```typescript
interface EnhancedErrorLogging {
  // Detectar e logar NaN
  detectNaN(
    result: any,
    source: string,
    operation: string,
    inputs: any[]
  ): boolean;
  
  // Logar erro estruturado
  logError(
    type: ErrorType,
    source: string,
    operation: string,
    inputs: any[],
    message: string,
    severity: Severity
  ): void;
  
  // Gerar relatório de saúde
  getHealthReport(periodHours: number): HealthReport;
}
```

**Informações Logadas**:
- Timestamp preciso
- Tipo de erro (NaN, INVALID_INPUT, CALCULATION_ERROR, DATA_CORRUPTION)
- Fonte (função/componente)
- Operação (nome da operação)
- Inputs (valores que causaram o erro)
- Stack trace
- Severidade (LOW, MEDIUM, HIGH, CRITICAL)
- Metadata adicional

### 10. Safe Mathematical Operations

**Problema Identificado**: Operações matemáticas retornando NaN sem proteção.

**Solução**:

```typescript
interface SafeMathOperations {
  // Conversão segura para número
  toSafeNumber(value: any, fallback: number): number;
  
  // Soma segura
  safeSum(values: any[]): number;
  
  // Divisão segura (protege contra divisão por zero)
  safeDivide(numerator: number, denominator: number): number;
  
  // Percentual seguro
  safePercentage(part: number, total: number): number;
  
  // Média segura
  safeAverage(values: any[]): number;
}
```

**Proteções Implementadas**:
- Conversão de null/undefined para 0
- Conversão de strings para números
- Detecção de NaN e Infinity
- Fallback para valores seguros
- Logging de conversões realizadas

## Data Models

### Enhanced Transaction Model

```typescript
interface Transaction {
  // Campos existentes...
  
  // Validação
  _validated?: boolean;
  _sanitized?: boolean;
  _validationErrors?: ValidationError[];
  
  // Metadados de cálculo
  _effectiveValue?: number; // Valor efetivo calculado
  _isReceivable?: boolean; // É um recebível?
  _isPayable?: boolean; // É um pagável?
}
```

### Enhanced Account Model

```typescript
interface Account {
  // Campos existentes...
  
  // Validação
  _validated?: boolean;
  _sanitized?: boolean;
  _validationErrors?: ValidationError[];
  
  // Metadados
  _safeBalance?: number; // Saldo sanitizado
}
```

### Validation Result Model

```typescript
interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: string[];
  sanitizedValue?: any;
}

interface ValidationError {
  field: string;
  message: string;
  originalValue: any;
  suggestedValue?: any;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}
```

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Shared Transaction Exclusion from Cash Flow

*For any* transaction where someone else paid and it is not settled, that transaction should NOT be included in the user's cash flow calculations or expense totals.

**Validates: Requirements 1.1, 2.2, 2.3**

### Property 2: Split Total Never Exceeds Transaction Amount

*For any* transaction with splits, the sum of all split amounts should never exceed the transaction's total amount (with tolerance of 0.01 for rounding).

**Validates: Requirements 1.5, 6.4**

### Property 3: Projected Balance Only Includes Future Transactions

*For any* date used as cutoff, projected balance calculations should only include transactions with dates strictly after the cutoff date in pending calculations.

**Validates: Requirements 5.1, 5.2, 5.3**

### Property 4: No NaN Values in Financial Calculations

*For any* financial calculation result, the value should never be NaN, Infinity, or -Infinity; all results must be valid finite numbers.

**Validates: Requirements 3.1, 3.5, 9.1**

### Property 5: Date Validation Rejects Invalid Calendar Dates

*For any* date string, if the day does not exist in the specified month/year (e.g., February 30), the validation should reject it with a clear error message.

**Validates: Requirements 6.2, 8.4**

### Property 6: Installment Sum Equals Original Amount

*For any* transaction split into installments, the sum of all installment amounts should exactly equal the original transaction amount (no rounding errors).

**Validates: Requirements 7.1, 7.2, 7.3**

### Property 7: Monthly Totals Exclude Unpaid Debts

*For any* month's expense calculation, transactions where someone else paid and the debt is not settled should be excluded from the expense total.

**Validates: Requirements 2.3, 4.1**

### Property 8: Cash Flow Accumulated Balance is Monotonic

*For any* sequence of months in cash flow data, if there are no transactions, the accumulated balance should remain constant or change monotonically based on transaction flow.

**Validates: Requirements 8.3, 8.5**

### Property 9: Sanitization Preserves Data Integrity

*For any* invalid data that is sanitized, the sanitized version should maintain the essential meaning of the data while converting invalid values to safe defaults, and all sanitizations should be logged.

**Validates: Requirements 3.3, 9.2**

### Property 10: Error Logging Includes Full Context

*For any* error that is logged, the log entry should include timestamp, source, operation, inputs, severity, and stack trace to enable effective debugging.

**Validates: Requirements 9.1, 9.3, 9.5**

## Error Handling

### Error Categories

1. **Validation Errors**: Dados de entrada inválidos
   - Ação: Rejeitar com mensagem clara
   - Severidade: MEDIUM
   - Exemplo: Data inválida, valor negativo

2. **Calculation Errors**: Erros durante cálculos
   - Ação: Usar fallback seguro + log
   - Severidade: HIGH
   - Exemplo: Divisão por zero, NaN detectado

3. **Data Corruption**: Dados inconsistentes no banco
   - Ação: Sanitizar + log + alerta
   - Severidade: CRITICAL
   - Exemplo: Splits > total, conta inexistente

4. **Business Logic Errors**: Violação de regras de negócio
   - Ação: Rejeitar + sugerir correção
   - Severidade: MEDIUM
   - Exemplo: Transferência origem = destino

### Error Recovery Strategy

```
1. Detectar erro
2. Classificar severidade
3. Logar com contexto completo
4. Tentar sanitização (se aplicável)
5. Usar fallback seguro
6. Notificar usuário (se necessário)
7. Continuar operação com dados seguros
```

### Logging Levels

- **DEBUG**: Operações normais, valores intermediários
- **INFO**: Operações importantes, sanitizações
- **WARN**: Dados suspeitos, fallbacks usados
- **ERROR**: Erros recuperáveis, validações falhadas
- **CRITICAL**: Erros graves, corrupção de dados

## Testing Strategy

### Unit Tests

Focar em:
- Validação de casos extremos (datas inválidas, valores negativos)
- Lógica de filtro de transações compartilhadas
- Cálculos de projeção com diferentes cenários
- Geração de parcelas com valores fracionários
- Sanitização de dados inválidos

### Property-Based Tests

Configuração:
- Mínimo 100 iterações por teste
- Geradores inteligentes para transações válidas e inválidas
- Validação de invariantes em todos os cálculos

Propriedades a testar:
- Splits nunca excedem total
- Parcelas somam exatamente o total
- Nenhum cálculo retorna NaN
- Datas inválidas são rejeitadas
- Dívidas não pagas não aparecem em despesas

### Integration Tests

Testar:
- Fluxo completo: entrada → validação → cálculo → resultado
- Interação entre engines (balance + dashboard)
- Persistência e recuperação de dados sanitizados
- Atualização de cálculos após mudanças em transações

### Regression Tests

Criar testes para cada bug corrigido:
- Bug #1: Dívidas não pagas em despesas
- Bug #2: Splits maiores que total
- Bug #3: Datas inválidas aceitas
- Bug #4: Parcelas não somam total
- Bug #5: NaN em projeções
