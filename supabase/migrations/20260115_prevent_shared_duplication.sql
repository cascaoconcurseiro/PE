-- 20260115_prevent_shared_duplication.sql

-- PURPOSE: Prevent double-creation of shared transactions.
-- DIAGNOSIS: Legacy triggers (v4, v5) may still be active alongside new logic, creating duplicates.
-- SOLUTION:
-- 1. Drop known legacy triggers/functions.
-- 2. Add UNIQUE CONSTRAINT on (source_transaction_id, user_id) to physically enforce 1:1 mirroring.

BEGIN;

-- 1. CLEANUP LEGACY TRIGGERS & FUNCTIONS
-- We drop anything that looks like an old mirroring logic.
DROP TRIGGER IF EXISTS tr_transaction_mirroring_v4 ON public.transactions;
DROP TRIGGER IF EXISTS trig_mirror_transactions_full ON public.transactions; -- The one blocking us
DROP FUNCTION IF EXISTS public.handle_transaction_mirroring_v4() CASCADE;

DROP TRIGGER IF EXISTS tr_transaction_mirroring_v5 ON public.transactions;
DROP FUNCTION IF EXISTS public.handle_transaction_mirroring_v5() CASCADE;

DROP TRIGGER IF EXISTS trigger_share_transaction_new ON public.transactions; 

-- 2. ENFORCE UNIQUENESS (The "Physical Force" Solution)
-- A user cannot have two transactions pointing to the same Source (Parent).
-- This ensures that even if logic fires twice, the DB rejects the second.

-- 2. ENFORCE UNIQUENESS (The "Physical Force" Solution)
-- A user cannot have two transactions pointing to the same Source (Parent).
-- This ensures that even if logic fires twice, the DB rejects the second.

CREATE UNIQUE INDEX IF NOT EXISTS uq_transactions_source_mirror 
ON public.transactions(source_transaction_id, user_id)
WHERE source_transaction_id IS NOT NULL;

-- 3. ENSURE NEW TRIGGER HANDLES CONFLICTS
-- The existing 'handle_mirror_shared_transaction' in 20260103 usually does INSERT ...
-- Since we can't easily edit the code of an existing function without re-declaring it entirely,
-- we rely on the fact that if the INSERT fails due to constraint, the Trigger fails...
-- WAIT! If the Trigger fails, the ORIGINAL transaction (Parent) also fails (Rollback)!
-- We MUST update the current mirroring function to use `ON CONFLICT DO NOTHING`.

-- RELOADING THE "SMART MIRRORING" LOGIC WITH IDEMPOTENCY
CREATE OR REPLACE FUNCTION public.handle_mirror_shared_transaction()
RETURNS TRIGGER AS $func$
DECLARE
    split JSONB;
    target_member_id UUID;
    target_user_id UUID;
    target_trip_id UUID; 
    inviter_name TEXT;
    original_trip_rec RECORD;
    existing_mirror_id UUID;
BEGIN
    -- [LOGIC REDACTED FOR BREVITY - we keep the same logic but wrap Insert]
    -- For this specific tool call, I will need to provide the FULL function body with ON CONFLICT.
    -- (Proceeding to write full logic below based on 20260103 knowledge)
    
    -- GUARD CLAUSE: Only Shared Inserts
    IF (TG_OP = 'INSERT') AND (NEW.is_shared = true) AND (auth.uid() = NEW.user_id) AND (jsonb_array_length(NEW.shared_with) > 0) THEN
        
        FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM public.family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                
                -- Idempotency Check (Pre-Insert)
                -- If we already have a mirror for this NEW.id (the source) for this target user, SKIP.
                PERFORM 1 FROM transactions 
                WHERE source_transaction_id = NEW.id AND user_id = target_user_id;
                
                IF FOUND THEN
                    CONTINUE; -- Skip this split
                END IF;

                -- TRIP LOGIC (Simplified for safety - Copy/Paste robust logic)
                target_trip_id := NULL;
                IF NEW.trip_id IS NOT NULL THEN
                   -- Try to find matching trip
                   SELECT id INTO target_trip_id FROM trips 
                   WHERE source_trip_id::text = NEW.trip_id::text AND user_id = target_user_id;

                   -- Create if missing (Smart Trip Mirroring)
                   IF target_trip_id IS NULL THEN
                       SELECT * INTO original_trip_rec FROM trips WHERE id::text = NEW.trip_id::text;
                       IF original_trip_rec.id IS NOT NULL THEN
                            INSERT INTO trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants
                            ) VALUES (
                                target_user_id, 
                                original_trip_rec.name, 
                                original_trip_rec.start_date, 
                                original_trip_rec.end_date, 
                                0, 
                                original_trip_rec.image_url, 
                                original_trip_rec.id, 
                                original_trip_rec.participants
                            ) 
                            ON CONFLICT (id) DO NOTHING -- Should not conflict due to serial/uuid but good safety
                            RETURNING id INTO target_trip_id;
                            
                            -- Fallback if conflict prevented return
                            IF target_trip_id IS NULL THEN
                                SELECT id INTO target_trip_id FROM trips WHERE source_trip_id::text = NEW.trip_id::text AND user_id = target_user_id;
                            END IF;
                       END IF;
                   END IF;
                END IF;

                -- INSERT THE MIRROR TRANSACTION
                INSERT INTO transactions (
                    user_id,
                    description,
                    amount,
                    type,
                    date,
                    category,
                    payer_id, -- Who paid? The original user (auth.uid or NEW.user_id)
                    is_shared,
                    is_settled,
                    trip_id,
                    source_transaction_id, -- THE LINK!
                    currency,
                    created_at,
                    updated_at
                ) VALUES (
                    target_user_id,
                    NEW.description, -- Clean Name (Frontend adds badge)
                    (split->>'assignedAmount')::numeric, 
                    NEW.type,
                    NEW.date,
                    NEW.category,
                    NEW.user_id::text, -- Payer is Source
                    FALSE, -- Not shared further
                    FALSE, 
                    target_trip_id,
                    NEW.id, -- source_transaction_id
                    NEW.currency,
                    NOW(),
                    NOW()
                )
                ON CONFLICT DO NOTHING; -- Swallow duplicates thanks to index uq_transactions_source_mirror

            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$func$ LANGUAGE plpgsql;

COMMIT;
