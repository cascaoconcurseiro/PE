-- ==============================================================================
-- FIX: UPDATE TRIGGERS TO USE 'metadata' COLUMN
-- Context: We renamed 'data' to 'metadata' to support legacy invite RPCs.
-- Now we must update the new v2 triggers to also use 'metadata'.
-- ==============================================================================

-- 1. Redefine notify_new_shared_transaction
CREATE OR REPLACE FUNCTION notify_new_shared_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_sender_name TEXT;
BEGIN
    IF NEW.mirror_transaction_id IS NOT NULL AND NEW.is_shared = TRUE THEN
        SELECT COALESCE(up.name, 'Alguém') INTO v_sender_name
        FROM transactions t
        LEFT JOIN user_profiles up ON up.id = t.user_id
        WHERE t.id = NEW.mirror_transaction_id;

        -- Check if target user exists in auth.users to avoid FK violation
        IF EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
            INSERT INTO public.user_notifications (user_id, type, title, message, metadata) -- Changed data -> metadata
            VALUES (
                NEW.user_id, 
                'TRANSACTION', 
                'Nova Despesa Compartilhada', 
                COALESCE(v_sender_name, 'Alguém') || ' compartilhou: ' || COALESCE(NEW.description, 'Nova Despesa') || ' (' || COALESCE(to_char(NEW.amount, 'FM999G999G990D00'), 'R$ 0,00') || ')',
                jsonb_build_object('transactionId', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency)
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$;

-- 2. Redefine notify_trip_invite
CREATE OR REPLACE FUNCTION notify_trip_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_participants JSONB;
    v_participant RECORD;
    v_user_id UUID;
    v_sender_name TEXT;
BEGIN
    SELECT COALESCE(name, 'Alguém') INTO v_sender_name FROM user_profiles WHERE id = NEW.user_id;
    
    IF (TG_OP = 'INSERT') THEN
         FOR v_participant IN SELECT jsonb_array_elements(NEW.participants) AS elem
         LOOP
             -- Check if user exists (is a real auth user, not just a profile/member stub)
             IF v_user_id <> NEW.user_id AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
                 INSERT INTO public.user_notifications (user_id, type, title, message, metadata) -- Changed data -> metadata
                 VALUES (
                    v_user_id,
                    'TRIP',
                    'Convite de Viagem',
                    COALESCE(v_sender_name, 'Alguém') || ' adicionou você na viagem: ' || COALESCE(NEW.name, 'sem nome'),
                    jsonb_build_object('tripId', NEW.id)
                 );
             END IF;
         END LOOP;
    ELSIF (TG_OP = 'UPDATE') THEN
         FOR v_participant IN SELECT jsonb_array_elements(NEW.participants) AS elem
         LOOP
             v_user_id := (v_participant.elem->>'id')::UUID;
             IF NOT EXISTS (
                 SELECT 1 FROM jsonb_array_elements(OLD.participants) old_p 
                 WHERE (old_p->>'id')::UUID = v_user_id
             ) THEN
                 -- Check if user exists
                 IF v_user_id <> NEW.user_id AND EXISTS (SELECT 1 FROM auth.users WHERE id = v_user_id) THEN
                     INSERT INTO public.user_notifications (user_id, type, title, message, metadata) -- Changed data -> metadata
                     VALUES (
                        v_user_id,
                        'TRIP',
                        'Convite de Viagem',
                        COALESCE(v_sender_name, 'Alguém') || ' adicionou você na viagem: ' || COALESCE(NEW.name, 'sem nome'),
                        jsonb_build_object('tripId', NEW.id)
                     );
                 END IF;
             END IF;
         END LOOP;
    END IF;

    RETURN NEW;
END;
$$;
