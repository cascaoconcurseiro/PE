-- ========================================
-- SCRIPT DE RESET COMPLETO DO SUPABASE
-- ========================================
-- ⚠️ ATENÇÃO: Este script irá DELETAR TODOS OS DADOS!
-- Execute no Supabase Dashboard > SQL Editor
-- ========================================

BEGIN;

-- 1. DELETAR TODOS OS DADOS (mantém estrutura)
-- ========================================

-- Deletar na ordem correta (respeitando foreign keys)
DELETE FROM public.snapshots;
DELETE FROM public.custom_categories;
DELETE FROM public.family_members;
DELETE FROM public.goals;
DELETE FROM public.budgets;
DELETE FROM public.assets;
DELETE FROM public.trips;
DELETE FROM public.transactions;
DELETE FROM public.accounts;
DELETE FROM public.profiles;

-- 2. RESETAR SEQUENCES (IDs voltam para 1)
-- ========================================

-- Não há sequences para resetar pois usamos UUIDs

-- 3. VERIFICAR RESULTADO
-- ========================================

-- Contar registros em cada tabela (deve ser 0)
SELECT 
    'profiles' as tabela, COUNT(*) as registros FROM public.profiles
UNION ALL
SELECT 'accounts', COUNT(*) FROM public.accounts
UNION ALL
SELECT 'transactions', COUNT(*) FROM public.transactions
UNION ALL
SELECT 'trips', COUNT(*) FROM public.trips
UNION ALL
SELECT 'assets', COUNT(*) FROM public.assets
UNION ALL
SELECT 'budgets', COUNT(*) FROM public.budgets
UNION ALL
SELECT 'goals', COUNT(*) FROM public.goals
UNION ALL
SELECT 'family_members', COUNT(*) FROM public.family_members
UNION ALL
SELECT 'custom_categories', COUNT(*) FROM public.custom_categories
UNION ALL
SELECT 'snapshots', COUNT(*) FROM public.snapshots;

COMMIT;

-- ========================================
-- MENSAGEM FINAL
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '✅ BANCO DE DADOS RESETADO COM SUCESSO!';
    RAISE NOTICE '';
    RAISE NOTICE 'Todas as tabelas foram esvaziadas.';
    RAISE NOTICE 'A estrutura do banco foi mantida.';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ Faça logout e login novamente no aplicativo.';
END $$;
