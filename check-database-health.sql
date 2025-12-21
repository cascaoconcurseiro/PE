-- ==============================================================================
-- SCRIPT DE VERIFICAÇÃO DA SAÚDE DO BANCO DE DADOS
-- DATA: 2025-12-21
-- OBJETIVO: Verificar estado atual e performance do banco
-- ==============================================================================

-- 1. Verificar índices existentes
SELECT 
  schemaname,
  tablename,
  indexname,
  pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;

-- 2. Verificar saúde do sistema (se view existir)
DO $
BEGIN
  IF EXISTS (SELECT FROM information_schema.views WHERE table_name = 'view_system_health') THEN
    RAISE NOTICE 'Verificando saúde do sistema...';
    PERFORM * FROM view_system_health;
  ELSE
    RAISE NOTICE 'View view_system_health não existe ainda';
  END IF;
END $;

-- 3. Verificar tamanho das tabelas principais
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
  pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('transactions', 'accounts', 'transaction_splits', 'trips', 'family_members')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- 4. Verificar constraints existentes
SELECT 
  tc.table_name,
  tc.constraint_name,
  tc.constraint_type,
  cc.check_clause
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.check_constraints cc 
  ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public'
  AND tc.table_name IN ('transactions', 'accounts')
  AND tc.constraint_type IN ('CHECK', 'FOREIGN KEY')
ORDER BY tc.table_name, tc.constraint_type;

-- 5. Verificar colunas UUID (se existirem)
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'transactions'
  AND column_name LIKE '%_uuid'
ORDER BY column_name;

-- 6. Contar registros nas tabelas principais
SELECT 
  'transactions' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE deleted = false) as active_records
FROM transactions
UNION ALL
SELECT 
  'accounts' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE deleted = false) as active_records
FROM accounts
UNION ALL
SELECT 
  'transaction_splits' as table_name,
  COUNT(*) as total_records,
  COUNT(*) FILTER (WHERE is_settled = false) as pending_records
FROM transaction_splits
ORDER BY table_name;