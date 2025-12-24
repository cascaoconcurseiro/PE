# 🚀 Como Aplicar a Migration AGORA

**Migration:** `20260301_cleanup_triggers.sql`  
**Tempo:** 1 minuto

---

## Opção 1: Via Supabase Dashboard (RECOMENDADO)

### Passo 1: Acessar SQL Editor

1. Abrir: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql
2. Fazer login se necessário

### Passo 2: Copiar SQL

Abrir o arquivo: `producao/supabase/migrations/20260301_cleanup_triggers.sql`

**OU** copiar daqui:

```sql
-- Migration: Cleanup Legacy and Duplicate Triggers
-- Date: 2026-03-01
-- Description: Removes old, disabled, or duplicate triggers to clean up the database schema.

DROP TRIGGER IF EXISTS trg_sync_legacy_cache ON ledger_accounts;
DROP FUNCTION IF EXISTS sync_ledger_to_legacy_cache();

DROP TRIGGER IF EXISTS trg_notify_new_split ON transaction_splits;
DROP FUNCTION IF EXISTS notify_new_split_debt();

DROP TRIGGER IF EXISTS trigger_notify_shared_transaction ON transactions;
DROP FUNCTION IF EXISTS notify_shared_transaction();

DROP TRIGGER IF EXISTS trg_auto_revert_settlement ON transaction_splits;
DROP FUNCTION IF EXISTS handle_settlement_deletion();

INSERT INTO audit_logs (
    entity, 
    entity_id, 
    action, 
    changes, 
    user_id
) VALUES (
    'SYSTEM', 
    'SCHEMA_CLEANUP', 
    'DELETE', 
    '{"description": "Removed legacy triggers"}', 
    auth.uid()
);
```

### Passo 3: Colar e Executar

1. Colar o SQL no editor
2. Clicar em "Run" (ou Ctrl+Enter)
3. Aguardar mensagem de sucesso

### Passo 4: Verificar

Execute para validar:

```sql
-- Verificar se triggers sumiram
SELECT tgname 
FROM pg_trigger 
WHERE tgname IN ('trg_sync_legacy_cache', 'trg_notify_new_split', 'trigger_notify_shared_transaction', 'trg_auto_revert_settlement');
-- Resultado esperado: NENHUMA LINHA (0 rows)
```
