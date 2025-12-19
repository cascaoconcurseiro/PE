-- ==============================================================================
-- DIAGNÓSTICO: SISTEMA DE NOTIFICAÇÕES
-- DATA: 2025-12-19
-- ==============================================================================

-- 1. Verificar se a tabela existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notifications'
) as table_exists;

-- 2. Ver estrutura da tabela
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_notifications'
ORDER BY ordinal_position;

-- 3. Contar notificações por usuário
SELECT 
    user_id,
    COUNT(*) as total,
    SUM(CASE WHEN is_read = false THEN 1 ELSE 0 END) as unread,
    SUM(CASE WHEN is_read = true THEN 1 ELSE 0 END) as read
FROM public.user_notifications
GROUP BY user_id;

-- 4. Ver notificações recentes
SELECT 
    id,
    user_id,
    type,
    title,
    LEFT(message, 50) as message_preview,
    is_read,
    created_at
FROM public.user_notifications
ORDER BY created_at DESC
LIMIT 20;

-- 5. Verificar RLS (Row Level Security)
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies
WHERE tablename = 'user_notifications';

-- 6. Verificar se há notificações duplicadas (mesmo seriesId)
SELECT 
    user_id,
    (metadata->>'seriesId') as series_id,
    COUNT(*) as count
FROM public.user_notifications
WHERE metadata->>'seriesId' IS NOT NULL
GROUP BY user_id, metadata->>'seriesId'
HAVING COUNT(*) > 1;

-- 7. Limpar notificações duplicadas (manter apenas a mais recente por série)
-- DESCOMENTE PARA EXECUTAR:
/*
DELETE FROM public.user_notifications n1
WHERE n1.metadata->>'seriesId' IS NOT NULL
  AND EXISTS (
      SELECT 1 FROM public.user_notifications n2
      WHERE n2.user_id = n1.user_id
        AND n2.metadata->>'seriesId' = n1.metadata->>'seriesId'
        AND n2.created_at > n1.created_at
  );
*/
