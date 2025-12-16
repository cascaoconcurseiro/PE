-- ==============================================================================
-- MIGRATION: STEP 4 - REPLAY CONTROLADO DO LEDGER
-- DATA: 2026-01-24
-- OBJ: Recalcular Ledger do zero e validar contra snapshot auditoria.
-- ==============================================================================

BEGIN;

-- 1. LIMPEZA CONTROLADA (Reset Ledger)
-- ------------------------------------------------------------------------------
-- Desativa proteção de imutabilidade temporariamente
ALTER TABLE public.journal_entries DISABLE TRIGGER trg_protect_ledger;

-- Limpa lançamentos
DELETE FROM public.journal_entries;

-- Zera contas do razão (Mantendo IDs para integridade de links, se houver)
UPDATE public.ledger_accounts SET balance = 0;

-- 2. REPLAY (Recalculo via Trigger Bridge)
-- ------------------------------------------------------------------------------
-- Forçamos um UPDATE dummy em todas as transações ativas para disparar o trigger
-- 'process_transaction_into_ledger', que vai recriar as journal_entries.

DO $$
BEGIN
    RAISE NOTICE 'Starting Ledger Replay...';
    
    -- Dispara trigger row-by-row
    UPDATE public.transactions 
    SET updated_at = updated_at 
    WHERE deleted = FALSE;
    
    RAISE NOTICE 'Ledger Replay Completed.';
END $$;

-- Reativa proteção
ALTER TABLE public.journal_entries ENABLE TRIGGER trg_protect_ledger;


-- 3. VALIDAÇÃO (Snapshot Pós-Replay)
-- ------------------------------------------------------------------------------
-- Captura novo estado
SELECT public.capture_snapshot_zero(); -- Snapshot 2

-- Update types for clarity
UPDATE public.audit_snapshots 
SET snapshot_type = 'POST-REPLAY' 
WHERE id = (SELECT id FROM public.audit_snapshots ORDER BY snapshot_date DESC LIMIT 1);


-- 4. RELATÓRIO DE DIVERGÊNCIA
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_replay_integrity()
RETURNS TABLE (account_id TEXT, legacy_calc NUMERIC, new_ledger NUMERIC, diff NUMERIC) AS $$
BEGIN
    RETURN QUERY
    WITH latest_snap AS (
        SELECT details 
        FROM public.audit_snapshots 
        WHERE snapshot_type = 'POST-REPLAY' 
        ORDER BY snapshot_date DESC LIMIT 1
    )
    SELECT 
        (item->>'account_id')::text,
        (item->>'legacy_calc')::numeric,
        (item->>'ledger_stored')::numeric,
        (item->>'diff')::numeric
    FROM latest_snap, jsonb_array_elements(details) as item
    WHERE (item->>'diff')::numeric != 0;
END;
$$ LANGUAGE plpgsql;

-- Executa verificação (Se retornar vazio, SUCESSO)
SELECT * FROM public.check_replay_integrity();

COMMIT;
