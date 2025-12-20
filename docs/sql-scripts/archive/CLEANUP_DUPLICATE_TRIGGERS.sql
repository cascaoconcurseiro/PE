-- ==============================================================================
-- LIMPEZA DE TRIGGERS DUPLICADOS E OBSOLETOS
-- DATA: 2025-12-19
-- ==============================================================================
-- INSTRUÇÕES:
-- 1. Execute a PARTE 1 primeiro para ver todos os triggers
-- 2. Revise a lista e confirme quais devem ser removidos
-- 3. Execute a PARTE 2 para remover os triggers duplicados/obsoletos
-- ==============================================================================

-- ============================================================================
-- PARTE 1: DIAGNÓSTICO COMPLETO DE TRIGGERS
-- ============================================================================

-- 1.1 Todos os triggers por tabela
SELECT 
    '=== TRIGGERS POR TABELA ===' as info;

SELECT 
    event_object_table as tabela,
    trigger_name,
    event_manipulation as evento,
    action_timing as quando,
    SUBSTRING(action_statement FROM 'EXECUTE FUNCTION (.+)\(\)') as funcao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- 1.2 Contagem de triggers por tabela
SELECT 
    '=== CONTAGEM POR TABELA ===' as info;

SELECT 
    event_object_table as tabela,
    COUNT(DISTINCT trigger_name) as total_triggers
FROM information_schema.triggers
WHERE trigger_schema = 'public'
GROUP BY event_object_table
ORDER BY total_triggers DESC;

-- 1.3 Triggers potencialmente duplicados (funções similares)
SELECT 
    '=== TRIGGERS POTENCIALMENTE DUPLICADOS ===' as info;

SELECT 
    t1.event_object_table as tabela,
    t1.trigger_name as trigger_1,
    t2.trigger_name as trigger_2,
    t1.action_statement as funcao_1,
    t2.action_statement as funcao_2
FROM information_schema.triggers t1
JOIN information_schema.triggers t2 
    ON t1.event_object_table = t2.event_object_table
    AND t1.trigger_name < t2.trigger_name
    AND t1.event_manipulation = t2.event_manipulation
WHERE t1.trigger_schema = 'public'
  AND t2.trigger_schema = 'public';

-- ============================================================================
-- PARTE 2: REMOÇÃO DE TRIGGERS DUPLICADOS/OBSOLETOS
-- ============================================================================
-- ATENÇÃO: Execute apenas após confirmar que os triggers devem ser removidos!
-- ==============================================================================

-- 2.1 Remover trigger de auditoria duplicado (manter apenas um)
-- tr_audit_transactions e trg_audit_transactions são duplicados
DROP TRIGGER IF EXISTS tr_audit_transactions ON transactions;

-- 2.2 Remover triggers de bridge/ledger se não estiverem em uso
-- (verificar se o sistema DDD ledger está ativo)
-- DROP TRIGGER IF EXISTS trg_bridge_transactions_ledger ON transactions;
-- DROP TRIGGER IF EXISTS trg_sync_ddd_ledger ON transactions;

-- 2.3 Verificar se trg_propagate_soft_delete é necessário
-- (depende se soft delete está implementado)
-- DROP TRIGGER IF EXISTS trg_propagate_soft_delete ON transactions;

-- ============================================================================
-- PARTE 3: TRIGGERS ESSENCIAIS A MANTER
-- ============================================================================
-- NÃO REMOVER estes triggers:
-- 
-- 1. trg_update_account_balance - Atualiza saldos das contas
-- 2. trigger_notify_shared_transaction - Notificações de compartilhamento
-- 3. trg_validate_domain - Validação de domínio
-- 4. trg_update_transactions_updated_at - Timestamp de atualização
-- 5. trg_audit_transactions - Auditoria (manter apenas um)
-- ==============================================================================

-- ============================================================================
-- PARTE 4: VERIFICAÇÃO PÓS-LIMPEZA
-- ============================================================================

SELECT 
    '=== TRIGGERS RESTANTES APÓS LIMPEZA ===' as info;

SELECT 
    event_object_table as tabela,
    trigger_name,
    event_manipulation as evento,
    action_timing as quando
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
