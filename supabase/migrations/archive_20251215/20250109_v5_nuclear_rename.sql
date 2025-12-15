-- MIGRATION: V5 NUCLEAR RENAME & FIX
-- DATE: 2025-01-09
-- DESCRIPTION: Renames functions to 'v5' to ensure fresh execution.
--              Solves 'record ->> unknown' by using Integer Loops.
--              Drops ALL old triggers to clear conflicts.

-- 1. DROP EVERYTHING OLD (Safety First)
DROP TRIGGER IF EXISTS on_trip_change ON public.trips;
DROP TRIGGER IF EXISTS handle_trip_sharing_trigger ON public.trips;
DROP TRIGGER IF EXISTS trg_trip_sync ON public.trips;

DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP TRIGGER IF EXISTS handle_mirror_shared_transaction_trigger ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_insert ON public.transactions;
DROP TRIGGER IF EXISTS trg_shared_transaction_sync ON public.transactions;


-- 2. CREATE NEW FUNC: handle_trip_sharing_v5 (Integer Loop)
CREATE OR REPLACE FUNCTION handle_trip_sharing_v5()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    participant_data JSONB;
    target_member_id UUID;
    target_user_id UUID;
    existing_mirror_id UUID;
    inviter_name TEXT;
    i INT;
    len INT;
BEGIN
    IF NEW.participants IS NULL OR jsonb_array_length(NEW.participants) = 0 THEN RETURN NEW; END IF;
    IF NEW.source_trip_id IS NOT NULL THEN RETURN NEW; END IF;

    len := jsonb_array_length(NEW.participants);
    FOR i IN 0 .. (len - 1)
    LOOP
        participant_data := NEW.participants->i;
        
        target_member_id := (participant_data->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        
        IF target_user_id IS NOT NULL THEN
            SELECT id INTO existing_mirror_id FROM trips 
            WHERE user_id = target_user_id 
              AND (
                  source_trip_id::text = NEW.id::text 
                  OR (name = NEW.name AND start_date = NEW.start_date)
                  OR (start_date = NEW.start_date AND end_date = NEW.end_date)
              )
            LIMIT 1;
            
            IF existing_mirror_id IS NOT NULL THEN
                UPDATE trips SET 
                    source_trip_id = NEW.id,
                    name = NEW.name,
                    start_date = NEW.start_date,
                    end_date = NEW.end_date,
                    image_url = NEW.image_url,
                    updated_at = NOW()
                    -- Budget NOT synced (Personal)
                WHERE id = existing_mirror_id;
            ELSE
                INSERT INTO trips (user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at)
                VALUES (target_user_id, NEW.name, NEW.start_date, NEW.end_date, NEW.budget, NEW.image_url, NEW.id, NEW.participants, NOW(), NOW());
            END IF;
        END IF;
    END LOOP;
    
    -- NOTIFICATION LOOP
    FOR i IN 0 .. (len - 1)
    LOOP
        participant_data := NEW.participants->i;
        target_member_id := (participant_data->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        
        IF target_user_id IS NOT NULL THEN
             SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = NEW.user_id;
             IF NOT EXISTS (SELECT 1 FROM user_notifications WHERE user_id = target_user_id AND type = 'TRIP_INVITE' AND data->>'tripId' = NEW.id::text) THEN
                 INSERT INTO public.user_notifications (user_id, type, title, message, data, is_read, created_at)
                 VALUES (target_user_id, 'TRIP_INVITE', 'Boa Viagem! ✈️', 
                         'Você foi incluído na viagem "' || NEW.name || '" por ' || COALESCE(inviter_name, 'um familiar') || '. Prepare as malas!', 
                         jsonb_build_object('tripId', NEW.id), false, NOW());
             END IF;
        END IF;
    END LOOP;

    RETURN NEW;
END;
$func$;


-- 3. CREATE NEW FUNC: handle_mirror_shared_transaction_v5 (Integer Loop)
CREATE OR REPLACE FUNCTION public.handle_mirror_shared_transaction_v5()
RETURNS TRIGGER AS $func$
DECLARE
    split JSONB;
    target_member_id UUID;
    target_user_id UUID;
    target_trip_id UUID; 
    inviter_name TEXT;
    original_trip_rec RECORD;
    i INT;
    len INT;
BEGIN
    IF (TG_OP = 'INSERT') AND (auth.uid() = NEW.user_id) AND (NEW.is_shared = true) AND (NEW.shared_with IS NOT NULL) AND (jsonb_array_length(NEW.shared_with) > 0) THEN
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = auth.uid();
        
        len := jsonb_array_length(NEW.shared_with);
        FOR i IN 0 .. (len - 1)
        LOOP
            split := NEW.shared_with->i;
            
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM public.family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                target_trip_id := NULL;
                IF NEW.trip_id IS NOT NULL THEN
                    SELECT id INTO target_trip_id FROM trips 
                    WHERE source_trip_id::text = NEW.trip_id::text AND user_id = target_user_id;
                    
                    IF target_trip_id IS NULL THEN
                        SELECT * INTO original_trip_rec FROM trips WHERE id::text = NEW.trip_id::text;
                        IF original_trip_rec.id IS NOT NULL THEN
                             INSERT INTO trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                            ) VALUES (
                                target_user_id, original_trip_rec.name, original_trip_rec.start_date, original_trip_rec.end_date, original_trip_rec.budget,
                                original_trip_rec.image_url, original_trip_rec.id, original_trip_rec.participants, NOW(), NOW()
                            ) RETURNING id INTO target_trip_id;
                        END IF;
                    END IF;
                END IF;

                INSERT INTO public.transactions (
                    user_id, amount, date, description, category, type, is_shared, payer_id, shared_with, trip_id, created_at, updated_at
                ) VALUES (
                    target_user_id, 
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
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. ATTACH V5 TRIGGERS
CREATE TRIGGER on_trip_change_v5 
AFTER INSERT OR UPDATE ON public.trips 
FOR EACH ROW EXECUTE FUNCTION handle_trip_sharing_v5();

CREATE TRIGGER trg_mirror_shared_transaction_v5 
AFTER INSERT ON public.transactions 
FOR EACH ROW EXECUTE FUNCTION public.handle_mirror_shared_transaction_v5();
