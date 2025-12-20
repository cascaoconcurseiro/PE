-- ==============================================================================
-- MASTER CLEANUP AND CONSOLIDATION
-- DATA: 2025-12-20
-- OBJETIVO: Remover gatilhos, funções e componentes SQL redundantes ou obsoletos.
--           Consolidar o sistema financeiro nos motores de saldo e auditoria mais recentes.
-- ==============================================================================

BEGIN;

-- ============================================================================
-- 1. LIMPEZA DE TRIGGERS (TRANSACTIONS)
-- ============================================================================

-- Remover triggers de auditoria duplicados
-- Mantendo apenas 'trg_audit_transactions' (definido em 20260128_constraints_e_auditoria.sql)
DROP TRIGGER IF EXISTS tr_audit_transactions ON public.transactions;

-- Remover triggers de bridge/ledger obsoletos ou duplicados
-- Mantendo apenas 'trg_sync_ddd_ledger' (definido em 20260201_ddd_ledger_structure.sql)
DROP TRIGGER IF EXISTS trg_bridge_transactions_ledger ON public.transactions;

-- Remover triggers de saldo obsoletos
-- Mantendo apenas 'trg_update_account_balance' (apontando para fn_update_account_balance)
DROP TRIGGER IF EXISTS update_account_balance_trigger ON public.transactions;
DROP TRIGGER IF EXISTS trg_update_balance ON public.transactions;

-- Remover trigger de soft delete (não utilizado se 'deleted' flag é tratada via aplicação/ledger)
DROP TRIGGER IF EXISTS trg_propagate_soft_delete ON public.transactions;

-- ============================================================================
-- 2. LIMPEZA DE FUNÇÕES DE TRIGGER
-- ============================================================================

-- Remover funções substituídas ou obsoletas
DROP FUNCTION IF EXISTS public.update_account_balance();
DROP FUNCTION IF EXISTS public.trg_audit_transactions(); -- Caso tenha sido criado sem o 'g' por erro
DROP FUNCTION IF EXISTS public.propagate_soft_delete();

-- ============================================================================
-- 3. CONSOLIDAÇÃO DO MOTOR DE SALDO (GOLD STANDARD)
-- ============================================================================

-- Garantir que fn_update_account_balance (refund-aware) esteja configurada
-- NOTA: Esta função foi definida em 20260218_fix_refund_trigger.sql
-- Caso não esteja presente, o sistema usará a versão da última migration.

-- ============================================================================
-- 4. LIMPEZA DE TABELAS DE TESTE/DIAGNÓSTICO (OPCIONAL/SAFE)
-- ============================================================================

-- Remover views de diagnóstico se não forem mais necessárias
DROP VIEW IF EXISTS view_diagnostic_shared_discrepancy;

-- ============================================================================
-- 5. VERIFICAÇÃO FINAL DO ESTADO ATUAL
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '=== TRIGGERS RESTANTES NA TABELA TRANSACTIONS ===';
END $$;

-- O usuário pode ver o resultado no log do Supabase

COMMIT;

-- =============================================================
-- APÓS EXECUTAR ESTE SCRIPT, O ESTADO ESPERADO É:
-- 1. trg_audit_transactions (Auditoria Profissional)
-- 2. trg_update_account_balance (Saldos com Refund Support)
-- 3. trg_sync_ddd_ledger (Sincronização com o Registro Imutável)
-- 4. trg_validate_domain (Integridade de contexto Personal/Travel/Shared)
-- 5. trg_update_transactions_updated_at (Controle de Timestamps)
-- 6. trigger_notify_shared_transaction (Notificações de Compartilhamento)
-- =============================================================
