-- ==============================================================================
-- PHASE 5 - PLANO DE DROP CONTROLADO
-- DATA: 2026-01-24
-- OBJ: Remover lógica morta e marcar legado.
-- ==============================================================================

BEGIN;

-- 🔥 FASE 5.1 — REMOVER TRIGGERS (CONFIRMADO)
-- Já desativados anteriormente, agora removemos permanentemente.

DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trg_lock_shared_mirrors ON public.transactions;
DROP TRIGGER IF EXISTS trg_validate_shared_integrity ON public.transactions;
DROP TRIGGER IF EXISTS trg_sync_json_splits ON public.transactions;
DROP TRIGGER IF EXISTS trg_sync_trips_normalization ON public.trips;


-- 🟡 FASE 5.2 — FUNÇÕES ÓRFÃS (MAPPING)
-- Criamos uma view para facilitar a inspeção antes do Drop futuro.

CREATE OR REPLACE VIEW public.debug_orphan_functions AS
SELECT
  p.proname,
  p.oid::regprocedure
FROM pg_proc p
LEFT JOIN pg_trigger t ON t.tgfoid = p.oid
WHERE p.proname LIKE '%shared%'
  AND t.tgfoid IS NULL
  AND p.pronamespace = 'public'::regnamespace; -- Filter strictly for user functions


-- 🔵 FASE 5.3 — COLUNAS JSON (MARKING)
-- Identificar colunas JSON e marcar como Legacy via comentário no BD.

CREATE OR REPLACE VIEW public.debug_json_columns AS
SELECT table_name, column_name, data_type
FROM information_schema.columns
WHERE table_name = 'transactions'
  AND data_type = 'jsonb';

-- Aplicar marcação na coluna 'splits' se existir
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'splits'
    ) THEN
        COMMENT ON COLUMN public.transactions.splits IS 'LEGACY - READ ONLY (PHASE 5 MARKER)';
    END IF;
END $$;


-- 🟣 FASE 5.4 — TABELAS BACKUP
-- Remoção segura de tabelas de backup antigas explicitadas.

DROP TABLE IF EXISTS public.family_members_backup_20251213;
DROP TABLE IF EXISTS public.transactions_backup_20251213;

COMMIT;
