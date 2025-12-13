-- FIX: Enable Notification System & Family Invites

-- 1. Create Notifications Table (if not exists)
CREATE TABLE IF NOT EXISTS public.user_notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('SYSTEM', 'INVITE', 'TRANSACTION', 'ALERT')),
    metadata JSONB DEFAULT '{}'::jsonb,
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS for Notifications
ALTER TABLE public.user_notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their notifications" ON public.user_notifications;
CREATE POLICY "Users can view their notifications" ON public.user_notifications
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their notifications" ON public.user_notifications;
CREATE POLICY "Users can update their notifications" ON public.user_notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 2. Add Link Column to Family Members
-- This allows us to map a local "Family Member" to a real "Auth User"
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'linked_user_id') THEN
        ALTER TABLE public.family_members ADD COLUMN linked_user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- 3. RPC: Check User By Email (Privacy Preserved)
-- Returns ID only if exists, useful for invites.
CREATE OR REPLACE FUNCTION public.check_user_by_email(email_to_check TEXT)
RETURNS UUID AS $$
DECLARE
    found_id UUID;
BEGIN
    SELECT id INTO found_id FROM auth.users WHERE email = email_to_check;
    RETURN found_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. RPC: Invite User to Family (Handle Notification)
CREATE OR REPLACE FUNCTION public.invite_user_to_family(p_member_id UUID, p_email TEXT)
RETURNS JSONB AS $$
DECLARE
    target_user_id UUID;
    inviter_name TEXT;
BEGIN
    -- 1. Find the target user by email
    SELECT id INTO target_user_id FROM auth.users WHERE email = p_email LIMIT 1;

    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado.');
    END IF;

    -- 2. Link the local family member to the real user
    UPDATE public.family_members
    SET linked_user_id = target_user_id,
        email = p_email
    WHERE id = p_member_id AND user_id = auth.uid(); -- Only if I own this member record

    -- 3. Get Inviter Name (for the message)
    SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = auth.uid();
    
    -- 4. Send Notification to Target
    INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
    VALUES (
        target_user_id,
        'Convite Familiar',
        'Você foi adicionado à família de ' || COALESCE(inviter_name, 'um usuário') || '.',
        'INVITE',
        jsonb_build_object('inviter_id', auth.uid(), 'member_id', p_member_id)
    );

    RETURN jsonb_build_object('success', true, 'message', 'Convite vinculado e usuário notificado!');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Trigger for SHARED TRANSACTION Notifications
CREATE OR REPLACE FUNCTION public.handle_shared_notification()
RETURNS TRIGGER AS $$
BEGIN
    -- Scenario: Mirror Transaction Insertion
    -- If a transaction is inserted for User B (NEW.user_id) but created by User A (auth.uid())
    IF (TG_OP = 'INSERT') AND (auth.uid() <> NEW.user_id) AND (NEW.is_shared = true) THEN
         INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
         VALUES (
            NEW.user_id,
            'Nova Despesa Compartilhada',
            'Uma nova despesa foi lançada: ' || COALESCE(NEW.description, 'Sem descrição'),
            'TRANSACTION',
            jsonb_build_object('transaction_id', NEW.id, 'amount', NEW.amount)
         );
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_shared_notification ON public.transactions;
CREATE TRIGGER trg_shared_notification
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_shared_notification();
