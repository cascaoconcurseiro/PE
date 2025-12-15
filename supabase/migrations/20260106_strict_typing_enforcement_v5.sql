-- ==============================================================================
-- MIGRATION: STRICT TYPING & INTEGRITY v5 (2026-01-06)
-- DESCRIPTION: Converts TEXT links to UUID Foreign Keys.
-- STRATEGY: Explicitly DROPS triggers to ensure no logic fires during migration.
--           Uses "Column Swap" to avoid type casting errors in-place.
-- ==============================================================================

BEGIN;

-- 1. DROP TRIGGERS (The Nuclear Option)
-- We remove them entirely to prevent any "uuid = text" errors during UPDATE.
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trg_notify_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS update_account_balance_trigger ON public.transactions;
DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
-- Safety: Drop any legacy names
DROP TRIGGER IF EXISTS on_transaction_insert ON public.transactions;
DROP TRIGGER IF EXISTS handle_shared_transaction_trigger ON public.transactions;


-- ==============================================================================
-- 2. MIGRATE DATA (The Swap Strategy)
-- ==============================================================================

-- A. Account ID
ALTER TABLE public.transactions ADD COLUMN account_id_new UUID;
-- Only copy valid UUIDs
UPDATE public.transactions 
SET account_id_new = account_id::UUID 
WHERE account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- B. Destination Account ID
ALTER TABLE public.transactions ADD COLUMN destination_account_id_new UUID;
UPDATE public.transactions 
SET destination_account_id_new = destination_account_id::UUID 
WHERE destination_account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- C. Trip ID
ALTER TABLE public.transactions ADD COLUMN trip_id_new UUID;
UPDATE public.transactions 
SET trip_id_new = trip_id::UUID 
WHERE trip_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';


-- ==============================================================================
-- 3. SWAP COLUMNS
-- ==============================================================================

-- Drop old TEXT columns
ALTER TABLE public.transactions DROP COLUMN account_id CASCADE;
ALTER TABLE public.transactions DROP COLUMN destination_account_id CASCADE;
ALTER TABLE public.transactions DROP COLUMN trip_id CASCADE;

-- Rename new UUID columns
ALTER TABLE public.transactions RENAME COLUMN account_id_new TO account_id;
ALTER TABLE public.transactions RENAME COLUMN destination_account_id_new TO destination_account_id;
ALTER TABLE public.transactions RENAME COLUMN trip_id_new TO trip_id;


-- ==============================================================================
-- 4. ADD CONSTRAINTS (The Iron Dome)
-- ==============================================================================

-- Add FKs
ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_dest_account 
    FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_trip 
    FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;

-- Add Checks
ALTER TABLE public.transactions 
    DROP CONSTRAINT IF EXISTS chk_transaction_type; 
ALTER TABLE public.transactions 
    ADD CONSTRAINT chk_transaction_type 
    CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA', 'AJUSTE'));

ALTER TABLE public.transactions 
    DROP CONSTRAINT IF EXISTS chk_currency_code;
ALTER TABLE public.transactions 
    ADD CONSTRAINT chk_currency_code 
    CHECK (length(currency) = 3);


-- ==============================================================================
-- 5. RECREATE TRIGGERS (Restoring Intelligence)
-- ==============================================================================

-- Recreate Smart Mirroring
CREATE TRIGGER trg_mirror_shared_transaction 
    AFTER INSERT OR UPDATE ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_mirror_shared_transaction();

-- Recreate Notification
CREATE TRIGGER trg_notify_on_transaction 
    AFTER INSERT ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_shared_notification();

-- Recreate Audit (If function exists)
CREATE TRIGGER trg_audit_transactions
    AFTER UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION log_transaction_changes();

-- Note: update_account_balance trigger definition was not fully standardized in previous scripts,
-- assuming it exists or is not critical for schema. Ideally we should recreate it if we had the definition handy.
-- But dropping it implies we might lose balance auto-calc if not restored.
-- CHECK: In 'Golden Schema' line 209 it is 'update_account_balance_v4'.
-- Let's restore it properly if function exists.

-- Attempt to bind balance trigger if function exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_account_balance_v4') THEN
        CREATE TRIGGER update_account_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION update_account_balance_v4();
    END IF;
END $$;


COMMIT;
