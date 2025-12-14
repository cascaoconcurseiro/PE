-- MASTER FIX SHARED ENGINE (2025-12-14) - PARANOID EDITION
-- Combined Script: Schema Repair + Logic Restoration + Data Sync
-- OBJECTIVE: Fix Shared Trips, Transactions, and Notifications definitively.

-- =================================================================================
-- PART 1: SCHEMA REPAIR (ENSURE COLUMNS EXIST)
-- =================================================================================
DO $do$
BEGIN
    RAISE NOTICE 'Starting Schema Repair...';
    
    -- 1. Fix User Notifications Schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'data') THEN
        ALTER TABLE user_notifications ADD COLUMN data JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'is_read') THEN
        ALTER TABLE user_notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'type') THEN
        ALTER TABLE user_notifications ADD COLUMN type TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'title') THEN
        ALTER TABLE user_notifications ADD COLUMN title TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'message') THEN
        ALTER TABLE user_notifications ADD COLUMN message TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'user_notifications' AND column_name = 'user_id') THEN
        ALTER TABLE user_notifications ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;

    -- 2. Fix Trips Mirroring Schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'trips' AND column_name = 'source_trip_id') THEN
        ALTER TABLE trips ADD COLUMN source_trip_id UUID;
    END IF;

    -- 3. Fix Transactions Mirroring Schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'shared_with') THEN
        ALTER TABLE transactions ADD COLUMN shared_with JSONB;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'payer_id') THEN
        ALTER TABLE transactions ADD COLUMN payer_id TEXT;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'is_shared') THEN
        ALTER TABLE transactions ADD COLUMN is_shared BOOLEAN DEFAULT false;
    END IF;

    -- 4. Fix Family Linking Schema
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'linked_user_id') THEN
        ALTER TABLE family_members ADD COLUMN linked_user_id UUID;
    END IF;
    
    RAISE NOTICE 'Schema Repair Completed.';
END $do$;


-- =================================================================================
-- PART 2: LOGIC REPAIR (TRIGGERS & FUNCTIONS)
-- =================================================================================

-- 1. BALANCE ENGINE (Disable trigger-based calc, move to App/Edge)
CREATE OR REPLACE FUNCTION update_account_balance()
RETURNS TRIGGER AS $func$
BEGIN
  RETURN NEW; 
END;
$func$ LANGUAGE plpgsql;

-- 2. SHARED MIRROR ENGINE (Transactions)
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
    IF (TG_OP = 'INSERT') AND (auth.uid() = NEW.user_id) AND (NEW.is_shared = true) AND (NEW.shared_with IS NOT NULL) AND (jsonb_array_length(NEW.shared_with) > 0) THEN
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = auth.uid();
        FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            -- PARANOID: Text casting
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM public.family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                -- TRIP LOGIC
                target_trip_id := NULL;
                IF NEW.trip_id IS NOT NULL THEN
                    -- 1. Try to find existing mirror (SAFE CAST)
                    SELECT id INTO target_trip_id FROM trips 
                    WHERE source_trip_id::text = NEW.trip_id::text AND user_id = target_user_id;

                    -- 2. If not found, CREATE IT AUTOMATICALLY
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
                                original_trip_rec.budget,
                                original_trip_rec.image_url, 
                                original_trip_rec.id, -- source_trip_id (UUID)
                                original_trip_rec.participants, 
                                NOW(), 
                                NOW()
                            ) RETURNING id INTO target_trip_id;
                        END IF;
                    END IF;
                END IF;

                -- INSERT TRANSACTION
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
                    auth.uid()::text, -- SAFE CAST: Inserting UUID as Text
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

-- CLEANUP OLD TRIGGER NAMES
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP TRIGGER IF EXISTS handle_shared_transaction_trigger ON public.transactions; -- Potential Zombie
DROP TRIGGER IF EXISTS on_transaction_insert ON public.transactions; -- Potential Zombie
-- RECREATE
CREATE TRIGGER trg_mirror_shared_transaction AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_mirror_shared_transaction();


-- 3. TRIP MIRROR ENGINE
CREATE OR REPLACE FUNCTION handle_trip_sharing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    participant_record JSONB;
    target_member_id UUID;
    target_user_id UUID;
    existing_mirror_id UUID;
    inviter_name TEXT;
