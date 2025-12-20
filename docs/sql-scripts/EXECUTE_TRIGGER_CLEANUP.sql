-- ==============================================================================
-- EXECUÇÃO DA LIMPEZA DE TRIGGERS
-- DATA: 2025-12-19
-- ==============================================================================
-- INSTRUÇÕES:
-- 1. Execute IDENTIFY_OBSOLETE_TRIGGERS.sql primeiro
-- 2. Revise os resultados
-- 3. Execute este script para limpar triggers duplicados/obsoletos
-- ==============================================================================

BEGIN;

-- ============================================================================
-- REMOÇÃO DE TRIGGERS DUPLICADOS (CONFIRMADOS)
-- ============================================================================

-- Remover trigger de auditoria duplicado
-- (tr_audit_transactions é duplicado de trg_audit_transactions)
DROP TRIGGER IF EXISTS tr_audit_transactions ON transactions;

-- ============================================================================
-- REMOÇÃO DE TRIGGERS DDD/LEDGER (SE NÃO ESTIVER EM USO)
-- ============================================================================
-- Descomente as linhas abaixo se o sistema DDD/Ledger não estiver em uso

-- DROP TRIGGER IF EXISTS trg_bridge_transactions_ledger ON transactions;
-- DROP TRIGGER IF EXISTS trg_sync_ddd_ledger ON transactions;

-- ============================================================================
-- REMOÇÃO DE TRIGGER SOFT DELETE (SE NÃO ESTIVER EM USO)
-- ============================================================================
-- Descomente a linha abaixo se soft delete não estiver implementado

-- DROP TRIGGER IF EXISTS trg_propagate_soft_delete ON transactions;

-- ============================================================================
-- VERIFICAÇÃO FINAL
-- ============================================================================

SELECT 
    'TRIGGERS RESTANTES NA TABELA TRANSACTIONS' as resultado,
    trigger_name,
    event_manipulation as evento
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'transactions'
ORDER BY trigger_name;

COMMIT;

-- ============================================================================
-- TRIGGERS QUE DEVEM PERMANECER:
-- ============================================================================
-- 1. trg_audit_transactions - Auditoria de alterações
-- 2. trg_update_account_balance - Atualização de saldos
-- 3. trg_update_transactions_updated_at - Timestamp de atualização
-- 4. trg_validate_domain - Validação de domínio
-- 5. trigger_notify_shared_transaction - Notificações de compartilhamento
-- ============================================================================
