-- MIGRATION: V6 GLOBAL FIX FOR HIDDEN TRIGGERS
-- DATE: 2025-01-09
-- DESCRIPTION: Fixes 'record ->> unknown' in user_notifications and rpc functions.
--              We found that 'notify_trip_invite' and 'recreate_transaction_series' were
--              still using the unsafe iteration method.

-- 1. FIX: user_notifications -> notify_trip_invite
CREATE OR REPLACE FUNCTION notify_trip_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_participant JSONB;
    v_user_id UUID;
    v_sender_name TEXT;
    i INT;
    len INT;
BEGIN
    SELECT COALESCE(name, 'Alguém') INTO v_sender_name FROM user_profiles WHERE id = NEW.user_id;
    
    -- INSERT LOGIC
    IF (TG_OP = 'INSERT') THEN
         IF NEW.participants IS NOT NULL THEN
             len := jsonb_array_length(NEW.participants);
             FOR i IN 0 .. (len - 1)
             LOOP
                 v_participant := NEW.participants->i;
                 v_user_id := (v_participant->>'memberId')::UUID; -- Use memberId or id? The JSON usually has memberId mapping to user.
                 -- Wait, old code used ->>'id'. Let's support both or check structure.
                 -- If it fails to cast, it might be null.
                 -- Let's try to resolve via family_members if memberId exists.
                 IF v_user_id IS NULL THEN
                     v_user_id := (v_participant->>'id')::UUID;
                 END IF;
                 
                 -- If still null, try 'memberId' lookup
                 IF v_user_id IS NULL AND (v_participant->>'memberId') IS NOT NULL THEN
                     SELECT linked_user_id INTO v_user_id FROM family_members WHERE id = (v_participant->>'memberId')::UUID;
                 END IF;


                 IF v_user_id IS NOT NULL AND v_user_id <> NEW.user_id THEN
                     INSERT INTO public.user_notifications (user_id, type, title, message, data)
                     VALUES (
                        v_user_id,
                        'TRIP',
                        'Convite de Viagem',
                        v_sender_name || ' adicionou você na viagem: ' || NEW.name,
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

                 -- Check if existed in OLD
                 -- Checking existence in JSONB array is complex.
                 -- Simplified: Just notify if not found in OLD string-wise ?? No, dangerous.
                 -- Let's check logic:
                 IF v_user_id IS NOT NULL THEN
                      -- Check if this specific user_id was in OLD.participants
                      -- Use a robust subquery check
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
                                v_sender_name || ' adicionou você na viagem: ' || NEW.name,
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


-- 2. FIX: explicit RPC recreate_transaction_series
CREATE OR REPLACE FUNCTION public.recreate_transaction_series(p_old_series_id UUID, p_new_transactions JSONB)
RETURNS VOID AS $$
DECLARE
    tx_data JSONB;
    i INT;
    len INT;
BEGIN
    UPDATE transactions 
    SET deleted = true, updated_at = NOW()
    WHERE series_id = p_old_series_id;

    IF p_new_transactions IS NOT NULL THEN
        len := jsonb_array_length(p_new_transactions);
        FOR i IN 0 .. (len - 1)
        LOOP
            tx_data := p_new_transactions->i;
            
            INSERT INTO transactions (
                user_id, account_id, amount, date, description, category, 
                type, is_recurring, series_id, frequency, recurrence_day, total_installments, current_installment
            ) VALUES (
                (tx_data->>'user_id')::UUID,
                (tx_data->>'account_id')::UUID,
                (tx_data->>'amount')::NUMERIC,
                (tx_data->>'date')::DATE,
                tx_data->>'description',
                tx_data->>'category',
                tx_data->>'type',
                (tx_data->>'is_recurring')::BOOLEAN,
                (tx_data->>'series_id')::UUID,
                tx_data->>'frequency',
                (tx_data->>'recurrence_day')::INT,
                (tx_data->>'total_installments')::INT,
                (tx_data->>'current_installment')::INT
            );
        END LOOP;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. ENSURE TRIGGERS ARE LINKED to correct function
-- We just updated 'notify_trip_invite' in place. 
-- The trigger 'trig_notify_trip_invite' calls it. It should be fine.
-- Just in case, drop and re-create trigger.
DROP TRIGGER IF EXISTS trig_notify_trip_invite ON public.trips;
CREATE TRIGGER trig_notify_trip_invite
AFTER INSERT OR UPDATE OF participants ON public.trips
FOR EACH ROW
EXECUTE FUNCTION notify_trip_invite();