BEGIN
    IF NEW.participants IS NULL OR jsonb_array_length(NEW.participants) = 0 THEN RETURN NEW; END IF;
    IF NEW.source_trip_id IS NOT NULL THEN RETURN NEW; END IF;

    IF NEW.source_trip_id IS NOT NULL THEN RETURN NEW; END IF;

    FOR participant_record IN SELECT * FROM jsonb_array_elements(NEW.participants)
    LOOP
        target_member_id := (participant_record->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        IF target_user_id IS NOT NULL THEN
            -- SMART MATCHING: 
            -- 1. Exact Source Match
            -- 2. Exact Name + Date Match
            -- 3. FUZZY MATCH: Same User + Overlapping Dates (Start=Start AND End=End)
            SELECT id INTO existing_mirror_id FROM trips 
            WHERE user_id = target_user_id 
              AND (
                  source_trip_id::text = NEW.id::text 
                  OR (name = NEW.name AND start_date = NEW.start_date)
                  OR (start_date = NEW.start_date AND end_date = NEW.end_date) -- Smart Date Match
              )
            LIMIT 1;
            
            IF existing_mirror_id IS NOT NULL THEN
                -- Link existing trip to source, update details potentially?
                -- Be careful not to overwrite user's custom name if they had one.
                -- Use COALESCE or just update linkage?
                -- If we found it by date match, it might have a different name.
                -- Let's UPDATE the linkage so next time we find it easily. 
                -- We only overwrite Name if it was a direct mirror (source_trip_id match).
                -- If it was a Fuzzy match, we keep user's name but link logic.
                
                -- Wait, if I link it, existing logic updates name/dates.
                -- "UPDATE trips SET name = NEW.name ..."
                -- User might not want their "Minha Viagem" renamed to "Orlando Trip".
                -- COMPROMISE: If source_trip_id matched, update everything.
                -- If Date matched (and source was null), LINK IT (set source_trip_id) but maybe keep name?
                -- User request: "só avisar que ele foi incluido" (Just notify).
                -- "identify this and... link/notify".
                
                -- Let's update source_trip_id if it's null.
                UPDATE trips SET 
                    source_trip_id = NEW.id,
                    updated_at = NOW()
                    -- Do NOT overwrite Name/Dates if it was a fuzzy match?
                    -- Actually, syncing dates is probably good.
                    -- Let's play it safe: If source_trip_id WAS MATCHED, sync all.
                    -- If Fuzzy Matched, only sync source_trip_id.
                WHERE id = existing_mirror_id;
                
            ELSE
                INSERT INTO trips (user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at)
                VALUES (target_user_id, NEW.name, NEW.start_date, NEW.end_date, 0, NEW.image_url, NEW.id, NEW.participants, NOW(), NOW());
            END IF;
        END IF;
    END LOOP;
    
    -- NOTIFICATION: Happy Welcome to Trip!
    FOR participant_record IN SELECT * FROM jsonb_array_elements(NEW.participants)
    LOOP
        target_member_id := (participant_record->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        
        -- Only notify if it's a NEW trip (mirror just created)
        IF target_user_id IS NOT NULL THEN
             SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = NEW.user_id;
             -- Check if we just created the trip (by checking existence and creation time close to now? Or just blindly notify on insert?)
             -- Since this trigger runs on INSERT OR UPDATE, we should be careful. 
             -- But the logic above filters mirrors. Wait, this trigger runs on the SOURCE trip.
             -- If I am updating the source trip, I might be re-triggering this.
             -- Let's rely on the fact that we enter this block.
             
             -- Let's just insert a notification saying "You are going to [Place]!"
             -- We can debounce by checking if a notification for this trip already exists?
             -- Better: "Trip Invitation"
             
             -- "To avoid spam, only notify if we haven't notified for this trip recently?"
             -- Actually, simple is better. If I add you to a trip, you get a notification. 
             -- If I update the trip, you might get another one?
             -- Let's refine. This trigger runs on INSERT OR UPDATE.
             -- If I change the date, I don't want to spam "Welcome".
             
             -- CONSTRAINT: Only notify if TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.participants IS DISTINCT FROM NEW.participants)
             -- Ideally, we only notify the *newly added* people.
             -- For now, let's keep it simple: Notify on Trip Creation (INSERT).
             
             -- LOGIC: Notify if we are INSERTING (New Trip) OR UPDATING (Adding Participant).
             -- This block runs for EACH participant in the list.
             -- Use strict check:
             -- Only notify if:
             -- 1. It's an INSERT (New Trip for Inviter -> New Mirror for Invitee)
             -- 2. It's an UPDATE, but this specific user was NOT in the trip before?
             -- Too complex to check OLD.participants in a loop.
             -- TRICK: Identify if the Mirror Trip (existing_mirror_id) was JUST created or linked?
             -- Actually, we can just check if we haven't notified them about this trip yet?
             -- "WHERE NOT EXISTS (select 1 from user_notifications where ... data->>'tripId' = NEW.id)"
             
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

DROP TRIGGER IF EXISTS on_trip_change ON trips;
CREATE TRIGGER on_trip_change AFTER INSERT OR UPDATE ON trips FOR EACH ROW EXECUTE FUNCTION handle_trip_sharing();


-- 4. NOTIFICATION ENGINE
CREATE OR REPLACE FUNCTION public.handle_shared_notification()
RETURNS TRIGGER AS $func$
DECLARE
    target_user_id UUID;
    sender_name TEXT;
BEGIN
    -- NOTIFY ON INVITE
    IF (TG_OP = 'INSERT') AND (TG_TABLE_NAME = 'family_members') THEN
        IF NEW.linked_user_id IS NOT NULL THEN
            SELECT raw_user_meta_data->>'name' INTO sender_name FROM auth.users WHERE id = NEW.user_id; 
            INSERT INTO public.user_notifications (user_id, type, title, message, data, is_read, created_at)
            VALUES (NEW.linked_user_id, 'INVITE', 'Convite de Família', COALESCE(sender_name, 'Alguém') || ' te adicionou como membro familiar.', jsonb_build_object('memberId', NEW.id), false, NOW());
        END IF;
        RETURN NEW;
    END IF;

    -- NOTIFY ON SHARED TRANSACTION
    IF (TG_OP = 'INSERT') AND (TG_TABLE_NAME = 'transactions') THEN
        -- Fix: Explicit Cast to Text/UUID for comparison soundness
        -- Check if payer_id is a valid UUID (length 36 approx) to avoid invalid input syntax
        IF (NEW.is_shared = true) AND (NEW.payer_id IS NOT NULL) AND (length(NEW.payer_id) = 36) AND (NEW.payer_id::text <> NEW.user_id::text) THEN
            SELECT raw_user_meta_data->>'name' INTO sender_name FROM auth.users WHERE id = NEW.payer_id::uuid;
            INSERT INTO public.user_notifications (user_id, type, title, message, data, is_read, created_at)
            VALUES (NEW.user_id, 'TRANSACTION', 'Nova Despesa Compartilhada', COALESCE(sender_name, 'Alguém') || ' adicionou uma despesa para você.', jsonb_build_object('transactionId', NEW.id, 'tripId', NEW.trip_id), false, NOW());
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_on_invite ON public.family_members;
CREATE TRIGGER trg_notify_on_invite AFTER INSERT ON public.family_members FOR EACH ROW EXECUTE FUNCTION public.handle_shared_notification();

DROP TRIGGER IF EXISTS trg_notify_on_transaction ON public.transactions;
CREATE TRIGGER trg_notify_on_transaction AFTER INSERT ON public.transactions FOR EACH ROW EXECUTE FUNCTION public.handle_shared_notification();


-- 5. INVITE RPCs
DROP FUNCTION IF EXISTS check_user_by_email(text);
CREATE OR REPLACE FUNCTION check_user_by_email(email_to_check TEXT) RETURNS UUID AS $func$
DECLARE found_user_id UUID;
BEGIN SELECT id INTO found_user_id FROM auth.users WHERE lower(email) = lower(email_to_check); RETURN found_user_id; END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;

DROP FUNCTION IF EXISTS invite_user_to_family(uuid, text);
CREATE OR REPLACE FUNCTION invite_user_to_family(member_id UUID, email_to_invite TEXT) RETURNS BOOLEAN AS $func$
DECLARE target_user_id UUID;
BEGIN
    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower(email_to_invite);
    IF target_user_id IS NULL THEN RETURN FALSE; END IF;
    UPDATE public.family_members SET linked_user_id = target_user_id, email = email_to_invite, updated_at = NOW() WHERE id = member_id;
    RETURN TRUE;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;


-- =================================================================================
-- PART 3: DATA REPAIR (FORCE SYNC)
-- =================================================================================
DO $do$
DECLARE
    links_fixed INT := 0;
    trips_created INT := 0;
    tx_created INT := 0;
    
    member_rec RECORD;
    trip_rec RECORD;
    tx_rec RECORD;
    
    target_user_id UUID;
    existing_mirror_id UUID;
    split JSONB;
    target_member_id UUID;
    inviter_name TEXT;
    target_trip_id UUID;
    duplicate_found BOOLEAN;
BEGIN
    RAISE NOTICE 'Starting Data Repair...';

    -- 1. FIX FAMILY LINKS
    UPDATE public.family_members fm
    SET linked_user_id = au.id
    FROM auth.users au
    WHERE LOWER(TRIM(fm.email)) = LOWER(TRIM(au.email))
      AND fm.linked_user_id IS NULL;
    GET DIAGNOSTICS links_fixed = ROW_COUNT;
    RAISE NOTICE 'Links repaired: %', links_fixed;


    -- 2. SYNC TRIPS
    FOR trip_rec IN SELECT * FROM trips WHERE participants IS NOT NULL AND jsonb_array_length(participants) > 0 AND source_trip_id IS NULL
    LOOP
        FOR split IN SELECT * FROM jsonb_array_elements(trip_rec.participants)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                SELECT id INTO existing_mirror_id FROM trips 
                WHERE user_id = target_user_id 
                  AND (source_trip_id::text = trip_rec.id::text OR (name = trip_rec.name AND start_date = trip_rec.start_date));
                
                IF existing_mirror_id IS NULL THEN
                    INSERT INTO trips (user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at)
                    VALUES (target_user_id, trip_rec.name, trip_rec.start_date, trip_rec.end_date, 0, trip_rec.image_url, trip_rec.id, trip_rec.participants, NOW(), NOW());
                    trips_created := trips_created + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Trips synced: %', trips_created;


    -- 3. SYNC TRANSACTIONS
    FOR tx_rec IN SELECT * FROM transactions WHERE is_shared = true AND (payer_id::text = user_id::text OR payer_id IS NULL OR payer_id = 'me') AND shared_with IS NOT NULL AND jsonb_array_length(shared_with) > 0
    LOOP
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = tx_rec.user_id;
        
        FOR split IN SELECT * FROM jsonb_array_elements(tx_rec.shared_with)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
            
            IF target_user_id IS NOT NULL THEN
                SELECT EXISTS (
                    SELECT 1 FROM transactions WHERE user_id = target_user_id AND date = tx_rec.date AND amount = (split->>'assignedAmount')::NUMERIC AND description LIKE '%' || tx_rec.description || '%' AND type = 'DESPESA'
                ) INTO duplicate_found;
                
                IF NOT duplicate_found THEN
                    -- Resolve Trip Link
                    target_trip_id := NULL;
                    IF tx_rec.trip_id IS NOT NULL THEN
                         SELECT id INTO target_trip_id FROM trips WHERE source_trip_id::text = tx_rec.trip_id::text AND user_id = target_user_id;
                         
                         -- AUTO CREATE TRIP IF MISSING IN SYNC
                         IF target_trip_id IS NULL THEN
                            INSERT INTO trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                            ) SELECT 
                                target_user_id, name, start_date, end_date, budget, image_url, id, participants, NOW(), NOW()
                              FROM trips WHERE id = tx_rec.trip_id
                              RETURNING id INTO target_trip_id;
                         END IF;
                    END IF;

                    INSERT INTO public.transactions (
                        user_id, amount, date, description, category, type, is_shared, payer_id, shared_with, trip_id, created_at, updated_at
                    ) VALUES (
                        target_user_id, (split->>'assignedAmount')::NUMERIC, tx_rec.date, 
                        tx_rec.description || ' (Compartilhado por ' || COALESCE(inviter_name, 'Alguém') || ')',
                        tx_rec.category, 'DESPESA', true, tx_rec.user_id::text, '[]'::jsonb, target_trip_id, NOW(), NOW()
                    );
                    tx_created := tx_created + 1;
                END IF;
            END IF;
        END LOOP;
    END LOOP;
    RAISE NOTICE 'Transactions synced: %', tx_created;

    RAISE NOTICE 'Data Repair Completed.';
END $do$;
