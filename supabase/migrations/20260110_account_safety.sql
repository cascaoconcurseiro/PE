-- ==============================================================================
-- MIGRATION: ACCOUNT SAFETY & HARDENING (2026-01-10)
-- DESCRIPTION: 
-- 1. Prevents users from changing an Account's Currency if it has transactions.
--    Reason: Prevents math corruption of historical data.
-- 2. Prevents HARD DELETE of accounts if they have transactions (ON DELETE RESTRICT).
--    Reason: Prevents accidental catastrophic loss of financial history.
--            Users must Soft Delete (deleted=true) instead.
-- ==============================================================================

BEGIN;

-- 1. TRIGGER: PREVENT CURRENCY CHANGE
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_account_currency_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Only check if currency column is changing
    IF NEW.currency IS DISTINCT FROM OLD.currency THEN
        -- Check if any non-deleted transactions exist for this account
        IF EXISTS (
            SELECT 1 FROM public.transactions 
            WHERE account_id = NEW.id 
            AND deleted = false 
            LIMIT 1
        ) THEN
            RAISE EXCEPTION 'integrity_error: cannot_change_currency_with_transactions';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prevent_currency_change ON public.accounts;

CREATE TRIGGER trg_prevent_currency_change
    BEFORE UPDATE ON public.accounts
    FOR EACH ROW EXECUTE FUNCTION public.check_account_currency_lock();


-- 2. CONSTRAINT: PREVENT ACCIDENTAL HARD DELETE (Safety Net)
-- ------------------------------------------------------------------------------
-- We change the Foreign Key from CASCADE (Dangerous) to RESTRICT (Safe).
-- This forces the frontend to use "Soft Delete" (UPDATE set deleted=true).

ALTER TABLE public.transactions 
    DROP CONSTRAINT IF EXISTS fk_transactions_account;

ALTER TABLE public.transactions 
    ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) 
    ON DELETE RESTRICT; -- Should be RESTRICT to block, or NO ACTION.


COMMIT;
