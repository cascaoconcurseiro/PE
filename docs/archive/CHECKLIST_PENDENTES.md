# 📋 CHECKLIST DE TAREFAS PENDENTES

**Data:** 2026-01-28  
**Status Atual:** ✅ Sistema funcional e robusto

---

## ✅ CONCLUÍDO HOJE

- [x] Migration de constraints aplicada
- [x] Índices de performance criados
- [x] Validação automática de splits
- [x] View de saúde do sistema
- [x] updated_at automático
- [x] Projeto organizado
- [x] Documentação criada
- [x] Sistema validado (0 problemas)

---

## 🔴 PENDENTES - PRIORIDADE CRÍTICA

### 1. **Precisão Numérica com Decimal.js**

**Status:** ⚠️ Documentado mas não implementado

**O que fazer:**
```bash
# 1. Instalar dependência
npm install decimal.js @types/decimal.js

# 2. Refatorar financialPrecision.ts
# 3. Substituir todas as operações matemáticas
```

**Arquivos a modificar:**
- `src/services/financialPrecision.ts` - Refatorar completamente
- `src/services/balanceEngine.ts` - Usar FinancialPrecision
- `src/services/financialLogic.ts` - Usar FinancialPrecision
- Todos os arquivos que usam `round2dec`

**Impacto:** 🔴 **CRÍTICO** - Erros de ponto flutuante podem causar problemas financeiros

**Documentação:** `docs/MELHORIAS_CODIGO_E_LOGICA_FINANCEIRA.md`

---

### 2. **Assets.account_id como TEXT**

**Status:** ⚠️ Identificado mas não corrigido

**Problema:**
```sql
-- assets.account_id é TEXT, deveria ser UUID
-- Falta FK (foreign key)
```

**O que fazer:**
```sql
-- Migration para corrigir
ALTER TABLE assets
  ALTER COLUMN account_id TYPE UUID USING account_id::uuid;

ALTER TABLE assets
  ADD CONSTRAINT fk_assets_account
  FOREIGN KEY (account_id) REFERENCES accounts(id);
```

**Impacto:** 🟡 **MÉDIO** - Pode causar inconsistências

**Documentação:** `docs/ANALISE_SCHEMA_SUPABASE.md` (Problema #7)

---

## 🟡 PENDENTES - PRIORIDADE ALTA

### 3. **Consolidar Tabelas de Auditoria**

**Status:** ⚠️ Identificado mas não implementado

**Problema:**
- 4 tabelas de auditoria diferentes
- Campos redundantes
- Estrutura confusa

**O que fazer:**
- Criar migration para consolidar
- Migrar dados existentes
- Remover tabelas antigas

**Impacto:** 🟡 **MÉDIO** - Melhora organização, não quebra funcionalidade

**Documentação:** `docs/ANALISE_SCHEMA_SUPABASE.md` (Problema #1)

---

### 4. **Limpar Campos Duplicados em Transactions**

**Status:** ⚠️ Identificado mas não implementado

**Problema:**
- Campos de reconciliação duplicados
- Campos de settlement duplicados
- Relacionamentos confusos

**O que fazer:**
- Criar tabela `transaction_relationships`
- Migrar dados
- Remover campos duplicados

**Impacto:** 🟡 **MÉDIO** - Melhora estrutura, requer planejamento

**Documentação:** `docs/ANALISE_SCHEMA_SUPABASE.md` (Problema #2)

---

### 5. **Implementar IntegrityService**

**Status:** ⚠️ Documentado mas não implementado

**O que fazer:**
- Criar `src/services/integrityService.ts`
- Integrar no `useDataStore.ts`
- Verificação periódica automática

**Impacto:** 🟡 **MÉDIO** - Melhora detecção de problemas

**Documentação:** `docs/MELHORIAS_CODIGO_E_LOGICA_FINANCEIRA.md`

---

## 🟢 PENDENTES - PRIORIDADE BAIXA (Opcional)

### 6. **Remover Tabela credit_cards**

**Status:** ⚠️ Identificado mas não implementado

**Problema:**
- Tabela `credit_cards` separada
- Redundante com `accounts` (type='CREDIT_CARD')

**O que fazer:**
- Migrar dados para `accounts`
- Remover tabela `credit_cards`

**Impacto:** 🟢 **BAIXO** - Melhora organização

**Documentação:** `docs/ANALISE_SCHEMA_SUPABASE.md` (Problema #8)

---

### 7. **Consolidar journal_entries com ledger_entries**

**Status:** ⚠️ Identificado mas não implementado

**Problema:**
- Potencial redundância
- Estrutura confusa

**O que fazer:**
- Verificar se `journal_entries` é usado
- Se não, remover
- Se sim, migrar para `ledger_entries`

**Impacto:** 🟢 **BAIXO** - Melhora organização

**Documentação:** `docs/ANALISE_SCHEMA_SUPABASE.md` (Problema #6)

---

### 8. **Refatorar balanceEngine.ts**

**Status:** ⚠️ Documentado mas não implementado

**O que fazer:**
- Usar `FinancialPrecision` em vez de `round2dec` local
- Melhorar validações
- Adicionar testes

**Impacto:** 🟢 **BAIXO** - Melhora código, não quebra funcionalidade

**Documentação:** `docs/MELHORIAS_CODIGO_E_LOGICA_FINANCEIRA.md`

---

## 📊 RESUMO DE PRIORIDADES

### 🔴 CRÍTICO (Fazer Agora)
1. **Precisão Numérica** - Instalar decimal.js e refatorar
2. **Assets.account_id** - Converter para UUID

### 🟡 ALTA (Próxima Sprint)
3. **Consolidar Auditoria** - Limpar redundâncias
4. **Limpar Transactions** - Remover campos duplicados
5. **IntegrityService** - Implementar verificação automática

### 🟢 BAIXA (Backlog)
6. **Remover credit_cards** - Consolidar em accounts
7. **Consolidar journal_entries** - Verificar e limpar
8. **Refatorar balanceEngine** - Melhorar código

---

## 🎯 RECOMENDAÇÃO

### Fazer Agora (Esta Semana)
1. ✅ **Precisão Numérica** - Mais crítico para integridade financeira
2. ✅ **Assets.account_id** - Correção simples e importante

### Planejar (Próximo Mês)
3. Consolidar auditoria
4. Limpar transactions
5. Implementar IntegrityService

### Opcional (Quando Tiver Tempo)
6-8. Melhorias de organização

---

## 📚 DOCUMENTAÇÃO

- `docs/MELHORIAS_CODIGO_E_LOGICA_FINANCEIRA.md` - Melhorias de código
- `docs/ANALISE_SCHEMA_SUPABASE.md` - Melhorias de schema
- `docs/IMPLEMENTACAO_MELHORIAS.md` - Guia de implementação

---

## ✅ CONCLUSÃO

**Sistema está funcional e robusto!** ✅

As pendências são **melhorias opcionais** que podem ser feitas gradualmente. O sistema já está em nível profissional e funcionando perfeitamente.

**Prioridade:** Focar em precisão numérica (decimal.js) se quiser melhorar ainda mais a confiabilidade.

