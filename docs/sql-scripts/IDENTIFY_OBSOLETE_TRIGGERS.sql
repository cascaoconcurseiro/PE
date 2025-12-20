-- ==============================================================================
-- IDENTIFICAÇÃO DE TRIGGERS OBSOLETOS
-- DATA: 2025-12-19
-- ==============================================================================
-- Este script identifica triggers que podem ser removidos com segurança
-- ==============================================================================

-- ============================================================================
-- ANÁLISE 1: Triggers na tabela TRANSACTIONS
-- ============================================================================

SELECT 
    'TRIGGERS NA TABELA TRANSACTIONS' as analise,
    trigger_name,
    event_manipulation as evento,
    action_timing as quando,
    CASE 
        WHEN trigger_name = 'tr_audit_transactions' THEN 'DUPLICADO - remover (manter trg_audit_transactions)'
        WHEN trigger_name = 'trg_audit_transactions' THEN 'MANTER - auditoria'
        WHEN trigger_name = 'trg_bridge_transactions_ledger' THEN 'VERIFICAR - DDD ledger em uso?'
        WHEN trigger_name = 'trg_propagate_soft_delete' THEN 'VERIFICAR - soft delete em uso?'
        WHEN trigger_name = 'trg_sync_ddd_ledger' THEN 'VERIFICAR - DDD ledger em uso?'
        WHEN trigger_name = 'trg_update_account_balance' THEN 'MANTER - atualização de saldos'
        WHEN trigger_name = 'trg_update_transactions_updated_at' THEN 'MANTER - timestamp'
        WHEN trigger_name = 'trg_validate_domain' THEN 'MANTER - validação'
        WHEN trigger_name = 'trigger_notify_shared_transaction' THEN 'MANTER - notificações'
        ELSE 'ANALISAR'
    END as recomendacao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table = 'transactions'
ORDER BY trigger_name;

-- ============================================================================
-- ANÁLISE 2: Triggers em OUTRAS tabelas
-- ============================================================================

SELECT 
    'TRIGGERS EM OUTRAS TABELAS' as analise,
    event_object_table as tabela,
    trigger_name,
    event_manipulation as evento,
    CASE 
        WHEN trigger_name LIKE '%updated_at%' THEN 'MANTER - timestamp'
        WHEN trigger_name LIKE '%audit%' THEN 'MANTER - auditoria'
        WHEN trigger_name LIKE '%balance%' THEN 'MANTER - saldos'
        WHEN trigger_name LIKE '%notify%' THEN 'MANTER - notificações'
        WHEN trigger_name LIKE '%validate%' THEN 'MANTER - validação'
        ELSE 'ANALISAR'
    END as recomendacao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table != 'transactions'
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- ANÁLISE 3: Funções de trigger órfãs (sem trigger associado)
-- ============================================================================

SELECT 
    'FUNÇÕES DE TRIGGER POTENCIALMENTE ÓRFÃS' as analise,
    p.proname as funcao,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.triggers t 
            WHERE t.action_statement LIKE '%' || p.proname || '%'
        ) THEN 'EM USO'
        ELSE 'POSSIVELMENTE ÓRFÃ'
    END as status
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
  AND p.prorettype = 'trigger'::regtype
ORDER BY p.proname;

-- ============================================================================
-- ANÁLISE 4: Verificar se DDD/Ledger está em uso
-- ============================================================================

SELECT 
    'VERIFICAÇÃO DDD/LEDGER' as analise,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'ledger_entries') 
        THEN 'Tabela ledger_entries EXISTE - triggers DDD podem ser necessários'
        ELSE 'Tabela ledger_entries NÃO EXISTE - triggers DDD podem ser removidos'
    END as status;

-- ============================================================================
-- ANÁLISE 5: Verificar soft delete
-- ============================================================================

SELECT 
    'VERIFICAÇÃO SOFT DELETE' as analise,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = 'transactions' AND column_name = 'deleted_at'
        ) 
        THEN 'Coluna deleted_at EXISTE - trigger soft delete pode ser necessário'
        ELSE 'Coluna deleted_at NÃO EXISTE - trigger soft delete pode ser removido'
    END as status;
