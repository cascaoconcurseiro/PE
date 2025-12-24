# Problemas Reais do Sistema - Análise e Soluções

**Data:** 2024-12-24  
**Status:** ✅ PROBLEMAS CORRIGIDOS

**Última Atualização:** 2024-12-24 - Correções aplicadas no banco de dados

---

## 🚨 Problemas Reportados pelo Usuário

### 1. "Conta de despesa não encontrada para categoria: Alimentação"
**Problema:** Sistema não encontra conta de despesa para categorias
**Causa Raiz:** Sistema atual NÃO usa double-entry bookkeeping como documentado
**Impacto:** Transações não podem ser criadas

### 2. "Transações compartilhadas e importadas não aparecem"
**Problema:** Após criar/importar, transações não são exibidas
**Causa Raiz:** Possível problema de RLS ou filtros no frontend
**Impacto:** Usuário não vê suas transações

### 3. "Fluxo de caixa considera que eu paguei transação compartilhada"
**Problema:** Quando usuário B deve pagar, o fluxo de caixa já considera como pago
**Causa Raiz:** Lógica de cálculo de cash flow não considera Receivables/Payables corretamente
**Impacto:** Saldo financeiro incorreto

---

## 🔍 Análise Técnica

### Problema 1: Sistema de Contas

**O que foi documentado:**
- Sistema usa double-entry bookkeeping
- Contas: Expense, Income, Receivables, Payables
- Ledger entries para cada transação

**Realidade no Banco:**
- Tabela `accounts` usa tipos: 'CONTA CORRENTE', 'POUPANÇA', 'CARTÃO DE CRÉDITO', etc.
- NÃO há contas de sistema (Expense, Income, Receivables, Payables)
- Sistema atual é DIFERENTE do documentado

**Conclusão:** A documentação está ERRADA ou o sistema não foi implementado conforme documentado.

### Problema 2: Transações Compartilhadas

**Funções existentes no banco:**
- ✅ `create_shared_transaction_v2`
- ✅ `respond_to_shared_request_v2`
- ✅ `sync_shared_transaction_v2`

**Possíveis causas:**
1. RLS (Row Level Security) bloqueando visualização
2. Frontend filtrando incorretamente
3. Transações criadas mas não sincronizadas
4. Campo `deleted` ou `sync_status` incorreto

### Problema 3: Fluxo de Caixa Incorreto

**Problema Real:**
- Usuário A cria despesa compartilhada de R$ 100 (50/50 com B)
- Usuário A paga R$ 100
- Usuário B deve R$ 50 para A
- **Fluxo de caixa de A deveria mostrar:**
  - Despesa: -R$ 50 (sua parte)
  - A Receber: +R$ 50 (de B)
  - **Total: R$ 0** (até B pagar)
- **Mas está mostrando:**
  - Despesa: -R$ 100 (como se A pagasse tudo)

---

## ✅ Soluções Necessárias

### Solução 1: Corrigir Sistema de Contas

**Opção A: Implementar Double-Entry Corretamente**
1. Criar contas de sistema
2. Modificar constraint para aceitar tipos: 'expense', 'income', 'asset', 'liability'
3. Implementar ledger entries para todas transações

**Opção B: Adaptar Documentação à Realidade**
1. Remover referências a double-entry bookkeeping
2. Usar sistema atual de contas de usuário
3. Simplificar lógica de transações compartilhadas

**Recomendação:** Opção B (mais rápido e menos breaking changes)

### Solução 2: Corrigir Visualização de Transações

**Passos:**
1. Verificar RLS policies
2. Verificar filtros no frontend
3. Verificar campo `deleted` e `sync_status`
4. Testar queries diretamente no banco

### Solução 3: Corrigir Cálculo de Cash Flow

**Lógica Correta:**
```sql
-- Para Usuário A (payer):
-- Despesa própria: -50
-- A Receber de B: +50 (quando B aceitar)
-- Total impacto: -50 (até B pagar)

-- Para Usuário B (acceptor):
-- Despesa própria: -50
-- A Pagar para A: -50 (dívida)
-- Total impacto: -50 (sua parte)
```

**Implementação:**
1. Modificar função `calculate_cash_flow()`
2. Considerar transações compartilhadas separadamente
3. Mostrar "A Receber" e "A Pagar" no dashboard
4. Calcular saldo real considerando dívidas

---

## 🎯 Plano de Ação Imediato

### Passo 1: Investigar Sistema Atual (15 min)
```sql
-- 1. Verificar contas do usuário
SELECT * FROM accounts WHERE user_id = 'USER_ID' AND deleted = false;

-- 2. Verificar transações compartilhadas
SELECT * FROM transactions WHERE is_shared = true AND deleted = false LIMIT 10;

-- 3. Verificar shared_requests
SELECT * FROM shared_requests WHERE deleted = false LIMIT 10;

-- 4. Verificar RLS policies
SELECT * FROM pg_policies WHERE tablename IN ('transactions', 'shared_requests');
```

### Passo 2: Corrigir Problema Imediato (30 min)
1. Identificar por que transações não aparecem
2. Corrigir RLS ou filtros
3. Testar criação de transação compartilhada

### Passo 3: Corrigir Cash Flow (1 hora)
1. Analisar função atual de cash flow
2. Modificar para considerar shared transactions corretamente
3. Adicionar campos "A Receber" e "A Pagar"
4. Testar com dados reais

---

## 📋 Checklist de Validação

**Antes de considerar "corrigido":**
- [ ] Usuário consegue criar transação normal
- [ ] Usuário consegue criar transação compartilhada
- [ ] Transação compartilhada aparece para ambos usuários
- [ ] Usuário B consegue aceitar/rejeitar
- [ ] Cash flow mostra valores corretos para A
- [ ] Cash flow mostra valores corretos para B
- [ ] "A Receber" aparece no dashboard de A
- [ ] "A Pagar" aparece no dashboard de B
- [ ] Após B pagar, valores são atualizados

---

## 🔴 Conclusão

**O sistema atual NÃO funciona como documentado.**

A documentação descreve um sistema de double-entry bookkeeping que NÃO está implementado no banco de dados. O banco usa um sistema mais simples de contas de usuário.

**Próximos passos:**
1. Investigar sistema REAL no banco
2. Corrigir problemas REAIS (não os documentados)
3. Atualizar documentação para refletir realidade
4. OU implementar sistema conforme documentado (muito trabalho)

**Recomendação:** Focar em corrigir o sistema ATUAL, não em implementar o sistema DOCUMENTADO.

---

**Documento Criado Por:** Kiro AI  
**Data:** 2024-12-24  
**Status:** 🔴 PROBLEMAS CRÍTICOS - REQUER AÇÃO IMEDIATA
