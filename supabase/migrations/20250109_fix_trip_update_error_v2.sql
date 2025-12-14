-- MIGRATION: FIX RECORD ERROR IN HANDLE_TRIP_SHARING (V2)
-- DATE: 2025-01-09
-- DESCRIPTION: Definitive fix for 'operator does not exist: record ->> unknown'.
--              We explicitly alias the jsonb_array_elements result to 'elem' 
--              and extract it safely from the record wrapper.

CREATE OR REPLACE FUNCTION handle_trip_sharing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    rec RECORD;
    participant_data JSONB;
    target_member_id UUID;
    target_user_id UUID;
    existing_mirror_id UUID;
    inviter_name TEXT;
BEGIN
    IF NEW.participants IS NULL OR jsonb_array_length(NEW.participants) = 0 THEN RETURN NEW; END IF;
    IF NEW.source_trip_id IS NOT NULL THEN RETURN NEW; END IF;

    -- FIX: Alias the function result to 'elem' and iterate
    FOR rec IN SELECT jsonb_array_elements(NEW.participants) AS elem
    LOOP
        participant_data := rec.elem; -- Extract JSONB from Record
        
        target_member_id := (participant_data->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        
        IF target_user_id IS NOT NULL THEN
            -- SMART MATCHING: 
            SELECT id INTO existing_mirror_id FROM trips 
            WHERE user_id = target_user_id 
              AND (
                  source_trip_id::text = NEW.id::text 
                  OR (name = NEW.name AND start_date = NEW.start_date)
                  OR (start_date = NEW.start_date AND end_date = NEW.end_date)
              )
            LIMIT 1;
            
            IF existing_mirror_id IS NOT NULL THEN
                -- UPDATE LINKAGE AND DETAILS
                UPDATE trips SET 
                    source_trip_id = NEW.id,
                    name = NEW.name,        -- Sync Name
                    start_date = NEW.start_date, -- Sync Dates
                    end_date = NEW.end_date,
                    image_url = NEW.image_url, -- Sync Image
                    updated_at = NOW()
                    -- Budget is PERSONAL. Do not overwrite.
                WHERE id = existing_mirror_id;
                
            ELSE
                -- NEW MIRROR: Insert with initial budget
                INSERT INTO trips (user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at)
                VALUES (target_user_id, NEW.name, NEW.start_date, NEW.end_date, NEW.budget, NEW.image_url, NEW.id, NEW.participants, NOW(), NOW());
            END IF;
        END IF;
    END LOOP;
    
    -- NOTIFICATION LOGIC (Fix here too)
    FOR rec IN SELECT jsonb_array_elements(NEW.participants) AS elem
    LOOP
        participant_data := rec.elem;
        
        target_member_id := (participant_data->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        
        IF target_user_id IS NOT NULL THEN
             SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = NEW.user_id;
             
             IF NOT EXISTS (
                 SELECT 1 FROM user_notifications 
                 WHERE user_id = target_user_id 
                   AND type = 'TRIP_INVITE' 
                   AND data->>'tripId' = NEW.id::text
             ) THEN
                 INSERT INTO public.user_notifications (user_id, type, title, message, data, is_read, created_at)
                 VALUES (
                    target_user_id, 
                    'TRIP_INVITE', 
                    'Boa Viagem! ✈️', 
                    'Você foi incluído na viagem "' || NEW.name || '" por ' || COALESCE(inviter_name, 'um familiar') || '. Prepare as malas!', 
                    jsonb_build_object('tripId', NEW.id), 
                    false, 
                    NOW()
                 );
             END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$func$;
