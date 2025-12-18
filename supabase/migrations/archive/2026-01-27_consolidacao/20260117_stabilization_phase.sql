-- ==============================================================================
-- MIGRATION: STABILIZATION PHASE (ETAPA 1)
-- DATE: 2026-01-17
-- DESCRIPTION: Freezes critical behaviors to prevent data corruption and duplication.
--              Disables triggers for mirroring, balance updates, JSON sync, and notifications.
-- ==============================================================================

BEGIN;

-- 1. DISABLE MIRRORING & SHARED LOGIC (Transactions)
DO $$
BEGIN
    -- trg_mirror_shared_transaction
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_mirror_shared_transaction') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_mirror_shared_transaction;
        RAISE NOTICE 'Disabled trg_mirror_shared_transaction';
    END IF;

    -- trg_lock_shared_mirrors
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_lock_shared_mirrors') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_lock_shared_mirrors;
        RAISE NOTICE 'Disabled trg_lock_shared_mirrors';
    END IF;

    -- trg_validate_shared_integrity
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_validate_shared_integrity') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_validate_shared_integrity;
        RAISE NOTICE 'Disabled trg_validate_shared_integrity';
    END IF;

    -- trg_prevent_shared_duplication (Possible name variation)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_prevent_shared_duplication') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_prevent_shared_duplication;
        RAISE NOTICE 'Disabled trg_prevent_shared_duplication';
    END IF;
END $$;


-- 2. DISABLE BALANCE UPDATES (Transactions)
-- We disable the legacy trigger so only journal_entries (if active) or nothing updates balance.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_account_balance') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_update_account_balance;
        RAISE NOTICE 'Disabled trg_update_account_balance';
    END IF;
END $$;


-- 3. DISABLE JSON SYNC (Transactions, Trips, Assets)
DO $$
BEGIN
    -- trg_sync_json_splits (Transactions)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_json_splits') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_sync_json_splits;
        RAISE NOTICE 'Disabled trg_sync_json_splits';
    END IF;

    -- trg_sync_trips_normalization (Trips)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_trips_normalization') THEN
        ALTER TABLE public.trips DISABLE TRIGGER trg_sync_trips_normalization;
        RAISE NOTICE 'Disabled trg_sync_trips_normalization';
    END IF;

    -- trg_sync_assets_normalization (Assets)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_sync_assets_normalization') THEN
        ALTER TABLE public.assets DISABLE TRIGGER trg_sync_assets_normalization;
        RAISE NOTICE 'Disabled trg_sync_assets_normalization';
    END IF;
END $$;


-- 4. DISABLE NOTIFICATIONS & AUDIT NOISE
DO $$
BEGIN
    -- trg_shared_notification
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_shared_notification') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_shared_notification;
        RAISE NOTICE 'Disabled trg_shared_notification';
    END IF;

    -- trg_unified_shared_notification
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_unified_shared_notification') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trg_unified_shared_notification;
        RAISE NOTICE 'Disabled trg_unified_shared_notification';
    END IF;
    
    -- old naming: trig_notify_shared_tx
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trig_notify_shared_tx') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER trig_notify_shared_tx;
        RAISE NOTICE 'Disabled trig_notify_shared_tx';
    END IF;

    -- log_transaction_changes (Audit duplication)
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'log_transaction_changes') THEN
        ALTER TABLE public.transactions DISABLE TRIGGER log_transaction_changes;
        RAISE NOTICE 'Disabled log_transaction_changes';
    END IF;
END $$;


-- 5. MARK SYSTEM AS FROZEN
COMMENT ON DATABASE postgres IS 'ETAPA 1 ATIVA — Sistema financeiro com comportamentos críticos congelados para refatoração estrutural.';

COMMIT;
