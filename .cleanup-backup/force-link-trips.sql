DO $$
DECLARE
    rec RECORD;
    source_trip_name TEXT;
    target_trip_id UUID;
    target_user_id UUID;
    fixed_count INT := 0;
BEGIN
    RAISE NOTICE 'Starting Force Link Trips...';

    FOR rec IN 
        SELECT 
            t.id AS trans_id, 
            t.mirror_transaction_id, 
            t.trip_id AS source_trip_id,
            t.description,
            t.shared_with
        FROM transactions t
        WHERE t.is_shared = true 
          AND t.trip_id IS NOT NULL 
          AND t.mirror_transaction_id IS NULL -- This is the Source Transaction
    LOOP
        -- Get the name of the source trip
        SELECT name INTO source_trip_name FROM trips WHERE id = rec.source_trip_id;
        
        IF source_trip_name IS NOT NULL THEN
            -- Find the mirror transaction to get the target user
            -- Problem: We don't have the mirror ID handy in the source row easily without querying? 
            -- Wait, the source relates to mirror via... logic? 
            -- Ah, the source HAS `mirror_transaction_id` = NULL.
            -- The MIRROR has `mirror_transaction_id` = source.id.
            
            FOR target_user_id IN 
                SELECT user_id 
                FROM transactions 
                WHERE mirror_transaction_id = rec.trans_id
            LOOP
                -- 1. Check if Target User ALREADY has a trip with this name
                SELECT id INTO target_trip_id 
                FROM trips 
                WHERE user_id = target_user_id AND name = source_trip_name
                LIMIT 1;

                -- 2. If not, CREATE IT
                IF target_trip_id IS NULL THEN
                    INSERT INTO trips (user_id, name, status, start_date, end_date, description)
                    SELECT 
                        target_user_id, 
                        name, 
                        status, 
                        start_date, 
                        end_date, 
                        description || ' (Compartilhada)'
                    FROM trips WHERE id = rec.source_trip_id
                    RETURNING id INTO target_trip_id;
                    
                    RAISE NOTICE 'Created missing trip "%" for user %', source_trip_name, target_user_id;
                END IF;

                -- 3. UPDATE the Mirror Transaction
                UPDATE transactions 
                SET trip_id = target_trip_id 
                WHERE mirror_transaction_id = rec.trans_id 
                  AND user_id = target_user_id
                  AND trip_id IS NULL; -- Only update if missing
                
                IF FOUND THEN
                    fixed_count := fixed_count + 1;
                END IF;
            END LOOP;
        END IF;
    END LOOP;

    RAISE NOTICE 'Fixed % transactions.', fixed_count;
END $$;
