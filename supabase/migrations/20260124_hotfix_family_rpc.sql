-- ==============================================================================
-- HOTFIX: FAMILY INVITE RPC SIGNATURE
-- DATA: 2026-01-24
-- OBJ: Corrigir erro "Could not find the function invite_user_to_family(email_to_invite, member_id)".
--      Causa: O cliente envia parâmetros com nomes diferentes da definição no banco (p_member_id vs member_id).
-- ==============================================================================

BEGIN;

-- Drop versions with potential signature conflicts (to be safe)
DROP FUNCTION IF EXISTS public.invite_user_to_family(uuid, text);

-- Recreate with CLIENT MATCHING parameter names
CREATE OR REPLACE FUNCTION public.invite_user_to_family(
    member_id UUID, 
    email_to_invite TEXT
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE 
    target_user_id UUID;
    sender_name TEXT;
    v_requester_id UUID := auth.uid();
BEGIN
    -- 1. Check if user exists
    SELECT id INTO target_user_id FROM auth.users WHERE lower(email) = lower(email_to_invite);
    
    IF target_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado no sistema Supabase Auth.');
    END IF;

    -- 1.1 Get Sender Name
    SELECT name INTO sender_name FROM public.user_profiles WHERE id = v_requester_id;
    IF sender_name IS NULL THEN sender_name := 'Alguém'; END IF;

    -- 2. Link the user (Update Params used here)
    UPDATE public.family_members 
    SET 
        linked_user_id = target_user_id, 
        email = lower(email_to_invite), 
        updated_at = NOW() 
    WHERE id = member_id AND user_id = v_requester_id; -- Security: Check ownership

    IF NOT FOUND THEN
         RETURN jsonb_build_object('success', false, 'message', 'Membro familiar não encontrado ou acesso negado.');
    END IF;

    -- 3. Notify the invited user
    INSERT INTO public.user_notifications (user_id, type, title, message, data, read, created_at)
    VALUES (
        target_user_id, 
        'INVITE', 
        'Novo Convite', 
        sender_name || ' te adicionou como membro familiar.', 
        jsonb_build_object('memberId', member_id), 
        false, 
        NOW()
    );

    RETURN jsonb_build_object('success', true, 'message', 'Convite enviado com sucesso!');

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object('success', false, 'message', SQLERRM);
END;
$$;

-- Force Cache Refresh
NOTIFY pgrst, 'reload schema';

COMMIT;
