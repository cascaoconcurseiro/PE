-- MIGRATION: V7 FIX NULL MESSAGE ERROR
-- DATE: 2025-01-09
-- DESCRIPTION: Prevents 'null value in column message' when inviter name is missing.

CREATE OR REPLACE FUNCTION notify_trip_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_participant JSONB;
    v_user_id UUID;
    v_sender_name TEXT := 'Alguém'; -- Default init
    i INT;
    len INT;
BEGIN
    -- Try to get real name
    SELECT COALESCE(name, 'Alguém') INTO v_sender_name FROM user_profiles WHERE id = NEW.user_id;
    -- If no row found, v_sender_name remains 'Alguém' (or whatever it was reset to, logic: SELECT INTO doesn't change var if no rows found found? Actually in PLPGSQL it might set to NULL or keep value. Safe to Coalesce again).
    v_sender_name := COALESCE(v_sender_name, 'Alguém');
    
    -- INSERT LOGIC
    IF (TG_OP = 'INSERT') THEN
         IF NEW.participants IS NOT NULL THEN
             len := jsonb_array_length(NEW.participants);
             FOR i IN 0 .. (len - 1)
             LOOP
                 v_participant := NEW.participants->i;
                 v_user_id := (v_participant->>'memberId')::UUID;
                 IF v_user_id IS NULL THEN v_user_id := (v_participant->>'id')::UUID; END IF;
                 IF v_user_id IS NULL AND (v_participant->>'memberId') IS NOT NULL THEN
                     SELECT linked_user_id INTO v_user_id FROM family_members WHERE id = (v_participant->>'memberId')::UUID;
                 END IF;
                 
                 IF v_user_id IS NOT NULL AND v_user_id <> NEW.user_id THEN
                     INSERT INTO public.user_notifications (user_id, type, title, message, data)
                     VALUES (
                        v_user_id,
                        'TRIP',
                        'Convite de Viagem',
                        COALESCE(v_sender_name, 'Alguém') || ' adicionou você na viagem: ' || COALESCE(NEW.name, 'Viagem'),
                        jsonb_build_object('tripId', NEW.id)
                     );
                 END IF;
             END LOOP;
         END IF;

    -- UPDATE LOGIC
    ELSIF (TG_OP = 'UPDATE') THEN
         IF NEW.participants IS NOT NULL THEN
             len := jsonb_array_length(NEW.participants);
             FOR i IN 0 .. (len - 1)
             LOOP
                 v_participant := NEW.participants->i;
                 v_user_id := (v_participant->>'memberId')::UUID;
                 IF v_user_id IS NULL THEN v_user_id := (v_participant->>'id')::UUID; END IF;
                 IF v_user_id IS NULL AND (v_participant->>'memberId') IS NOT NULL THEN
                     SELECT linked_user_id INTO v_user_id FROM family_members WHERE id = (v_participant->>'memberId')::UUID;
                 END IF;

                 IF v_user_id IS NOT NULL THEN
                      IF NOT EXISTS (
                          SELECT 1 
                          FROM jsonb_array_elements(OLD.participants) old_el 
                          WHERE (old_el->>'memberId' = (v_participant->>'memberId')) 
                             OR (old_el->>'id' = (v_participant->>'id'))
                      ) THEN
                          -- New Participant Found
                          IF v_user_id <> NEW.user_id THEN
                             INSERT INTO public.user_notifications (user_id, type, title, message, data)
                             VALUES (
                                v_user_id,
                                'TRIP',
                                'Convite de Viagem',
                                COALESCE(v_sender_name, 'Alguém') || ' adicionou você na viagem: ' || COALESCE(NEW.name, 'Viagem'),
                                jsonb_build_object('tripId', NEW.id)
                             );
                          END IF;
                      END IF;
                 END IF;
             END LOOP;
         END IF;
    END IF;

    RETURN NEW;
END;
$$;
