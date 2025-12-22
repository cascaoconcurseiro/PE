# Correção do Factory Reset - Efeito Cascata Completo

## 🔍 Problema Identificado

O factory reset não estava excluindo todos os dados do banco de dados, causando:
- Fluxo de caixa ainda puxando dados de lançamentos que não existem mais
- Falta de efeito cascata na exclusão de dados relacionados
- Transações espelho (mirror) e compartilhadas permanecendo no sistema

## 🎯 Causa Raiz

A função `execute_factory_reset_complete()` estava deletando apenas:
- Transações onde `user_id = target_user_id`

**MAS NÃO estava deletando:**
1. **Transações espelho** (`is_mirror = true`) - criadas quando o usuário participa de transações compartilhadas
2. **Participações em transações compartilhadas** - registros em `shared_transaction_requests`
3. **Dados relacionados** em outras tabelas que referenciam as transações

## 🔧 Solução Implementada

### 1. Nova Migração SQL
**Arquivo:** `supabase/migrations/20251222_fix_factory_reset_cascade.sql`

**Função Corrigida:** `execute_factory_reset_complete()`
- ✅ Deleta transações próprias do usuário
- ✅ Deleta transações espelho (`is_mirror = true`)
- ✅ Remove participações em transações compartilhadas
- ✅ Deleta contas, investimentos, orçamentos
- ✅ Limpa solicitações de compartilhamento
- ✅ Remove espelhos de transações
- ✅ Limpa splits, ledger entries, extratos bancários
- ✅ Remove viagens do usuário

### 2. Função de Verificação Aprimorada
**Função:** `verify_factory_reset_completeness()`
- Verifica se TODAS as transações relacionadas foram deletadas
- Conta transações próprias, espelhos e participações compartilhadas
- Retorna diagnóstico detalhado do que ainda resta

### 3. Nova Função de Diagnóstico
**Função:** `diagnose_factory_reset_issue()`
- Identifica exatamente qual tipo de dados não foi deletado
- Conta transações que aparecem no fluxo de caixa
- Detecta espelhos órfãos
- Fornece diagnóstico específico do problema

### 4. Atualização do DataCleanupEngine
**Arquivo:** `src/services/factory-reset/DataCleanupEngine.ts`
- ✅ Atualizada interface `CleanupResult` com novo campo `sharedParticipationRemoved`
- ✅ Método `cleanupUserData()` agora conta transações espelho deletadas
- ✅ Novo método `diagnoseFactoryResetIssue()` para diagnóstico
- ✅ Método `verifyCleanupCompleteness()` verifica todos os tipos de dados

## 🧪 Como Testar a Correção

### 1. Aplicar a Migração
```sql
-- Execute no Supabase SQL Editor
\i supabase/migrations/20251222_fix_factory_reset_cascade.sql
```

### 2. Diagnosticar Problema Existente
```sql
-- Substitua 'SEU_USER_ID' pelo ID real
SELECT * FROM diagnose_factory_reset_issue('SEU_USER_ID');
```

### 3. Executar Factory Reset Corrigido
```sql
-- Substitua 'SEU_USER_ID' pelo ID real
SELECT * FROM execute_factory_reset_complete('SEU_USER_ID');
```

### 4. Verificar Completude
```sql
-- Substitua 'SEU_USER_ID' pelo ID real
SELECT * FROM verify_factory_reset_completeness('SEU_USER_ID');
```

### 5. Testar Fluxo de Caixa
```sql
-- Deve retornar vazio após factory reset
SELECT * FROM get_monthly_cashflow(2024, 'SEU_USER_ID');
```

### 6. Script de Teste Automatizado
```bash
# Configure as variáveis de ambiente e execute
node test-factory-reset-fix.js
```

## 📊 Arquivos de Diagnóstico

### 1. Script SQL de Diagnóstico
**Arquivo:** `DIAGNOSTICO_FACTORY_RESET.sql`
- Consultas para identificar dados não deletados
- Verificação do que aparece no fluxo de caixa
- Contagem de transações espelho e compartilhadas

### 2. Script de Teste JavaScript
**Arquivo:** `test-factory-reset-fix.js`
- Teste automatizado completo
- Diagnóstico antes e depois da correção
- Verificação do fluxo de caixa

## 🔄 Fluxo de Exclusão Corrigido

```
1. Transações próprias (user_id = target_user_id)
   ↓
2. Transações espelho (is_mirror = true)
   ↓
3. Participações compartilhadas (shared_transaction_requests)
   ↓
4. Contas do usuário
   ↓
5. Solicitações de compartilhamento criadas pelo usuário
   ↓
6. Espelhos de transações compartilhadas
   ↓
7. Dados relacionados (splits, ledger, extratos, viagens)
   ↓
8. Verificação de completude
   ↓
9. Limpeza de caches locais
   ↓
10. Reload completo da aplicação
```

## ✅ Resultado Esperado

Após aplicar a correção:
- ✅ Factory reset deleta TODAS as transações relacionadas ao usuário
- ✅ Fluxo de caixa retorna vazio (sem dados)
- ✅ Dashboard não mostra transações fantasma
- ✅ Efeito cascata funciona corretamente
- ✅ Usuário tem experiência limpa após reset

## 🚨 Importante

- **Backup:** Sempre faça backup antes de aplicar em produção
- **Teste:** Execute primeiro em ambiente de desenvolvimento
- **Verificação:** Use as funções de diagnóstico para confirmar a correção
- **Monitoramento:** Acompanhe logs de auditoria em `factory_reset_audit`

## 📝 Próximos Passos

1. Aplicar migração em desenvolvimento
2. Testar com usuários de teste
3. Verificar se fluxo de caixa está limpo
4. Aplicar em produção com backup
5. Monitorar logs de auditoria
6. Documentar casos de sucesso