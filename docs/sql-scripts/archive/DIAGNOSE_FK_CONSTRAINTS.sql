-- ============================================================================
-- DIAGNÓSTICO DE FOREIGN KEYS
-- ============================================================================
-- Execute este script no Supabase SQL Editor para ver todas as FKs
-- ============================================================================

-- 1. Listar TODAS as Foreign Keys que referenciam transactions
SELECT 
    tc.table_name as tabela_origem,
    kcu.column_name as coluna,
    ccu.table_name AS tabela_referenciada,
    ccu.column_name AS coluna_referenciada,
    rc.delete_rule as on_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'transactions'
    AND tc.table_schema = 'public';

-- 2. Listar TODAS as Foreign Keys que referenciam accounts
SELECT 
    tc.table_name as tabela_origem,
    kcu.column_name as coluna,
    ccu.table_name AS tabela_referenciada,
    ccu.column_name AS coluna_referenciada,
    rc.delete_rule as on_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'accounts'
    AND tc.table_schema = 'public';

-- 3. Listar TODAS as Foreign Keys que referenciam trips
SELECT 
    tc.table_name as tabela_origem,
    kcu.column_name as coluna,
    ccu.table_name AS tabela_referenciada,
    ccu.column_name AS coluna_referenciada,
    rc.delete_rule as on_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'trips'
    AND tc.table_schema = 'public';

-- 4. Listar TODAS as tabelas do schema public
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- 5. Verificar se há transações com account_id que não existe
SELECT COUNT(*) as orphan_transactions
FROM transactions t
WHERE t.account_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id = t.account_id);

-- 6. Verificar FKs com RESTRICT (que bloqueiam deleção)
SELECT 
    tc.constraint_name,
    tc.table_name as tabela_origem,
    kcu.column_name as coluna,
    ccu.table_name AS tabela_referenciada,
    rc.delete_rule as on_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
ORDER BY ccu.table_name, tc.table_name;
