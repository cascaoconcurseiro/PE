-- ==============================================================================
-- MIGRATION: DEEP INTEGRITY CONSTRAINTS (2026-01-09)
-- DESCRIPTION: Enforces strict logical consistency on Transactions.
-- 1. Shared Transactions MUST have splits.
-- 2. Shared Splits SUM must match Transaction Amount (within 0.05 delta).
-- 3. Recurring Transactions MUST have frequency.
-- ==============================================================================

BEGIN;

-- 1. CONSTRAINT: RECURRING VALIDITY
-- ------------------------------------------------------------------------------
ALTER TABLE public.transactions 
DROP CONSTRAINT IF EXISTS chk_recurring_validity;

ALTER TABLE public.transactions 
ADD CONSTRAINT chk_recurring_validity 
CHECK (
    (is_recurring = false) OR 
    (is_recurring = true AND frequency IS NOT NULL)
);

-- 2. TRIGGER: SHARED TRANSACTION INTEGRITY
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_shared_transaction_integrity()
RETURNS TRIGGER AS $$
DECLARE
    split JSONB;
    total_assigned NUMERIC := 0;
    txn_amount NUMERIC;
BEGIN
    -- Only validate if it is marked as shared
    IF NEW.is_shared = true THEN
        
        -- Check 1: Must have splits array
        IF NEW.shared_with IS NULL OR jsonb_array_length(NEW.shared_with) = 0 THEN
            RAISE EXCEPTION 'integrity_error: shared_transaction_no_splits';
        END IF;

        -- Check 2: Sum of splits must match total amount
        -- We iterate over the JSONB array to sum 'assignedAmount'
        txn_amount := NEW.amount;
        
        FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            total_assigned := total_assigned + COALESCE((split->>'assignedAmount')::NUMERIC, 0);
        END LOOP;

        -- Allow 0.05 margin for rounding errors
        IF ABS(txn_amount - total_assigned) > 0.05 THEN
            RAISE EXCEPTION 'integrity_error: shared_split_sum_mismatch (Expected %, Got %)', txn_amount, total_assigned;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
DROP TRIGGER IF EXISTS trg_validate_shared_integrity ON public.transactions;

CREATE TRIGGER trg_validate_shared_integrity
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.validate_shared_transaction_integrity();


-- 3. FUNCTION: PURGE ORPHANED SPLITS (Maintenance)
-- ------------------------------------------------------------------------------
-- Can be called manually to clean bad data before applying constraints if needed.
-- Not applying automatically to avoid data loss without review.

-- 4. ADDITIONAL CHECKS
-- ------------------------------------------------------------------------------
-- Ensure 'original_amount' is set if installment
-- (Optional, strictness level: medium)

COMMIT;
