-- ==============================================================================
-- DIAGNÓSTICO E CORREÇÃO DE PERFIS DE USUÁRIO
-- Data: 2025-12-19
-- ==============================================================================

-- 1. DIAGNÓSTICO: Ver todos os usuários do auth.users e seus perfis
SELECT 
    au.id as auth_user_id,
    au.email as auth_email,
    au.raw_user_meta_data->>'name' as auth_meta_name,
    up.id as profile_id,
    up.name as profile_name,
    up.email as profile_email
FROM auth.users au
LEFT JOIN public.user_profiles up ON up.id = au.id
ORDER BY au.created_at DESC;

-- 2. DIAGNÓSTICO: Usuários SEM perfil criado
SELECT 
    au.id,
    au.email,
    au.raw_user_meta_data->>'name' as meta_name,
    au.created_at
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = au.id);

-- 3. CORREÇÃO: Criar perfis faltantes para todos os usuários
INSERT INTO public.user_profiles (id, name, email, created_at, updated_at)
SELECT 
    au.id,
    COALESCE(
        au.raw_user_meta_data->>'name',
        split_part(au.email, '@', 1)
    ) as name,
    au.email,
    au.created_at,
    NOW()
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.user_profiles WHERE id = au.id)
ON CONFLICT (id) DO NOTHING;

-- 4. CORREÇÃO: Atualizar perfis existentes com nome vazio
UPDATE public.user_profiles up
SET 
    name = COALESCE(
        (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = up.id),
        split_part(up.email, '@', 1),
        'Usuário'
    ),
    updated_at = NOW()
WHERE up.name IS NULL OR up.name = '';

-- 5. CORREÇÃO: Atualizar email nos perfis se estiver faltando
UPDATE public.user_profiles up
SET 
    email = (SELECT email FROM auth.users WHERE id = up.id),
    updated_at = NOW()
WHERE up.email IS NULL 
  AND EXISTS (SELECT 1 FROM auth.users WHERE id = up.id);

-- 6. VERIFICAR: Membros familiares com linked_user_id
SELECT 
    fm.id as member_id,
    fm.user_id as owner_id,
    fm.name as member_name,
    fm.email as member_email,
    fm.linked_user_id,
    up.name as linked_profile_name,
    up.email as linked_profile_email,
    au.email as linked_auth_email,
    au.raw_user_meta_data->>'name' as linked_auth_meta_name
FROM public.family_members fm
LEFT JOIN public.user_profiles up ON up.id = fm.linked_user_id
LEFT JOIN auth.users au ON au.id = fm.linked_user_id
WHERE fm.linked_user_id IS NOT NULL
ORDER BY fm.created_at DESC;

-- 7. CORREÇÃO: Atualizar membros familiares com "Novo Membro Familiar"
UPDATE public.family_members fm
SET 
    name = COALESCE(
        (SELECT name FROM public.user_profiles WHERE id = fm.linked_user_id),
        (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = fm.linked_user_id),
        split_part((SELECT email FROM auth.users WHERE id = fm.linked_user_id), '@', 1),
        fm.name
    ),
    email = COALESCE(
        fm.email,
        (SELECT email FROM public.user_profiles WHERE id = fm.linked_user_id),
        (SELECT email FROM auth.users WHERE id = fm.linked_user_id)
    ),
    updated_at = NOW()
WHERE fm.linked_user_id IS NOT NULL
  AND (fm.name = 'Novo Membro Familiar' OR fm.name IS NULL OR fm.name = '');

-- 8. RESULTADO FINAL: Verificar membros familiares após correção
SELECT 
    fm.id,
    fm.name as member_name,
    fm.email as member_email,
    up.name as profile_name,
    up.email as profile_email
FROM public.family_members fm
LEFT JOIN public.user_profiles up ON up.id = fm.linked_user_id
WHERE fm.linked_user_id IS NOT NULL
ORDER BY fm.created_at DESC;
