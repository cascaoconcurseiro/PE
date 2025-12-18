-- ==============================================================================
-- SCRIPT DE VERIFICAÇÃO: Confirmar que a migration foi aplicada
-- Execute este script para verificar se tudo foi criado corretamente
-- ==============================================================================

-- 1. Verificar constraints criadas
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  conrelid::regclass as table_name
FROM pg_constraint
WHERE conname IN ('check_account_type', 'check_transaction_type')
ORDER BY conname;

-- 2. Verificar índices criados
SELECT 
  indexname,
  tablename,
  indexdef
FROM pg_indexes
WHERE indexname IN (
  'idx_transactions_user_date',
  'idx_transactions_account',
  'idx_transactions_type',
  'idx_transactions_destination',
  'idx_transaction_splits_transaction',
  'idx_transaction_splits_member',
  'idx_transaction_splits_settled',
  'idx_accounts_user_type',
  'idx_ledger_entries_transaction',
  'idx_ledger_entries_account'
)
ORDER BY tablename, indexname;

-- 3. Verificar trigger de validação de splits
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers
WHERE trigger_name = 'trg_validate_splits';

-- 4. Verificar função de validação
SELECT 
  routine_name,
  routine_type,
  data_type
FROM information_schema.routines
WHERE routine_name = 'validate_transaction_splits';

-- 5. Verificar view de saúde do sistema
SELECT 
  table_name,
  table_type
FROM information_schema.tables
WHERE table_name = 'view_system_health';

-- 6. Testar view de saúde (ver se há problemas)
SELECT * FROM view_system_health
ORDER BY issue_type;

-- 7. Verificar triggers de updated_at
SELECT 
  trigger_name,
  event_object_table
FROM information_schema.triggers
WHERE trigger_name LIKE 'trg_update_%_updated_at'
ORDER BY event_object_table;

