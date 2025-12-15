-- ==============================================================================
-- MIGRATION: FORCE SYNC SHARED EXPENSES (MANUAL TRIGGER)
-- DATE: 2025-12-15
-- DESCRIPTION: Iterates over ALL connected family members and forces the 
--              synchronization of past shared transactions.
--              Run this if the automatic trigger didn't fire (e.g. user already linked).
-- ==============================================================================

DO $$
DECLARE
    member_rec RECORD;
    tx_rec RECORD;
    split JSONB;
    target_trip_id UUID;
    inviter_name TEXT;
    duplicate_found BOOLEAN;
    tx_created_count INT := 0;
    trips_created_count INT := 0;
BEGIN
    RAISE NOTICE 'STARTING FORCE SYNC...';

    -- 1. Loop through ALL Family Members that are already linked
    FOR member_rec IN SELECT * FROM family_members WHERE linked_user_id IS NOT NULL
    LOOP
        RAISE NOTICE 'Checking sync for Member: % (User: %)', member_rec.name, member_rec.linked_user_id;

        -- 2. Find transactions shared with this member (that are NOT yet synced)
        FOR tx_rec IN 
            SELECT t.* 
            FROM transactions t, jsonb_array_elements(t.shared_with) as s
            WHERE t.is_shared = true 
              AND (s->>'memberId')::UUID = member_rec.id
              AND (t.payer_id::text = t.user_id::text OR t.payer_id IS NULL OR t.payer_id = 'me') -- Original Tx
        LOOP
            -- Check for exact split details
            FOR split IN SELECT * FROM jsonb_array_elements(tx_rec.shared_with)
            LOOP
                IF (split->>'memberId')::UUID = member_rec.id THEN
                    -- DUPLICATE CHECK
                    SELECT EXISTS (
                        SELECT 1 FROM transactions 
                        WHERE user_id = member_rec.linked_user_id 
                          AND date = tx_rec.date 
                          AND amount = (split->>'assignedAmount')::NUMERIC 
                          AND type = 'DESPESA'
                          -- Optional: Check Description similarity to avoid double insert if description changed slightly?
                          -- Let's stick to standard strict check to be safe.
                    ) INTO duplicate_found;

                    IF NOT duplicate_found THEN
                        -- GET INVITER NAME
                        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = tx_rec.user_id;

                        -- SYNC TRIP IF NEEDED
                        target_trip_id := NULL;
                        IF tx_rec.trip_id IS NOT NULL THEN
                             SELECT id INTO target_trip_id FROM trips 
                             WHERE source_trip_id::text = tx_rec.trip_id::text 
                               AND user_id = member_rec.linked_user_id;
                             
                             IF target_trip_id IS NULL THEN
                                INSERT INTO trips (
                                    user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                                ) SELECT 
                                    member_rec.linked_user_id, name, start_date, end_date, budget, image_url, id, participants, NOW(), NOW()
                                  FROM trips WHERE id = tx_rec.trip_id
                                  RETURNING id INTO target_trip_id;
                                  
                                trips_created_count := trips_created_count + 1;
                             END IF;
                        END IF;

                        -- INSERT MIRROR TX
                        INSERT INTO public.transactions (
                            user_id, amount, date, description, category, type, is_shared, payer_id, shared_with, trip_id, created_at, updated_at
                        ) VALUES (
                            member_rec.linked_user_id, 
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
    END LOOP;

    RAISE NOTICE 'FORCE SYNC COMPLETE: Created % Transactions and % Trips.', tx_created_count, trips_created_count;
END $$;
