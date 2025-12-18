-- ==============================================================================
-- MIGRATION: SMART MIRRORING (2026-01-03)
-- DESCRIPTION: Adds 'source_transaction_id' and enables UPDATE propagation.
-- ==============================================================================

BEGIN;

-- 1. ADD COLUMN
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_source_id ON public.transactions(source_transaction_id);


-- 2. BACKFILL (Heuristic Matching for existing data)
-- Tries to find the "Mother" transaction for existing "Child" transactions.
DO $$
DECLARE
    updated_count INT;
BEGIN
    RAISE NOTICE 'Starting Backfill of source_transaction_id...';
    
    WITH matched_pairs AS (
        SELECT 
            child.id as child_id,
            parent.id as parent_id
        FROM transactions child
        JOIN transactions parent ON 
            child.date = parent.date 
            AND child.amount = (parent.shared_with->0->>'assignedAmount')::numeric -- Simple assumption: 1st split matches amount logic logic roughly
            -- Only look for mirrors created by the system
            AND child.description LIKE parent.description || '%'
            AND child.is_shared = true
            AND child.payer_id = parent.user_id::text
        WHERE 
            child.source_transaction_id IS NULL
            AND parent.is_shared = true
            -- Sanity check: ensure they are not the same
            AND child.id <> parent.id
    )
    UPDATE transactions
    SET source_transaction_id = matched_pairs.parent_id
    FROM matched_pairs
    WHERE transactions.id = matched_pairs.child_id;

    GET DIAGNOSTICS updated_count = ROW_COUNT;
    RAISE NOTICE 'Backfilled % transactions.', updated_count;
END $$;


-- 3. UPGRADE TRIGGER (The "Smart" Logic)
CREATE OR REPLACE FUNCTION public.handle_mirror_shared_transaction()
RETURNS TRIGGER AS $func$
DECLARE
    split JSONB;
    target_member_id UUID;
    target_user_id UUID;
    target_trip_id UUID; 
    inviter_name TEXT;
    original_trip_rec RECORD;
BEGIN
    -- =========================================================================
    -- PATH A: INSERT (CREATE MIRRORS)
    -- =========================================================================
    IF (TG_OP = 'INSERT') AND (auth.uid() = NEW.user_id) AND (NEW.is_shared = true) AND (NEW.shared_with IS NOT NULL) AND (jsonb_array_length(NEW.shared_with) > 0) THEN
        
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = auth.uid();
        
        FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            -- Resolve Target User
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM public.family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                -- Resolve Trip Link (Mirror Logic)
                target_trip_id := NULL;
                IF NEW.trip_id IS NOT NULL THEN
                   -- (Trip Sync Logic omitted for brevity, assuming trip sync exists or trip_id is sufficient)
                   -- Keeping it simple: verify compatibility or strict trip link logic from previous versions
                   -- For now, just copy trip_id if it's external? No, complex. 
                   -- Let's stick to the previous robust trip lookup:
                   SELECT id INTO target_trip_id FROM trips 
                   WHERE source_trip_id::text = NEW.trip_id::text AND user_id = target_user_id;

                   -- Lazy Auto-Create Trip if missing
                   IF target_trip_id IS NULL THEN
                       SELECT * INTO original_trip_rec FROM trips WHERE id::text = NEW.trip_id::text;
                       IF original_trip_rec.id IS NOT NULL THEN
                            INSERT INTO trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                            ) VALUES (
                                target_user_id, 
                                original_trip_rec.name, 
                                original_trip_rec.start_date, 
                                original_trip_rec.end_date, 
                                0, -- Budget 0 for mirror
                                original_trip_rec.image_url, 
                                original_trip_rec.id, 
                                original_trip_rec.participants, 
                                NOW(), NOW()
                            ) RETURNING id INTO target_trip_id;
                       END IF;
                   END IF;
                END IF;

                -- INSERT THE MIRROR
                INSERT INTO public.transactions (
                    user_id, 
                    source_transaction_id, -- ✅ LINK THE SOURCE!
                    amount, 
                    date, 
                    description, 
                    category, 
                    type, 
                    is_shared, 
                    payer_id, 
                    shared_with, 
                    trip_id, 
                    created_at, 
                    updated_at
                ) VALUES (
                    target_user_id, 
                    NEW.id, -- ✅ This is the magic link
                    (split->>'assignedAmount')::NUMERIC, 
                    NEW.date, 
                    NEW.description || ' (Compartilhado por ' || COALESCE(inviter_name, 'Alguém') || ')',
                    NEW.category, 
                    'DESPESA', 
                    true, 
                    auth.uid()::text, 
                    '[]'::jsonb, 
                    target_trip_id,
                    NOW(), 
                    NOW()
                );
            END IF;
        END LOOP;
        RETURN NEW;
    
    -- =========================================================================
    -- PATH B: UPDATE (PROPAGATE CHANGES)
    -- =========================================================================
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Only proceed if vital fields changed
        IF (NEW.description IS DISTINCT FROM OLD.description) OR
           (NEW.date IS DISTINCT FROM OLD.date) OR
           (NEW.category IS DISTINCT FROM OLD.category) OR
           (NEW.shared_with IS DISTINCT FROM OLD.shared_with) THEN
            
            -- Update all children (Mirrors)
            -- Note: We assume the structure of shared_with didn't change drastically (participants didn't change).
            -- If participants changed, it's complex (delete/add). 
            -- For MVP Smart Mirroring: Propagate Date/Desc/Category updates.
            -- Dynamic Amount updates would require parsing the new shared_with JSON again.
            
            UPDATE public.transactions
            SET 
                description = NEW.description || ' (Sync)', -- Re-apply tag? Or just update raw? let's simple update.
                date = NEW.date,
                category = NEW.category,
                updated_at = NOW()
            WHERE source_transaction_id = NEW.id;
            
            -- If Amount logic is needed, we'd need to loop shared_with again.
            -- Let's support it!
             IF (NEW.shared_with IS DISTINCT FROM OLD.shared_with) THEN
                 -- Iterate new splits and update specific mirrors
                 -- This is tricky because we need to match which split belongs to which mirror (by user).
                 FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
                 LOOP
                    target_member_id := (split->>'memberId')::UUID;
                    SELECT linked_user_id INTO target_user_id FROM public.family_members WHERE id = target_member_id;
                    
                    IF target_user_id IS NOT NULL THEN
                        UPDATE public.transactions
                        SET amount = (split->>'assignedAmount')::NUMERIC
                        WHERE source_transaction_id = NEW.id AND user_id = target_user_id;
                    END IF;
                 END LOOP;
             END IF;

        END IF;
        RETURN NEW;
    END IF;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

-- Rebind the trigger ensuring UPDATE event is captured
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
CREATE TRIGGER trg_mirror_shared_transaction 
    AFTER INSERT OR UPDATE ON public.transactions 
    FOR EACH ROW EXECUTE FUNCTION public.handle_mirror_shared_transaction();

COMMIT;
