-- ==============================================================================
-- FINAL FIX: AUTO-CORRECT DOMAIN IN TRIGGER (NO MORE EXCEPTIONS)
-- DATE: 2026-01-24
-- OBJ: Change the domain validation trigger to AUTO-CORRECT instead of REJECT.
--      This protects ALL code paths (RPC and direct upsert).
-- ==============================================================================

BEGIN;

-- 1. REPLACE THE TRIGGER FUNCTION WITH AUTO-CORRECT LOGIC
-- ============================================================================
CREATE OR REPLACE FUNCTION public.validate_domain_consistency()
RETURNS TRIGGER AS $$
BEGIN
    -- AUTO-CORRECT #1: If has trip_id, FORCE domain = 'TRAVEL'
    IF (NEW.trip_id IS NOT NULL) THEN
        NEW.domain := 'TRAVEL';
    -- AUTO-CORRECT #2: If is_shared = true (no trip), FORCE domain = 'SHARED'
    ELSIF (NEW.is_shared = TRUE AND (NEW.trip_id IS NULL)) THEN
        NEW.domain := 'SHARED';
    -- AUTO-CORRECT #3: If domain is NULL or empty, default to 'PERSONAL'
    ELSIF (NEW.domain IS NULL OR NEW.domain = '') THEN
        NEW.domain := 'PERSONAL';
    END IF;
    
    -- FINAL CHECK: Ensure domain is within allowed values (fallback safety)
    IF NEW.domain NOT IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS') THEN
        NEW.domain := 'PERSONAL';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. ENSURE THE TRIGGER EXISTS
-- ============================================================================
DROP TRIGGER IF EXISTS trg_validate_domain ON public.transactions;
CREATE TRIGGER trg_validate_domain
    BEFORE INSERT OR UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.validate_domain_consistency();

-- 3. FIX HISTORICAL DATA (Run after trigger update)
-- ============================================================================
UPDATE public.transactions
SET domain = CASE 
    WHEN trip_id IS NOT NULL THEN 'TRAVEL'
    WHEN is_shared = TRUE THEN 'SHARED'
    WHEN domain IS NULL OR domain = '' THEN 'PERSONAL'
    ELSE domain
END
WHERE domain IS NULL 
   OR domain = ''
   OR (trip_id IS NOT NULL AND domain != 'TRAVEL')
   OR (is_shared = TRUE AND trip_id IS NULL AND domain NOT IN ('SHARED', 'TRAVEL'));

COMMIT;
