-- ==============================================================================
-- FINAL NOTIFICATION FIX: UNIFY TRIGGERS TO 'metadata'
-- Objective: Fix "column data does not exist" by updating Master Fix functions
-- and removing duplicate triggers.
-- ==============================================================================

-- 1. DROP DUPLICATE/OLD TRIGGERS (Cleanup)
DROP TRIGGER IF EXISTS trig_notify_shared_tx ON public.transactions;
DROP FUNCTION IF EXISTS notify_new_shared_transaction();

DROP TRIGGER IF EXISTS trig_notify_trip_invite ON public.trips;
DROP FUNCTION IF EXISTS notify_trip_invite();

-- 2. UPDATE MASTER FIX FUNCTIONS TO USE 'metadata' AND SAFETY CHECKS

-- A. HANDLE TRIP SHARING (Trips)
CREATE OR REPLACE FUNCTION handle_trip_sharing()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $func$
DECLARE
    participant_record JSONB;
    target_member_id UUID;
    target_user_id UUID;
    existing_mirror_id UUID;
    inviter_name TEXT;
    v_data_json JSONB;
BEGIN
    IF NEW.participants IS NULL OR jsonb_array_length(NEW.participants) = 0 THEN RETURN NEW; END IF;
    IF NEW.source_trip_id IS NOT NULL THEN RETURN NEW; END IF;

    -- [MIRROR LOGIC OMITTED FOR BREVITY - ASSUMED HANDLING ELSEWHERE OR INTACT IN ORIG FUNCTION]
    -- We are focusing on NOTIFICATIONS part which was causing the crash.
    -- Assuming Mirror Logic is fine or we just redefine the whole function.
    -- To be safe, I must include the whole function logic from Master Fix, updated.

    -- MIRROR LOGIC REPLICATION (Safe Copy from Master Fix)
    FOR participant_record IN SELECT * FROM jsonb_array_elements(NEW.participants)
    LOOP
        target_member_id := (participant_record->>'memberId')::UUID;
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
                    updated_at = NOW()
                WHERE id = existing_mirror_id;
            ELSE
                INSERT INTO trips (user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at)
                VALUES (target_user_id, NEW.name, NEW.start_date, NEW.end_date, 0, NEW.image_url, NEW.id, NEW.participants, NOW(), NOW());
            END IF;
        END IF;
    END LOOP;
    
    -- NOTIFICATION LOGIC (Fixed for metadata + FK + nulls)
    FOR participant_record IN SELECT * FROM jsonb_array_elements(NEW.participants)
    LOOP
        target_member_id := (participant_record->>'memberId')::UUID;
        SELECT linked_user_id INTO target_user_id FROM family_members WHERE id = target_member_id;
        
        -- Check if user exists in AUTH
        IF target_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id = target_user_id) THEN
             SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = NEW.user_id;
             
             -- Use metadata ->> 'tripId'
             IF NOT EXISTS (
                 SELECT 1 FROM user_notifications 
                 WHERE user_id = target_user_id 
                   AND type = 'TRIP_INVITE' 
                   AND metadata->>'tripId' = NEW.id::text
             ) THEN
                 INSERT INTO public.user_notifications (user_id, type, title, message, metadata, is_read, created_at)
                 VALUES (
                    target_user_id, 
                    'TRIP_INVITE', 
                    'Boa Viagem! ✈️', 
                    'Você foi incluído na viagem "' || COALESCE(NEW.name, 'sem nome') || '" por ' || COALESCE(inviter_name, 'um familiar') || '. Prepare as malas!', 
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

-- B. HANDLE SHARED NOTIFICATION (Transactions & Invites)
CREATE OR REPLACE FUNCTION public.handle_shared_notification()
RETURNS TRIGGER AS $func$
DECLARE
    target_user_id UUID;
    sender_name TEXT;
BEGIN
    -- NOTIFY ON INVITE
    IF (TG_OP = 'INSERT') AND (TG_TABLE_NAME = 'family_members') THEN
        IF NEW.linked_user_id IS NOT NULL AND EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.linked_user_id) THEN
            SELECT raw_user_meta_data->>'name' INTO sender_name FROM auth.users WHERE id = NEW.user_id; 
            INSERT INTO public.user_notifications (user_id, type, title, message, metadata, is_read, created_at)
            VALUES (NEW.linked_user_id, 'INVITE', 'Convite de Família', COALESCE(sender_name, 'Alguém') || ' te adicionou como membro familiar.', jsonb_build_object('memberId', NEW.id), false, NOW());
        END IF;
        RETURN NEW;
    END IF;

    -- NOTIFY ON SHARED TRANSACTION
    IF (TG_OP = 'INSERT') AND (TG_TABLE_NAME = 'transactions') THEN
        IF (NEW.is_shared = true) AND (NEW.payer_id IS NOT NULL) AND (length(NEW.payer_id) = 36) AND (NEW.payer_id::text <> NEW.user_id::text) THEN
            -- Verify Payer Exists before selecting
            IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.payer_id::uuid) THEN
                SELECT raw_user_meta_data->>'name' INTO sender_name FROM auth.users WHERE id = NEW.payer_id::uuid;
            END IF;

            -- Verify Target User Exists
            IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
                INSERT INTO public.user_notifications (user_id, type, title, message, metadata, is_read, created_at)
                VALUES (
                    NEW.user_id, 
                    'TRANSACTION', 
                    'Nova Despesa Compartilhada', 
                    COALESCE(sender_name, 'Alguém') || ' adicionou uma despesa para você: ' || COALESCE(NEW.description, 'Nova Despesa'), 
                    jsonb_build_object('transactionId', NEW.id, 'tripId', NEW.trip_id), 
                    false, 
                    NOW()
                );
            END IF;
        END IF;
        RETURN NEW;
    END IF;
    RETURN NEW;
END;
$func$ LANGUAGE plpgsql SECURITY DEFINER;
