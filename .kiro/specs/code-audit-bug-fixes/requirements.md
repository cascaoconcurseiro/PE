# Requirements Document - Code Audit and Bug Fixes

## Introduction

Este documento especifica os requisitos para correção de bugs e problemas identificados durante auditoria completa do código do sistema financeiro. A auditoria revelou diversos problemas críticos que afetam a integridade dos dados, cálculos financeiros e experiência do usuário.

## Glossary

- **System**: O sistema de gerenciamento financeiro pessoal
- **Transaction**: Transação financeira (receita, despesa ou transferência)
- **Account**: Conta bancária ou carteira
- **Balance_Engine**: Motor de cálculo de saldos
- **Dashboard_Engine**: Motor de cálculo do dashboard
- **Shared_Transaction**: Transação compartilhada entre múltiplos usuários
- **Split**: Divisão de valor em transação compartilhada
- **NaN**: Not a Number - valor numérico inválido
- **Validation_Layer**: Camada de validação de dados
- **Sanitization**: Processo de limpeza e correção de dados inválidos

## Requirements

### Requirement 1: Correção de Bugs Críticos em Validação de Dados

**User Story:** Como desenvolvedor, eu quero corrigir bugs críticos na validação de dados, para que o sistema rejeite dados inválidos antes de salvá-los.

#### Acceptance Criteria

1. WHEN validating transaction splits THEN THE System SHALL ensure split total does not exceed transaction amount
2. WHEN validating transaction date THEN THE System SHALL verify the date exists in the calendar
3. WHEN validating transfer THEN THE System SHALL ensure source and destination are different
4. WHEN validating multi-currency transfer THEN THE System SHALL require destinationAmount
5. WHEN validation fails THEN THE System SHALL provide clear error messages with suggested fixes

### Requirement 2: Correção de Lógica de Transações Compartilhadas

**User Story:** Como usuário, eu quero que transações compartilhadas sejam calculadas corretamente, para que eu veja os valores corretos incluindo dívidas que preciso pagar.

#### Acceptance Criteria

1. WHEN I pay for a shared expense THEN THE System SHALL show only my portion as actual expense
2. WHEN someone else pays for a shared expense THEN THE System SHALL include it in my expenses immediately (as debt to pay)
3. WHEN viewing dashboard expenses THEN THE System SHALL include all debts (settled and unsettled) in the expense total
4. WHEN calculating net worth THEN THE System SHALL include receivables as assets and payables as liabilities
5. WHEN a shared transaction is settled THEN THE System SHALL update all related calculations immediately

### Requirement 3: Validação e Sanitização de Dados

**User Story:** Como desenvolvedor, eu quero garantir que todos os dados financeiros sejam validados e sanitizados, para que valores inválidos nunca causem erros de cálculo.

#### Acceptance Criteria

1. WHEN receiving transaction data THEN THE System SHALL validate all numeric fields for NaN and Infinity
2. WHEN detecting invalid data THEN THE System SHALL log the error with full context for debugging
3. WHEN sanitizing data THEN THE System SHALL convert invalid values to safe defaults without losing data integrity
4. WHEN processing arrays of values THEN THE System SHALL filter out invalid entries and log warnings
5. WHEN performing calculations THEN THE System SHALL use safe mathematical operations that never return NaN

### Requirement 4: Correção de Bugs em Filtros de Dashboard

**User Story:** Como usuário, eu quero que o dashboard mostre apenas dados relevantes, para que eu tenha uma visão clara da minha situação financeira.

#### Acceptance Criteria

1. WHEN filtering dashboard transactions THEN THE System SHALL exclude foreign currency transactions from BRL dashboard
2. WHEN filtering by trip THEN THE System SHALL exclude transactions from foreign trips
3. WHEN calculating net worth THEN THE System SHALL only include BRL accounts in the total
4. WHEN showing upcoming bills THEN THE System SHALL filter by notification date and current month
5. WHEN displaying cash flow data THEN THE System SHALL mask historical empty months before first transaction

### Requirement 5: Correção de Bugs em Cálculo de Projeção

