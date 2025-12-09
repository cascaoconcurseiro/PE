-- ========================================
-- SCRIPT DE RESET SIMPLIFICADO
-- ========================================
-- Para usar via psql ou SQL Editor
-- ========================================

BEGIN;

-- Deletar todos os dados (mantém estrutura)
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

-- Verificar resultado
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
