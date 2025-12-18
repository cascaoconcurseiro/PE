-- ==============================================================================
-- MIGRATION: STRICT TYPING & INTEGRITY v3 (2026-01-06)
-- DESCRIPTION: Converts TEXT links to UUID Foreign Keys.
-- FIX 1: Disables triggers during update.
-- FIX 2: Removes 'RAISE NOTICE' which caused syntax errors in plain SQL.
-- ==============================================================================

BEGIN;

-- 1. DISABLE TRIGGERS (Safety Mode)
ALTER TABLE public.transactions DISABLE TRIGGER ALL;

-- ==============================================================================
-- 2. SANITIZE DATA (Prepare for Casting)
-- ==============================================================================
-- Sanitizing textual garbage...

-- Clean empty strings or invalid UUIDs in account_id
UPDATE public.transactions 
SET account_id = NULL 
WHERE account_id IS NULL OR account_id = '' OR account_id = 'undefined' OR length(account_id) < 30;

-- Clean empty strings or invalid UUIDs in destination_account_id
UPDATE public.transactions 
SET destination_account_id = NULL 
WHERE destination_account_id IS NULL OR destination_account_id = '' OR destination_account_id = 'undefined' OR length(destination_account_id) < 30;

-- Clean empty strings or invalid UUIDs in trip_id
UPDATE public.transactions 
SET trip_id = NULL 
WHERE trip_id IS NULL OR trip_id = '' OR trip_id = 'undefined' OR length(trip_id) < 30;

-- Clean invalid Orphans (IDs that point to non-existent accounts)
UPDATE public.transactions t
SET account_id = NULL
WHERE t.account_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id::text = t.account_id);

UPDATE public.transactions t
SET destination_account_id = NULL
WHERE t.destination_account_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.accounts a WHERE a.id::text = t.destination_account_id);

UPDATE public.transactions t
SET trip_id = NULL
WHERE t.trip_id IS NOT NULL 
AND NOT EXISTS (SELECT 1 FROM public.trips tr WHERE tr.id::text = t.trip_id);


-- ==============================================================================
-- 3. APPLY STRICT TYPES ( The "Iron Dome" )
-- ==============================================================================
-- Converting columns to UUID...

-- A. Account ID
ALTER TABLE public.transactions 
    ALTER COLUMN account_id TYPE UUID USING account_id::UUID,
    ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;

-- B. Destination Account ID
ALTER TABLE public.transactions 
    ALTER COLUMN destination_account_id TYPE UUID USING destination_account_id::UUID,
    ADD CONSTRAINT fk_transactions_dest_account 
    FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- C. Trip ID
ALTER TABLE public.transactions 
    ALTER COLUMN trip_id TYPE UUID USING trip_id::UUID,
    ADD CONSTRAINT fk_transactions_trip 
    FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;


-- ==============================================================================
-- 4. APPLY DATA INTEGRITY CHECKS
-- ==============================================================================

-- Ensure Transaction Types are Standardized
ALTER TABLE public.transactions 
    DROP CONSTRAINT IF EXISTS chk_transaction_type; 
ALTER TABLE public.transactions 
    ADD CONSTRAINT chk_transaction_type 
    CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA', 'AJUSTE'));

-- Ensure Currency is standard 3-char code
ALTER TABLE public.transactions 
    DROP CONSTRAINT IF EXISTS chk_currency_code;
ALTER TABLE public.transactions 
    ADD CONSTRAINT chk_currency_code 
    CHECK (length(currency) = 3);

-- Date Sanity
ALTER TABLE public.transactions
    DROP CONSTRAINT IF EXISTS chk_date_sanity;
ALTER TABLE public.transactions
    ADD CONSTRAINT chk_date_sanity
    CHECK (date > '2000-01-01' AND date < '2100-01-01');


-- ==============================================================================
-- 5. NEW MODULE: AUDIT LOGS (Who changed what?)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.system_audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    table_name TEXT NOT NULL,
    record_id UUID NOT NULL,
    operation TEXT NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    old_data JSONB,
    new_data JSONB,
    changed_by UUID REFERENCES auth.users(id),
    changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Trigger to Log Critical Financial Changes
CREATE OR REPLACE FUNCTION log_transaction_changes()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'UPDATE') THEN
        -- Only log if Amount or Date changes (Fraud detection / Mistake tracking)
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

DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
CREATE TRIGGER trg_audit_transactions
    AFTER UPDATE OR DELETE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION log_transaction_changes();


-- 6. RE-ENABLE TRIGGERS
ALTER TABLE public.transactions ENABLE TRIGGER ALL;

COMMIT;
