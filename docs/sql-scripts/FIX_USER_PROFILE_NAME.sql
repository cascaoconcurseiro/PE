-- ==============================================================================
-- FIX: Corrigir criação de perfil de usuário para usar nome do cadastro
-- Data: 2025-12-19
-- Problema: Quando usuário A adiciona usuário B como membro familiar,
--           no lado do B aparece "Novo Membro Familiar" ao invés do nome de A
-- Causa: A função handle_new_user não estava usando o nome dos metadados
-- ==============================================================================

-- 1. Atualizar a função handle_new_user para usar o nome dos metadados
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS TRIGGER AS $$
DECLARE
    v_name TEXT;
BEGIN
    -- Tentar pegar o nome dos metadados do usuário (enviado no signup)
    v_name := NEW.raw_user_meta_data->>'name';
    
    -- Se não tiver nome nos metadados, usar a parte antes do @ do email
    IF v_name IS NULL OR v_name = '' THEN
        v_name := split_part(NEW.email, '@', 1);
    END IF;
    
    -- Inserir o perfil
    INSERT INTO public.user_profiles (id, name, email) 
    VALUES (NEW.id, v_name, NEW.email) 
    ON CONFLICT (id) DO UPDATE SET
        name = COALESCE(EXCLUDED.name, user_profiles.name),
        email = COALESCE(EXCLUDED.email, user_profiles.email),
        updated_at = NOW();
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Atualizar perfis existentes que têm nome nos metadados mas não no perfil
-- (Corrige usuários que já se cadastraram)
UPDATE public.user_profiles up
SET name = COALESCE(
    (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = up.id),
    up.name
)
WHERE up.name IS NULL 
   OR up.name = '' 
   OR up.name = split_part(up.email, '@', 1);

-- 3. Também atualizar a função de link bidirecional para ter fallback melhor
CREATE OR REPLACE FUNCTION public.ensure_reverse_family_member_link()
RETURNS TRIGGER AS $$
DECLARE
    v_initiator_name TEXT;
    v_initiator_email TEXT;
BEGIN
    -- Only proceed if we have a linked_user_id (The member is a real system user)
    IF NEW.linked_user_id IS NOT NULL THEN
        
        -- Check if the reverse link already exists
        IF NOT EXISTS (
            SELECT 1 FROM public.family_members 
            WHERE user_id = NEW.linked_user_id 
            AND linked_user_id = NEW.user_id
        ) THEN
            -- Get Initiator Name from user_profiles
            SELECT name, email INTO v_initiator_name, v_initiator_email
            FROM public.user_profiles 
            WHERE id = NEW.user_id;

            -- Fallback: tentar pegar dos metadados do auth.users
            IF v_initiator_name IS NULL OR v_initiator_name = '' THEN
                SELECT raw_user_meta_data->>'name', email 
                INTO v_initiator_name, v_initiator_email
                FROM auth.users 
                WHERE id = NEW.user_id;
            END IF;
            
            -- Fallback final: usar parte do email
            IF v_initiator_name IS NULL OR v_initiator_name = '' THEN
                v_initiator_name := split_part(COALESCE(v_initiator_email, 'usuario'), '@', 1);
            END IF;

            -- Create the Reverse Link (User B -> User A)
            INSERT INTO public.family_members (
                id,
                user_id,
                name,
                role,
                email,
                linked_user_id,
                sync_status
            ) VALUES (
                gen_random_uuid(),
                NEW.linked_user_id,
                v_initiator_name,
                'Parceiro(a)',
                v_initiator_email,
                NEW.user_id,
                'SYNCED'
            );

            RAISE NOTICE 'Reverse family link created: User % -> User % (name: %)', 
                NEW.linked_user_id, NEW.user_id, v_initiator_name;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Corrigir membros familiares existentes com nome "Novo Membro Familiar"
UPDATE public.family_members fm
SET name = COALESCE(
    (SELECT name FROM public.user_profiles WHERE id = fm.linked_user_id),
    (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = fm.linked_user_id),
    split_part((SELECT email FROM public.user_profiles WHERE id = fm.linked_user_id), '@', 1),
    fm.name
)
WHERE fm.name = 'Novo Membro Familiar'
  AND fm.linked_user_id IS NOT NULL;

-- Verificar resultado
SELECT 
    fm.id,
    fm.name as member_name,
    fm.email as member_email,
    up.name as profile_name,
    up.email as profile_email
FROM public.family_members fm
LEFT JOIN public.user_profiles up ON up.id = fm.linked_user_id
WHERE fm.linked_user_id IS NOT NULL
ORDER BY fm.created_at DESC
LIMIT 20;
