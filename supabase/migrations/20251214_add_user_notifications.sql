-- ==============================================================================
-- MIGRATION: USER NOTIFICATIONS (INFORMATIONAL)
-- DATA: 2025-12-14
-- DESCRIÇÃO: Tabela de notificações e triggers para alertar compartilhamentos
-- ==============================================================================

-- 1. Create table
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    type TEXT NOT NULL, -- 'TRANSACTION', 'TRIP', 'ALERT', 'SYSTEM'
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}'::jsonb,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_user_notifications_user_id ON public.user_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON public.user_notifications(user_id) WHERE read = FALSE;

-- RLS
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own notifications"
ON public.user_notifications
FOR ALL
USING (auth.uid() = user_id);

-- 2. TRIGGER: Notify New Shared Transaction (Mirror)
CREATE OR REPLACE FUNCTION notify_new_shared_transaction()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_sender_name TEXT;
BEGIN
    -- Only fire for Mirrors (have mirror_transaction_id) created by OTHERS (user_id != payer_id usually, but mirror logic inserts with user_id = target)
    -- We can check if is_shared = true and mirror_transaction_id is NOT NULL.
    
    IF NEW.mirror_transaction_id IS NOT NULL AND NEW.is_shared = TRUE THEN
        -- Resolve Sender Name (The one who created the original)
        -- The original tx ID is NEW.mirror_transaction_id.
        -- Use a subquery to find owner of original tx
        SELECT COALESCE(up.name, 'Alguém') INTO v_sender_name
        FROM transactions t
        LEFT JOIN user_profiles up ON up.id = t.user_id
        WHERE t.id = NEW.mirror_transaction_id;

        INSERT INTO public.user_notifications (user_id, type, title, message, data)
        VALUES (
            NEW.user_id, 
            'TRANSACTION', 
            'Nova Despesa Compartilhada', 
            COALESCE(v_sender_name, 'Alguém') || ' compartilhou: ' || NEW.description || ' (' || to_char(NEW.amount, 'FM999G999G990D00') || ')',
            jsonb_build_object('transactionId', NEW.id, 'amount', NEW.amount, 'currency', NEW.currency)
        );
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_notify_shared_tx ON public.transactions;
CREATE TRIGGER trig_notify_shared_tx
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION notify_new_shared_transaction();


-- 3. TRIGGER: Notify Trip Invite
CREATE OR REPLACE FUNCTION notify_trip_invite()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_participants JSONB;
    v_participant RECORD;
    v_user_id UUID;
    v_sender_name TEXT;
BEGIN
    -- Detect new participants
    -- Logic: Iterate NEW.participants, check if in OLD.participants (if update)
    
    -- Get sender name (Owner of trip)
    SELECT COALESCE(name, 'Alguém') INTO v_sender_name FROM user_profiles WHERE id = NEW.user_id;
    
    IF (TG_OP = 'INSERT') THEN
         FOR v_participant IN SELECT * FROM jsonb_array_elements(NEW.participants)
         LOOP
             v_user_id := (v_participant->>'id')::UUID;
             -- Don't notify self
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
         END LOOP;
    ELSIF (TG_OP = 'UPDATE') THEN
         -- For generic JSONB array comparison, we iterate NEW and check existence in OLD
         FOR v_participant IN SELECT * FROM jsonb_array_elements(NEW.participants)
         LOOP
             v_user_id := (v_participant->>'id')::UUID;
             
             -- Check if existed in OLD
             IF NOT EXISTS (
                 SELECT 1 FROM jsonb_array_elements(OLD.participants) old_p 
                 WHERE (old_p->>'id')::UUID = v_user_id
             ) THEN
                 -- It's new!
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
         END LOOP;
    END IF;

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trig_notify_trip_invite ON public.trips;
CREATE TRIGGER trig_notify_trip_invite
AFTER INSERT OR UPDATE OF participants ON public.trips
FOR EACH ROW
EXECUTE FUNCTION notify_trip_invite();
