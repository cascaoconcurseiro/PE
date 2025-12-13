CREATE OR REPLACE FUNCTION force_fix_trips_v2() RETURNS void AS $$
DECLARE
    rec RECORD;
    v_source_trip_rec RECORD;
    v_target_trip_id UUID;
    v_target_user_id UUID;
    v_fixed_count INT := 0;
BEGIN
    RAISE NOTICE 'Starting Force Link Trips V2 (Function)...';

    FOR rec IN 
        SELECT 
            t.id::TEXT AS trans_id_text, 
            t.mirror_transaction_id::TEXT AS mirror_id_text,
            t.trip_id::TEXT AS source_trip_id_text,
            t.description,
            t.shared_with
        FROM transactions t
        WHERE t.is_shared = true 
          AND t.trip_id IS NOT NULL 
          AND t.mirror_transaction_id IS NULL 
    LOOP
        -- Get the name of the source trip
        SELECT * INTO v_source_trip_rec FROM trips WHERE id = rec.source_trip_id_text::UUID;
        
        IF v_source_trip_rec.id IS NOT NULL THEN
            
            FOR v_target_user_id IN 
                SELECT user_id 
                FROM transactions 
                WHERE mirror_transaction_id = rec.trans_id_text::UUID
            LOOP
                -- 1. Check if Target User ALREADY has a trip with this name
                SELECT id INTO v_target_trip_id 
                FROM trips 
                WHERE user_id = v_target_user_id AND name = v_source_trip_rec.name
                LIMIT 1;

                -- 2. If not, CREATE IT
                IF v_target_trip_id IS NULL THEN
                    INSERT INTO trips (user_id, name, status, start_date, end_date, description)
                    VALUES (
                        v_target_user_id, 
                        v_source_trip_rec.name, 
                        v_source_trip_rec.status, 
                        v_source_trip_rec.start_date, 
                        v_source_trip_rec.end_date, 
                        v_source_trip_rec.description || ' (Compartilhada)'
                    )
                    RETURNING id INTO v_target_trip_id;
                    
                    RAISE NOTICE 'Created missing trip "%" for user %', v_source_trip_rec.name, v_target_user_id;
                END IF;

                -- 3. UPDATE the Mirror Transaction
                UPDATE transactions 
                SET trip_id = v_target_trip_id 
                WHERE mirror_transaction_id = rec.trans_id_text::UUID
                  AND user_id = v_target_user_id
                  AND trip_id IS NULL; 
                
                IF FOUND THEN
                    v_fixed_count := v_fixed_count + 1;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RAISE NOTICE 'Fixed % transactions.', v_fixed_count;
END;
$$ LANGUAGE plpgsql;

SELECT force_fix_trips_v2();

DROP FUNCTION force_fix_trips_v2();
