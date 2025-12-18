-- ==============================================================================
-- MIGRATION: SHARED LIFECYCLE SAFETY (2026-01-12)
-- DESCRIPTION: 
-- 1. Protects Shared Trips from being deleted by the Owner if Invited Users have active contributions.
--    Reason: Prevents User A from wiping User B's history by deleting the container (Trip).
-- 2. Protects Family Members from being deleted if they are linked to active Shared Transactions.
--    Reason: Maintains integrity of "Shared With" participants.
-- ==============================================================================

BEGIN;

-- 1. TRIGGER: SAFE TRIP DELETION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_safe_trip_deletion()
RETURNS TRIGGER AS $$
DECLARE
    v_active_partners_count INTEGER;
BEGIN
    -- Only run check if we are Soft Deleting (setting deleted = true)
    IF (NEW.deleted = true AND OLD.deleted = false) THEN
        
        -- Check if there are other transactions in this trip NOT owned by the Trip Owner
        -- (Meaning: User A owns the Trip, but User B created an expense in it)
        PERFORM 1 FROM public.transactions 
        WHERE trip_id = NEW.id 
        AND user_id != NEW.user_id 
        AND deleted = false
        LIMIT 1;

        IF FOUND THEN
            RAISE EXCEPTION 'shared_integrity_error: cannot_delete_trip_with_partners_history';
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_safe_trip_delete ON public.trips;
CREATE TRIGGER trg_safe_trip_delete
    BEFORE UPDATE ON public.trips
    FOR EACH ROW EXECUTE FUNCTION public.check_safe_trip_deletion();


-- 2. TRIGGER: SAFE FAMILY MEMBER DELETION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_safe_family_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Only run check if we are Soft Deleting
    IF (NEW.deleted = true AND OLD.deleted = false) THEN
        
        -- Check if this member is part of any active Shared Transactions (splits)
        -- Logic: We check if any transaction has this family member in 'shared_with' (via JSONB or relational if migrated)
        -- Assuming 'transaction_splits' table exists from previous refactor, otherwise check JSONB
        
        -- Check relational table (Preferred if 20260102 migration applied)
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transaction_splits') THEN
            PERFORM 1 FROM public.transaction_splits ts
            JOIN public.transactions t ON t.id = ts.transaction_id
            WHERE ts.family_member_id = NEW.id
            AND t.deleted = false
            LIMIT 1;
            
            IF FOUND THEN
                 RAISE EXCEPTION 'shared_integrity_error: cannot_delete_member_with_active_shares';
            END IF;
        ELSE
            -- Fallback to JSONB check (legacy/hybrid)
            PERFORM 1 FROM public.transactions 
            WHERE shared_with @> jsonb_build_array(jsonb_build_object('participantId', NEW.id))
            AND deleted = false
            LIMIT 1;

            IF FOUND THEN
                 RAISE EXCEPTION 'shared_integrity_error: cannot_delete_member_with_active_shares';
            END IF;
        END IF;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_safe_family_delete ON public.family_members;
CREATE TRIGGER trg_safe_family_delete
    BEFORE UPDATE ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION public.check_safe_family_deletion();

COMMIT;
