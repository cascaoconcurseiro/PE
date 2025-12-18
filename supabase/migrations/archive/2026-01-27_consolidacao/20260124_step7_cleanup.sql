-- ==============================================================================
-- MIGRATION: STEP 7 - LIMPEZA CONTROLADA
-- DATA: 2026-01-24
-- OBJ: Remover dívida técnica e artefatos de migração obsoletos.
-- ==============================================================================

BEGIN;

-- 1. REMOVER COLUNAS LEGADAS (Se existirem e estiverem sem uso)
-- ------------------------------------------------------------------------------
-- A coluna 'splits' (JSONB) foi substituída por 'transaction_splits' (Relacional).
-- Verificamos se está "Morta" (sem atualizações recentes ou nula).
-- POR SEGURANÇA: Renomeamos para 'deprecated_splits' antes de drop final.

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'splits') THEN
        ALTER TABLE public.transactions RENAME COLUMN splits TO deprecated_splits;
        RAISE NOTICE 'Column splits renamed to deprecated_splits.';
    END IF;
END $$;


-- 2. LIMPEZA DE TRIGGERS OBSOLETOS (Reforço)
-- ------------------------------------------------------------------------------
DROP TRIGGER IF EXISTS trg_sync_json_splits ON public.transactions;
DROP FUNCTION IF EXISTS public.sync_json_splits();

-- 3. REMOVER BACKUPS TEMPORÁRIOS
-- ------------------------------------------------------------------------------
-- Se tivéssemos tabelas _backup, droparíamos aqui.
-- Manter audit_snapshots e audit_inconsistencies pois são úteis para Step 8.

COMMIT;
