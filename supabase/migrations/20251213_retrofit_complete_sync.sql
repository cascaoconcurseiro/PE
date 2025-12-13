-- RETROACTIVE SYNC: Fix Trips, Orphans, and Links
-- Run this in Supabase SQL Editor

DO $$
DECLARE
    rec RECORD;
    participant_record JSONB;
    target_member_id UUID;
    target_user_id UUID;
    existing_mirror_id UUID;
    new_trip_id UUID;
    trip_counter INT := 0;
    orphan_counter INT := 0;
    link_counter INT := 0;
BEGIN
    RAISE NOTICE 'Starting Retroactive Sync...';

    -- ==================================================================================
    -- 1. SYNC MISSING TRIPS
    -- Iterate over ALL original trips that have participants
    -- ==================================================================================
    FOR rec IN 
        SELECT * FROM trips 
        WHERE source_trip_id IS NULL -- Only originals
        AND participants IS NOT NULL 
        AND jsonb_array_length(participants) > 0
        AND deleted = false
    LOOP
        -- Process participants
        FOR participant_record IN SELECT * FROM jsonb_array_elements(rec.participants)
        LOOP
            target_member_id := (participant_record->>'memberId')::UUID;
            
            -- Find real User ID
            SELECT linked_user_id INTO target_user_id
            FROM family_members
            WHERE id = target_member_id;

            IF target_user_id IS NOT NULL THEN
                -- Check if mirror trip exists for this user
                SELECT id INTO existing_mirror_id
                FROM trips
                WHERE user_id = target_user_id
                AND (source_trip_id = rec.id OR (name = rec.name AND start_date = rec.start_date));

                IF existing_mirror_id IS NULL THEN
                    -- CREATE MISSING TRIP
                    INSERT INTO trips (
                        user_id, name, start_date, end_date, budget, image_url, 
                        source_trip_id, participants, created_at, updated_at
                    ) VALUES (
                        target_user_id, rec.name, rec.start_date, rec.end_date, 0, rec.image_url,
                        rec.id, rec.participants, NOW(), NOW()
                    ) RETURNING id INTO new_trip_id;
                    
                    trip_counter := trip_counter + 1;
                    RAISE NOTICE 'Created missing trip "%" for User %', rec.name, target_user_id;
                END IF;
            END IF;
        END LOOP;
    END LOOP;

    -- ==================================================================================
    -- 2. DELETE ORPHANED TRANSACTIONS
    -- Delete mirrors where source no longer exists or is deleted
    -- ==================================================================================
    WITH deleted_orphans AS (
        DELETE FROM transactions t_mirror
        WHERE t_mirror.mirror_transaction_id IS NOT NULL 
        AND NOT EXISTS (
            SELECT 1 FROM transactions t_source 
            WHERE t_source.id = t_mirror.mirror_transaction_id 
            AND t_source.deleted = false
        )
        RETURNING id
    )
    SELECT count(*) INTO orphan_counter FROM deleted_orphans;

    -- ==================================================================================
    -- 3. LINK DETACHED TRANSACTIONS TO TRIPS
    -- If source tx has a trip, link the mirror tx to the equivalent mirror trip
    -- ==================================================================================
    WITH updates AS (
        UPDATE transactions t_dest
        SET trip_id = t_target_trip.id
        FROM transactions t_src
        JOIN trips t_src_trip ON t_src.trip_id = t_src_trip.id
        JOIN trips t_target_trip ON (
             -- Match trip by explicit link OR Logic Name+Date match
             t_target_trip.source_trip_id = t_src_trip.id 
             OR (t_target_trip.name = t_src_trip.name AND t_target_trip.user_id = t_dest.user_id)
        )
        WHERE t_dest.mirror_transaction_id = t_src.id
        AND t_dest.trip_id IS NULL -- Only fix those currently outside the trip
        AND t_dest.user_id = t_target_trip.user_id -- Safety
        RETURNING t_dest.id
    )
    SELECT count(*) INTO link_counter FROM updates;

    RAISE NOTICE 'Sync Complete:';
    RAISE NOTICE '- Trips Created: %', trip_counter;
    RAISE NOTICE '- Orphans Deleted: %', orphan_counter;
    RAISE NOTICE '- Transactions Linked: %', link_counter;

END $$;
