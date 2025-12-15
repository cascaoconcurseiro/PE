-- ==============================================================================
-- MIGRATION: FIX FAMILY BIDIRECTIONAL LINKING (2026-01-07)
-- DESCRIPTION: Ensures that when User A adds User B, User B also gets User A 
--              added to their family list automatically.
-- ==============================================================================

BEGIN;

-- 1. Create the Bridge Function
CREATE OR REPLACE FUNCTION public.ensure_reverse_family_member_link()
RETURNS TRIGGER AS $$
DECLARE
    v_initiator_name TEXT;
    v_target_user_email TEXT;
BEGIN
    -- Only proceed if we have a linked_user_id (The member is a real system user)
    IF NEW.linked_user_id IS NOT NULL THEN
        
        -- Check if the reverse link already exists
        -- (Does the Target User already have the Initiator in their family?)
        IF NOT EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE user_id = NEW.linked_user_id 
            AND linked_user_id = NEW.user_id
        ) THEN
            -- Get Initiator Name (User A's name) to label the new member row correctly
            SELECT name INTO v_initiator_name 
            FROM public.user_profiles 
            WHERE id = NEW.user_id;

            -- Fallback if profile name is missing
            IF v_initiator_name IS NULL THEN
                v_initiator_name := 'Novo Membro Familiar';
            END IF;

            -- Get Target Email (for record keeping in the member row)
            SELECT email INTO v_target_user_email
            FROM public.user_profiles
            WHERE id = NEW.linked_user_id;

             -- Create the Reverse Link (User B -> User A)
            INSERT INTO public.family_members (
                id,
                user_id,          -- Owner is the Target User (B)
                name,             -- Name is the Initiator's Name (A)
                role,             -- Default role
                email,            -- Initiator's Email (We don't have it easily here without query, let's look it up)
                linked_user_id,   -- Links back to Initiator (A)
                sync_status
            ) VALUES (
                gen_random_uuid(),
                NEW.linked_user_id,
                v_initiator_name,
                'Parceiro(a)',
                (SELECT email FROM public.user_profiles WHERE id = NEW.user_id), -- Initiator Email
                NEW.user_id,
                'SYNCED'
            );

            RAISE NOTICE 'Reverse family link created: User % -> User %', NEW.linked_user_id, NEW.user_id;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS trg_ensure_reverse_link ON public.family_members;
CREATE TRIGGER trg_ensure_reverse_link
    AFTER INSERT OR UPDATE OF linked_user_id ON public.family_members
    FOR EACH ROW EXECUTE FUNCTION public.ensure_reverse_family_member_link();

-- 3. Backfill (Fix existing broken links)
-- Forces a "touch" update on existing valid links to trigger the logic above
UPDATE public.family_members
SET updated_at = NOW()
WHERE linked_user_id IS NOT NULL;

COMMIT;
