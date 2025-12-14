-- EMERGENCY INSTALLATION SCRIPT
-- DATE: 2025-01-09
-- INSTRUCTIONS: Run this ENTIRE SCRIPT in the Supabase SQL Editor.

-- 1. SAFE FACTORY RESET (Fixes Error 1)
CREATE OR REPLACE FUNCTION reset_own_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;

    -- Delete in order of dependency
    DELETE FROM public.transactions WHERE user_id = v_user_id;
    DELETE FROM public.trips WHERE user_id = v_user_id;
    DELETE FROM public.user_notifications WHERE user_id = v_user_id;
    DELETE FROM public.shared_transaction_requests WHERE sender_id = v_user_id;
    DELETE FROM public.accounts WHERE user_id = v_user_id;
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;
    DELETE FROM public.goals WHERE user_id = v_user_id;
    DELETE FROM public.budgets WHERE user_id = v_user_id;
    DELETE FROM public.ledger_entries WHERE user_id = v_user_id;
    DELETE FROM public.assets WHERE user_id = v_user_id;
END;
$$;

-- 2. HELPER: Check User Email (Dependency for Invite)
CREATE OR REPLACE FUNCTION check_user_by_email(email_to_check TEXT) 
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE found_user_id UUID;
BEGIN 
    SELECT id INTO found_user_id FROM auth.users WHERE lower(email) = lower(email_to_check); 
    RETURN found_user_id; 
END;
$$;

-- 3. FUNCTION INVITE USER (Fixes Error 2)
-- Note: Replaces older definition with correct update logic
CREATE OR REPLACE FUNCTION invite_user_to_family(p_member_id UUID, p_email TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    target_user_id UUID;
BEGIN
    -- 1. Check if user exists
    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower(p_email);
    
    IF target_user_id IS NULL THEN
        -- Return failure JSON so frontend can handle it nicely
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado no sistema.');
    END IF;

    -- 2. Link the user
    UPDATE public.family_members 
    SET 
        linked_user_id = target_user_id, 
        email = lower(p_email), 
        updated_at = NOW() 
    WHERE id = p_member_id;

    -- 3. Notify the invited user
    INSERT INTO public.user_notifications (user_id, type, title, message, data, is_read, created_at)
    VALUES (
        target_user_id, 
        'INVITE', 
        'Novo Convite', 
        'Alguém te adicionou como membro familiar.', 
        jsonb_build_object('memberId', p_member_id), 
        false, 
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Convite enviado com sucesso!');
EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- 4. FORCE REFRESH SCHEMA CACHE
NOTIFY pgrst, 'reload schema';
