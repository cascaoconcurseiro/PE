-- FORCE FULL SYNC (Repair Script)
-- Executes immediately to fix Links, Trips, and Transactions.

DO $$
DECLARE
    -- Counters for reporting
    links_fixed INT := 0;
    trips_created INT := 0;
    tx_created INT := 0;
    
    -- Variables for loops
    member_rec RECORD;
    trip_rec RECORD;
    tx_rec RECORD;
    
    target_user_id UUID;
    existing_mirror_id UUID;
    split JSONB;
    target_member_id UUID;
    inviter_name TEXT;
    
BEGIN
    -- 1. FIX FAMILY LINKS (Aggressive match)
    UPDATE public.family_members fm
    SET linked_user_id = au.id
    FROM auth.users au
    WHERE LOWER(TRIM(fm.email)) = LOWER(TRIM(au.email))
      AND fm.linked_user_id IS NULL;
    
    GET DIAGNOSTICS links_fixed = ROW_COUNT;
    RAISE NOTICE 'Links repaired: %', links_fixed;


    -- 2. SYNC TRIPS (Retroactive Mirroring)
    FOR trip_rec IN SELECT * FROM trips WHERE participants IS NOT NULL AND jsonb_array_length(participants) > 0 AND source_trip_id IS NULL
    LOOP
        -- For each participant in the trip
        FOR split IN SELECT * FROM jsonb_array_elements(trip_rec.participants)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            
            -- Resolve User ID
            SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                -- Check if mirror exists
                SELECT id INTO existing_mirror_id FROM trips 
                WHERE user_id = target_user_id 
                  AND (source_trip_id = trip_rec.id OR (name = trip_rec.name AND start_date = trip_rec.start_date));
                
                IF existing_mirror_id IS NULL THEN
                    -- CREATE MIRROR TRIP
                    INSERT INTO trips (
                        user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                    ) VALUES (
                        target_user_id, 
                        trip_rec.name, 
                        trip_rec.start_date, 
                        trip_rec.end_date, 
                        0, 
                        trip_rec.image_url, 
                        trip_rec.id, 
                        trip_rec.participants, 
                        NOW(), 
                        NOW()
                    );
                    trips_created := trips_created + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Trips synced: %', trips_created;


    -- 3. SYNC TRANSACTIONS (Retroactive Mirroring)
    -- Scan all SHARED transactions where I am the payer
    FOR tx_rec IN SELECT * FROM transactions WHERE is_shared = true AND (payer_id = user_id::text OR payer_id IS NULL OR payer_id = 'me') AND shared_with IS NOT NULL AND jsonb_array_length(shared_with) > 0
    LOOP
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = tx_rec.user_id;
        
        FOR split IN SELECT * FROM jsonb_array_elements(tx_rec.shared_with)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                -- Check duplication heuristic
                -- Look for a transaction for target_user, same date, same amount (split amount), created recently?
                -- Or just same Amount/Date/Category
                DECLARE
                    split_amount NUMERIC := (split->>'assignedAmount')::NUMERIC;
                    duplicate_found BOOLEAN;
                    target_trip_id UUID;
                BEGIN
                    -- Check duplication
                    SELECT EXISTS (
                        SELECT 1 FROM transactions 
                        WHERE user_id = target_user_id 
                          AND date = tx_rec.date 
                          AND amount = split_amount
                          AND description LIKE '%' || tx_rec.description || '%'
                          AND type = 'DESPESA'
                    ) INTO duplicate_found;
                    
                    IF NOT duplicate_found THEN
                        -- Resolve Mirror Trip ID
                        target_trip_id := NULL;
                        IF tx_rec.trip_id IS NOT NULL THEN
                             SELECT id INTO target_trip_id FROM trips 
                             WHERE source_trip_id = tx_rec.trip_id AND user_id = target_user_id;
                        END IF;

                        INSERT INTO public.transactions (
                            user_id, amount, date, description, category, type, is_shared, payer_id, shared_with, trip_id, created_at, updated_at
                        ) VALUES (
                            target_user_id, 
                            split_amount, 
                            tx_rec.date, 
                            tx_rec.description || ' (Compartilhado por ' || COALESCE(inviter_name, 'Alguém') || ')',
                            tx_rec.category, 
                            'DESPESA', 
                            true, 
                            tx_rec.user_id, -- Payer is original user
                            '[]'::jsonb, 
                            target_trip_id,
                            NOW(), 
                            NOW()
                        );
                        tx_created := tx_created + 1;
                    END IF;
                END;
            END IF;
        END LOOP;
    END LOOP;

    RAISE NOTICE 'Transactions synced: %', tx_created;

END $$;
