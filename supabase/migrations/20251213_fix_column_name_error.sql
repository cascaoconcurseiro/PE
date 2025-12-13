CREATE OR REPLACE FUNCTION handle_auto_connection_lifecycle()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id UUID;
    existing_member_id UUID;
BEGIN
    -- Busca se o email cadastrado pertence a um usuário real do sistema
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = NEW.email
    LIMIT 1;

    -- Se for um usuário real
    IF target_user_id IS NOT NULL THEN
        
        -- Atualiza o registro atual para ter o link
        UPDATE family_members SET linked_user_id = target_user_id WHERE id = NEW.id;

        -- LÓGICA REVERSA: Verificar se o outro usuário já tem o User A (Criador)
        SELECT id INTO existing_member_id
        FROM family_members
        WHERE user_id = target_user_id AND (linked_user_id = NEW.user_id OR email = (SELECT email FROM auth.users WHERE id = NEW.user_id));

        IF existing_member_id IS NOT NULL THEN
             -- CORREÇÃO: Usar 'connection_status' ao invés de 'status'
             UPDATE family_members SET linked_user_id = NEW.user_id, connection_status = 'ACTIVE' 
             WHERE id = existing_member_id;
        ELSE
             -- Se não existe, CRIA O VÍNCULO REVERSO AUTOMATICAMENTE
             INSERT INTO family_members (user_id, name, email, linked_user_id, role, connection_status)
             SELECT 
                target_user_id, 
                (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = NEW.user_id),
                (SELECT email FROM auth.users WHERE id = NEW.user_id),
                NEW.user_id,
                'PARCEIRO(A)', -- Role padrão
                'ACTIVE';
        END IF;
    END IF;

    RETURN NEW;
END;
$$;
