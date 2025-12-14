-- MIGRATION: V8 FINAL STABILIZATION (CORRECTED TYPE CASTS)
-- DATE: 2025-01-09
-- 1. Fix "Violates foreign key" in Notifications (Verify user existence)
-- 2. Fix "Ghost Transactions" (Cascade Delete)
-- 3. Cleanup Orphans

-- PART 1: ROBUST NOTIFICATION FUNCTION (V8)
CREATE OR REPLACE FUNCTION notify_trip_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_participant JSONB;
    v_user_id UUID;
    v_sender_name TEXT := 'Alguém';
    i INT;
    len INT;
BEGIN
    SELECT COALESCE(name, 'Alguém') INTO v_sender_name FROM user_profiles WHERE id = NEW.user_id;
    v_sender_name := COALESCE(v_sender_name, 'Alguém');

    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE') THEN
         IF NEW.participants IS NOT NULL THEN
             len := jsonb_array_length(NEW.participants);
             FOR i IN 0 .. (len - 1)
             LOOP
                 v_participant := NEW.participants->i;
                 v_user_id := (v_participant->>'memberId')::UUID;
                 IF v_user_id IS NULL THEN v_user_id := (v_participant->>'id')::UUID; END IF;
                 
                 -- Resolve Linked User
                 IF v_user_id IS NULL AND (v_participant->>'memberId') IS NOT NULL THEN
                     SELECT linked_user_id INTO v_user_id FROM family_members WHERE id = (v_participant->>'memberId')::UUID;
                 END IF;
                 
                 -- V8 CRITICAL FIX: Verify User Exists in Auth before Insert
                 IF v_user_id IS NOT NULL AND v_user_id <> NEW.user_id THEN
                    -- Check if user actually exists to avoid FK violation
                    IF EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
                         INSERT INTO public.user_notifications (user_id, type, title, message, data)
                         VALUES (
                            v_user_id,
                            'TRIP',
                            'Convite de Viagem',
                            COALESCE(v_sender_name, 'Alguém') || ' adicionou você na viagem: ' || COALESCE(NEW.name, 'Viagem'),
                            jsonb_build_object('tripId', NEW.id)
                         )
                         ON CONFLICT DO NOTHING; 
                    END IF;
                 END IF;
             END LOOP;
         END IF;
    END IF;

    RETURN NEW;
END;
$$;


-- PART 2: CASCADE DELETE TRIGGER
-- Prevents "Ghost Transactions" when deleting a trip
CREATE OR REPLACE FUNCTION delete_trip_cascade()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
    -- Delete all transactions linked to this trip
    -- CAST TO TEXT to avoid 'operator does not exist: text = uuid' error
    DELETE FROM public.transactions WHERE trip_id::text = OLD.id::text;
    RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_trip_delete_cascade ON public.trips;
CREATE TRIGGER on_trip_delete_cascade
BEFORE DELETE ON public.trips
FOR EACH ROW EXECUTE FUNCTION delete_trip_cascade();


-- PART 3: CLEANUP ZOMBIE DATA
-- Remove transactions that point to non-existent trips
-- CAST TO TEXT to avoid type mismatch check error
DELETE FROM public.transactions 
WHERE trip_id IS NOT NULL 
  AND trip_id::text NOT IN (SELECT id::text FROM public.trips);
