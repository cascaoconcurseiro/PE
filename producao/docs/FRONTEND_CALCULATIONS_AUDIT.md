# Frontend Financial Calculations Audit

**Date:** 2024-12-24  
**Task:** 11.1 Identify all financial calculations in frontend  
**Status:** Complete

---

## Executive Summary

Identificados **múltiplos locais** no frontend onde cálculos financeiros são realizados. Estes cálculos devem ser movidos para o backend para estabelecer o ledger como fonte única de verdade.

---

## Categorias de Cálculos Encontrados

### 1. Cálculos de Saldo (Balance Calculations)

**Locais:**
- `producao/src/features/transactions/Transactions.tsx` - Calcula income, expense, balance
- `producao/src/services/printUtils.ts` - Calcula income, expense, balance para impressão
- `producao/src/services/accountUtils.ts` - Calcula total de débitos e pagamentos
- `producao/src/components/ReportsDDD.tsx` - Calcula totais de assets, liabilities, equity

**Problema:** Estes cálculos usam a tabela transactions diretamente, ignorando o ledger.

**Solução:** Criar RPC `get_account_balance(user_id, account_id)` que usa ledger_entries.

---

### 2. Agregações de Transações (Transaction Aggregations)

**Locais:**
- `producao/src/features/trips/TripDetail.tsx` - Calcula total gasto em viagem
- `producao/src/features/trips/tabs/TripStats.tsx` - Calcula total gasto em viagem
- `producao/src/services/pdfService.ts` - Calcula total income e expense para PDF
- `producao/src/components/goals/GoalsSummary.tsx` - Calcula totais de metas

**Problema:** Agregações locais podem não refletir o estado real do ledger.

**Solução:** Criar RPC `get_category_totals(user_id, filters)` que usa ledger_entries.

---

### 3. Cálculos de Parcelas Compartilhadas (Shared Splits)

**Locais:**
- `producao/src/services/tripDebtsCalculator.ts` - Calcula total de splits
- `producao/src/hooks/useSharedFinances.ts` - Calcula "minha parte"
- `producao/src/features/transactions/TransactionList.tsx` - Calcula total de splits
- `producao/src/core/engines/financialLogic.ts` - Valida splits

**Problema:** Lógica duplicada e complexa no frontend.

**Solução:** O ledger já tem a lógica correta com Receivables/Payables. Frontend deve apenas exibir.

---

### 4. Cálculos de Antecipação de Parcelas

**Locais:**
- `producao/src/features/transactions/InstallmentAnticipationModal.tsx` - Calcula total de parcelas selecionadas
- `producao/src/features/transactions/AnticipateInstallmentsModal.tsx` - Calcula total de parcelas selecionadas
- `producao/src/components/shared/SharedInstallmentEditModal.tsx` - Calcula total de parcelas

**Problema:** Cálculos simples mas desnecessários no frontend.

**Solução:** Backend pode retornar totais pré-calculados.

---

### 5. Cálculos de Câmbio (Exchange Calculations)

**Locais:**
- `producao/src/features/trips/tabs/TripExchange.tsx` - Calcula total BRL, total foreign, taxa média

**Problema:** Cálculos de câmbio no frontend.

**Solução:** Criar RPC `get_exchange_summary(trip_id)` se necessário.

---

### 6. Utilitários Financeiros (Financial Utilities)

**Locais:**
- `producao/src/utils/financial.ts` - Funções para calcular totais por mês
- `producao/src/core/engines/financialLogic.ts` - Validações e cálculos complexos

**Problema:** Lógica de negócio no frontend.

**Solução:** Mover validações para backend, frontend apenas exibe.

---

## Priorização

### Alta Prioridade (Afeta Precisão Financeira)

1. ✅ **Cash Flow Calculation** - JÁ CORRIGIDO
2. **Balance Calculations** - Cálculos de saldo em Transactions.tsx
3. **Shared Splits Logic** - Lógica de parcelas compartilhadas

### Média Prioridade (Melhora Arquitetura)

4. **Trip Aggregations** - Totais de viagens
5. **Category Totals** - Totais por categoria
6. **Account Balance** - Saldo de contas

### Baixa Prioridade (Otimizações)

7. **Installment Totals** - Totais de parcelas
8. **Exchange Calculations** - Cálculos de câmbio
9. **Goal Summaries** - Resumos de metas

---

## Recomendações

### Fase 1: Criar RPCs Essenciais

```sql
-- 1. Saldo de conta
CREATE FUNCTION get_account_balance(p_user_id UUID, p_account_id UUID)
RETURNS NUMERIC

-- 2. Resumo mensal
CREATE FUNCTION get_monthly_summary(p_user_id UUID, p_year INT, p_month INT)
RETURNS TABLE (income NUMERIC, expense NUMERIC, balance NUMERIC)

-- 3. Totais por categoria
CREATE FUNCTION get_category_totals(p_user_id UUID, p_start_date DATE, p_end_date DATE)
RETURNS TABLE (category TEXT, total NUMERIC)
```

### Fase 2: Refatorar Frontend

1. Substituir cálculos locais por chamadas RPC
2. Remover lógica de negócio duplicada
3. Atualizar componentes para usar dados do backend

### Fase 3: Validar e Testar

1. Comparar resultados antigos vs novos
2. Validar precisão com dados reais
3. Testar performance

---

## Impacto Esperado

**Antes:**
- ❌ Cálculos duplicados em múltiplos locais
- ❌ Lógica de negócio no frontend
- ❌ Possibilidade de inconsistências
- ❌ Difícil manutenção

**Depois:**
- ✅ Ledger como fonte única de verdade
- ✅ Lógica de negócio centralizada no backend
- ✅ Consistência garantida
- ✅ Fácil manutenção

---

**Audit Completed By:** Kiro AI  
**Date:** 2024-12-24  
**Status:** Ready for Task 11.2 (Create backend RPCs)

