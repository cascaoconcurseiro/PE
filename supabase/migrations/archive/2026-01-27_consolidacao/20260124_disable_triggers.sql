-- ==============================================================================
-- URGENT: DISABLE LEGACY TRIGGERS (FIXED)
-- DATA: 2026-01-24
-- OBJ: Parar duplicação e efeitos colaterais IMEDIATAMENTE.
-- ==============================================================================

DO $$
BEGIN
    -- 🔥 DESATIVAR IMEDIATAMENTE (ALTO RISCO)
    
    -- Shared / Mirroring Triggers
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mirror_shared_transaction') THEN
        DROP TRIGGER trg_mirror_shared_transaction ON public.transactions;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lock_shared_mirrors') THEN
        DROP TRIGGER trg_lock_shared_mirrors ON public.transactions;
    END IF;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_shared_integrity') THEN
        DROP TRIGGER trg_validate_shared_integrity ON public.transactions;
    END IF;

    -- Legacy Sync (JSON Splits)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_json_splits') THEN
        DROP TRIGGER trg_sync_json_splits ON public.transactions;
    END IF;
    
    -- Trip Sync
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_trips_normalization') THEN
        DROP TRIGGER trg_sync_trips_normalization ON public.trips;
    END IF;

    -- 🟡 DESATIVAR SALDO DERIVADO (Legacy)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_account_balance') THEN
        DROP TRIGGER trg_update_account_balance ON public.transactions;
    END IF;

    RAISE NOTICE 'Critical legacy triggers disabled.';
END $$;
