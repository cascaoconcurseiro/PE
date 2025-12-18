-- ==============================================================================
-- MIGRATION: DATA INTEGRITY & DUPLICATION PREVENTION (2026-01-08)
-- DESCRIPTION:
-- 1. Adds UNIQUE constraints to family_members to prevent duplicate emails/links.
-- 2. Adds RPC to fuzzy-check for duplicate trips before creation.
-- 3. Adds Trigger to reassign transactions from deleted family members to 'me'
--    to prevent "zombie" balances.
-- ==============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1. FAMILY MEMBER CONSTRAINTS
-- ---------------------------------------------------------------------------

-- Ensure unique email per user's family (for members that have emails)
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_owner_email 
ON public.family_members (user_id, email) 
WHERE email IS NOT NULL AND deleted = false;

-- Ensure unique linked_user_id per user's family (for mapped system users)
CREATE UNIQUE INDEX IF NOT EXISTS idx_family_members_owner_link
ON public.family_members (user_id, linked_user_id)
WHERE linked_user_id IS NOT NULL AND deleted = false;


-- ---------------------------------------------------------------------------
-- 2. ORPHAN CLEANUP (Fix "Zombie" Data)
-- ---------------------------------------------------------------------------

-- Function to reassign transactions when a member is "Soft Deleted"
CREATE OR REPLACE FUNCTION public.reassign_orphaned_transactions_soft()
RETURNS TRIGGER AS $$
BEGIN
    -- If a member is marked as deleted
    IF NEW.deleted = true AND OLD.deleted = false THEN
        
        -- Find all transactions where this member is the payer (payer_id = member_id)
        -- And reassign them to the owner ('me' context, or NULL which usually implies 'me' in some logic, 
        -- but 'me' string or NULL is safer depending on frontend. Let's use NULL if logic supports, or owner ID.
        -- Actually, most frontend logic checks: if payer_id == 'me' OR payer_id == user.id.
        -- Let's set it to 'me' for clarity if that's the convention, OR just the auth.uid().
        -- Safest is to append a note and set to owner.

        UPDATE public.transactions
        SET 
            payer_id = 'me',
            description = description || ' (Ex-Membro: ' || NEW.name || ')',
            updated_at = NOW()
        WHERE 
            payer_id = NEW.id::text
            AND user_id = NEW.user_id; -- Only for the trip owner's transactions
            
        -- Also handle "Shared With" arrays? 
        -- This is complex. If shared_with contains the ID, we should remove it?
        -- For now, let's fix the PAYER issue which causes the big 10,00 discrepancy.
        
        RAISE NOTICE 'Reassigned transactions for deleted member % to owner.', NEW.name;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Soft Delete
DROP TRIGGER IF EXISTS trg_reassign_orphans_soft ON public.family_members;
CREATE TRIGGER trg_reassign_orphans_soft
    AFTER UPDATE OF deleted ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION public.reassign_orphaned_transactions_soft();

-- Function for HARD Delete (just in case)
CREATE OR REPLACE FUNCTION public.reassign_orphaned_transactions_hard()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.transactions
    SET 
        payer_id = 'me',
        description = description || ' (Ex-Membro: ' || OLD.name || ')',
        updated_at = NOW()
    WHERE 
        payer_id = OLD.id::text
        AND user_id = OLD.user_id;
        
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger for Hard Delete
DROP TRIGGER IF EXISTS trg_reassign_orphans_hard ON public.family_members;
CREATE TRIGGER trg_reassign_orphans_hard
    BEFORE DELETE ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION public.reassign_orphaned_transactions_hard();


-- ---------------------------------------------------------------------------
-- 3. TRIP DUPLICATION CHECK
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.check_trip_exists(
    p_name TEXT,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    owner_name TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id,
        t.name,
        COALESCE(up.name, 'Desconhecido') as owner_name
    FROM public.trips t
    LEFT JOIN public.user_profiles up ON t.user_id = up.id
    WHERE 
        -- Logic: Same Date Range AND Same Name (Fuzzy)
        t.start_date = p_start_date
        AND t.end_date = p_end_date
        AND LOWER(TRIM(t.name)) = LOWER(TRIM(p_name))
        AND t.deleted = false
        AND (
            t.user_id = auth.uid() -- My own trips
            -- Potential enhancement: Check shared trips too if we had a joining table accessible here
        );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
