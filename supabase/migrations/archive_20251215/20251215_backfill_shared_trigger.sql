-- ==============================================================================
-- MIGRATION: BACKFILL SHARED TRANSACTIONS ON INVITE ACCEPT (LAZY LINKING)
-- DATE: 2025-12-15
-- DESCRIPTION: Creates a TRIGGER on family_members that runs when a user is LINKED.
--              It scans for PAST transactions shared with this member and creates
--              the missing mirrors for the newly linked user.
-- ==============================================================================

-- 1. FUNCTION: Sync Past Transactions
CREATE OR REPLACE FUNCTION public.sync_past_shared_transactions_on_link()
RETURNS TRIGGER AS $$
DECLARE
    tx_rec RECORD;
    split JSONB;
    target_trip_id UUID;
    inviter_name TEXT;
    duplicate_found BOOLEAN;
    tx_created_count INT := 0;
BEGIN
    -- Only run if we are Linking a User (NULL -> UUID) or Changing User
    IF NEW.linked_user_id IS NULL THEN
        RETURN NEW;
    END IF;

    -- Avoid running if nothing changed
    IF OLD.linked_user_id IS NOT NULL AND OLD.linked_user_id = NEW.linked_user_id THEN
        RETURN NEW;
    END IF;

    RAISE NOTICE 'Syncing past transactions for Member % -> User %', NEW.id, NEW.linked_user_id;

    -- Iterate over ALL transactions where this Family Member was included locally
    -- We search by matching the "memberId" in the shared_with JSON array
    FOR tx_rec IN 
        SELECT t.* 
        FROM transactions t, jsonb_array_elements(t.shared_with) as s
        WHERE t.is_shared = true 
          AND (s->>'memberId')::UUID = NEW.id
          AND (t.payer_id::text = t.user_id::text OR t.payer_id IS NULL OR t.payer_id = 'me') -- Only Original Transactions
    LOOP
        -- Find the specific split for this member
        FOR split IN SELECT * FROM jsonb_array_elements(tx_rec.shared_with)
        LOOP
            IF (split->>'memberId')::UUID = NEW.id THEN
                -- CHECK DUPLICATE: Does the target user already have this transaction?
                -- Criteria: Same Date, Same Amount, Same Type, roughly same Description
                SELECT EXISTS (
                    SELECT 1 FROM transactions 
                    WHERE user_id = NEW.linked_user_id 
                      AND date = tx_rec.date 
                      AND amount = (split->>'assignedAmount')::NUMERIC 
                      AND type = 'DESPESA'
                ) INTO duplicate_found;

                IF NOT duplicate_found THEN
                    -- GET INVITER NAME
                    SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = tx_rec.user_id;

                    -- HANDLE TRIP MIRRORING
                    target_trip_id := NULL;
                    IF tx_rec.trip_id IS NOT NULL THEN
                         -- Check if Trip Mirror exists
                         SELECT id INTO target_trip_id FROM trips 
                         WHERE source_trip_id::text = tx_rec.trip_id::text 
                           AND user_id = NEW.linked_user_id;
                         
                         -- If not, Create Trip Mirror
                         IF target_trip_id IS NULL THEN
                            INSERT INTO trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                            ) SELECT 
                                NEW.linked_user_id, name, start_date, end_date, budget, image_url, id, participants, NOW(), NOW()
                              FROM trips WHERE id = tx_rec.trip_id
                              RETURNING id INTO target_trip_id;
                         END IF;
                    END IF;

                    -- CREATE TRANSACTION MIRROR
                    INSERT INTO public.transactions (
                        user_id, 
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
                        NEW.linked_user_id, 
                        (split->>'assignedAmount')::NUMERIC, 
                        tx_rec.date, 
                        tx_rec.description || ' (Comp. por ' || COALESCE(inviter_name, 'Alguém') || ')',
                        tx_rec.category, 
                        'DESPESA', 
                        true, 
                        tx_rec.user_id::text, 
                        '[]'::jsonb, 
                        target_trip_id, 
                        NOW(), 
                        NOW()
                    );
                    
                    tx_created_count := tx_created_count + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Synced % transactions for User %', tx_created_count, NEW.linked_user_id;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER DEFINITION
DROP TRIGGER IF EXISTS trg_sync_past_shared ON public.family_members;

CREATE TRIGGER trg_sync_past_shared
AFTER UPDATE OF linked_user_id ON public.family_members
FOR EACH ROW
EXECUTE FUNCTION public.sync_past_shared_transactions_on_link();