**User Story:** Como usuário, eu quero ver projeções precisas do meu saldo futuro, para que eu possa planejar meus gastos adequadamente.

#### Acceptance Criteria

1. WHEN calculating projected balance THEN THE System SHALL only include future transactions in pending calculations
2. WHEN viewing current month THEN THE System SHALL use today's date as the cutoff for pending vs completed
3. WHEN viewing future months THEN THE System SHALL use today's date to distinguish already occurred from future transactions
4. WHEN calculating pending income THEN THE System SHALL include unsettled receivables from shared expenses
5. WHEN calculating pending expenses THEN THE System SHALL include unsettled payables from shared expenses

### Requirement 6: Correção de Bugs em Validação de Transações

**User Story:** Como desenvolvedor, eu quero que todas as transações sejam validadas antes de serem salvas, para que dados inconsistentes nunca entrem no sistema.

#### Acceptance Criteria

1. WHEN validating transaction amount THEN THE System SHALL reject negative amounts unless marked as refund
2. WHEN validating transaction date THEN THE System SHALL verify the date is valid and exists in the calendar
3. WHEN validating transfer THEN THE System SHALL ensure source and destination accounts are different
4. WHEN validating splits THEN THE System SHALL ensure split total does not exceed transaction amount
5. WHEN validating multi-currency transfer THEN THE System SHALL require destinationAmount for different currencies

### Requirement 7: Correção de Bugs em Geração de Parcelas

**User Story:** Como usuário, eu quero que parcelas sejam geradas corretamente, para que o valor total seja exatamente igual ao valor original.

#### Acceptance Criteria

1. WHEN generating installments THEN THE System SHALL use FinancialPrecision for all calculations
2. WHEN calculating installment amounts THEN THE System SHALL adjust the last installment to match exact total
3. WHEN splitting shared amounts across installments THEN THE System SHALL maintain proportional splits
4. WHEN generating installment dates THEN THE System SHALL handle month-end dates correctly
5. WHEN creating installment series THEN THE System SHALL assign a unique seriesId to all installments

### Requirement 8: Correção de Bugs em Cálculo de Fluxo de Caixa

**User Story:** Como usuário, eu quero ver um gráfico preciso do meu fluxo de caixa anual, para que eu possa entender minha evolução financeira.

#### Acceptance Criteria

1. WHEN calculating cash flow data THEN THE System SHALL start from current balance and work backwards to year start
2. WHEN processing transactions for cash flow THEN THE System SHALL exclude unpaid debts
3. WHEN calculating accumulated balance THEN THE System SHALL apply income and expenses in chronological order
4. WHEN displaying historical months THEN THE System SHALL mask months before first transaction
5. WHEN calculating monthly net flow THEN THE System SHALL use safe operations to prevent NaN

### Requirement 9: Melhorias em Logging e Debugging

**User Story:** Como desenvolvedor, eu quero logs detalhados de erros financeiros, para que eu possa identificar e corrigir problemas rapidamente.

#### Acceptance Criteria

1. WHEN detecting NaN value THEN THE System SHALL log the source, operation, and inputs that caused it
2. WHEN sanitizing invalid data THEN THE System SHALL log what was changed and why
3. WHEN validation fails THEN THE System SHALL provide detailed error messages with suggested fixes
4. WHEN generating health report THEN THE System SHALL include error rate, top sources, and recommendations
5. WHEN critical error occurs THEN THE System SHALL log with CRITICAL severity and full stack trace

### Requirement 10: Correção de Bugs em Cálculo de Sparklines

**User Story:** Como usuário, eu quero ver mini-gráficos precisos dos últimos 7 dias, para que eu possa acompanhar tendências recentes.

#### Acceptance Criteria

1. WHEN calculating sparkline data THEN THE System SHALL filter transactions by exact date match
2. WHEN summing daily totals THEN THE System SHALL use safe operations to prevent NaN
3. WHEN no transactions exist for a day THEN THE System SHALL return 0 instead of undefined
4. WHEN processing transaction amounts THEN THE System SHALL sanitize values before summing
5. WHEN returning sparkline array THEN THE System SHALL ensure all values are valid numbers
