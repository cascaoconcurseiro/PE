-- ==============================================================================
-- MIGRATION: STRICT TYPING & INTEGRITY v6 (2026-01-06)
-- DESCRIPTION: Converts TEXT links to UUID Foreign Keys.
-- FIX: Defines 'log_transaction_changes' function explicitly.
-- ==============================================================================

BEGIN;

-- 1. DROP TRIGGERS (The Nuclear Option)
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trg_notify_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS update_account_balance_trigger ON public.transactions;
DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_insert ON public.transactions;
DROP TRIGGER IF EXISTS handle_shared_transaction_trigger ON public.transactions;


-- ==============================================================================
-- 2. MIGRATE DATA (The Swap Strategy)
-- ==============================================================================

-- A. Account ID
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS account_id_new UUID;
UPDATE public.transactions 
SET account_id_new = account_id::UUID 
WHERE account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- B. Destination Account ID
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS destination_account_id_new UUID;
UPDATE public.transactions 
SET destination_account_id_new = destination_account_id::UUID 
WHERE destination_account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- C. Trip ID
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS trip_id_new UUID;
UPDATE public.transactions 
SET trip_id_new = trip_id::UUID 
WHERE trip_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';


-- ==============================================================================
-- 3. SWAP COLUMNS
-- ==============================================================================

-- Drop old TEXT columns (Check if they exist first to make script idempotent-ish)
DO $$
BEGIN
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'account_id' AND data_type = 'text') THEN
        ALTER TABLE public.transactions DROP COLUMN account_id CASCADE;
        ALTER TABLE public.transactions RENAME COLUMN account_id_new TO account_id;
    END IF;
    
    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'destination_account_id' AND data_type = 'text') THEN
        ALTER TABLE public.transactions DROP COLUMN destination_account_id CASCADE;
        ALTER TABLE public.transactions RENAME COLUMN destination_account_id_new TO destination_account_id;
    END IF;

    IF EXISTS(SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'trip_id' AND data_type = 'text') THEN
        ALTER TABLE public.transactions DROP COLUMN trip_id CASCADE;
        ALTER TABLE public.transactions RENAME COLUMN trip_id_new TO trip_id;
    END IF;
END $$;


-- ==============================================================================
-- 4. ADD CONSTRAINTS (The Iron Dome)
-- ==============================================================================

-- Add FKs (Drop first to allow re-run)
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_dest_account 
    FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_trip;
ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_trip 
    FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;

-- Add Checks
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS chk_transaction_type; 
ALTER TABLE public.transactions 
    ADD CONSTRAINT chk_transaction_type 
    CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA', 'AJUSTE'));

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS chk_currency_code;
ALTER TABLE public.transactions 
    ADD CONSTRAINT chk_currency_code 
    CHECK (length(currency) = 3);


-- ==============================================================================
-- 5. DEFINE FUNCTIONS (Context for Triggers)
-- ==============================================================================

CREATE OR REPLACE FUNCTION log_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        IF (NEW.amount IS DISTINCT FROM OLD.amount) OR (NEW.date IS DISTINCT FROM OLD.date) THEN
            INSERT INTO public.system_audit_logs (table_name, record_id, operation, old_data, new_data, changed_by)
            VALUES (
                'transactions', 
                OLD.id, 
                'UPDATE', 
                jsonb_build_object('amount', OLD.amount, 'date', OLD.date),
                jsonb_build_object('amount', NEW.amount, 'date', NEW.date),
                auth.uid()
            );
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        INSERT INTO public.system_audit_logs (table_name, record_id, operation, old_data, changed_by)
        VALUES (
            'transactions', 
            OLD.id, 
            'DELETE', 
            to_jsonb(OLD),
            auth.uid()
        );
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ==============================================================================
-- 6. RECREATE TRIGGERS (Restoring Intelligence)
-- ==============================================================================

CREATE TRIGGER trg_mirror_shared_transaction 
    AFTER INSERT OR UPDATE ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_mirror_shared_transaction();

CREATE TRIGGER trg_notify_on_transaction 
    AFTER INSERT ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_shared_notification();

CREATE TRIGGER trg_audit_transactions
    AFTER UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION log_transaction_changes();

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_account_balance_v4') THEN
        CREATE TRIGGER update_account_balance_trigger
        AFTER INSERT OR UPDATE OR DELETE ON public.transactions
        FOR EACH ROW EXECUTE FUNCTION update_account_balance_v4();
    END IF;
END $$;


COMMIT;
