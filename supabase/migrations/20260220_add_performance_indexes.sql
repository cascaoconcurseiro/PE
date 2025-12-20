-- ==============================================================================
-- MIGRATION: ADICIONAR ÍNDICES DE PERFORMANCE
-- DATA: 2026-02-20
-- OBJETIVO: Otimizar queries frequentes sem remover índices existentes
-- ESTRATÉGIA: Adicionar apenas se não existir (seguro)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: ÍNDICES PARA TRANSACTIONS (Queries mais frequentes)
-- ==============================================================================

-- Índice composto para dashboard (user + date + não deletado)
-- Query: SELECT * FROM transactions WHERE user_id = ? AND date >= ? AND date <= ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_active 
  ON transactions(user_id, date DESC, deleted) 
  WHERE deleted = false;

-- Índice para filtros por conta (account_id + não deletado)
-- Query: SELECT * FROM transactions WHERE account_id = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_account_active 
  ON transactions(account_id, date DESC) 
  WHERE account_id IS NOT NULL AND deleted = false;

-- Índice para transferências (destination_account_id + não deletado)
-- Query: SELECT * FROM transactions WHERE destination_account_id = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_destination_active 
  ON transactions(destination_account_id, date DESC) 
  WHERE destination_account_id IS NOT NULL AND deleted = false;

-- Índice para transações por tipo e usuário
-- Query: SELECT * FROM transactions WHERE user_id = ? AND type = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_user_type_active 
  ON transactions(user_id, type, date DESC) 
  WHERE deleted = false;

-- Índice para transações compartilhadas ativas
-- Query: SELECT * FROM transactions WHERE user_id = ? AND is_shared = true AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_user_shared_active 
  ON transactions(user_id, is_shared, date DESC) 
  WHERE is_shared = true AND deleted = false;

-- Índice para transações por viagem
-- Query: SELECT * FROM transactions WHERE trip_id = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_trip_active 
  ON transactions(trip_id, date DESC) 
  WHERE trip_id IS NOT NULL AND deleted = false;

-- Índice para parcelamentos (series_id)
-- Query: SELECT * FROM transactions WHERE series_id = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_transactions_series_active 
  ON transactions(series_id, current_installment) 
  WHERE series_id IS NOT NULL AND deleted = false;

-- ==============================================================================
-- PARTE 2: ÍNDICES PARA ACCOUNTS
-- ==============================================================================

-- Índice composto para contas por usuário e tipo
-- Query: SELECT * FROM accounts WHERE user_id = ? AND type = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_accounts_user_type_active 
  ON accounts(user_id, type, name) 
  WHERE deleted = false;

-- Índice para busca por nome de conta
-- Query: SELECT * FROM accounts WHERE user_id = ? AND name ILIKE ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_accounts_user_name_active 
  ON accounts(user_id, LOWER(name)) 
  WHERE deleted = false;

-- ==============================================================================
-- PARTE 3: ÍNDICES PARA TRANSACTION_SPLITS
-- ==============================================================================

-- Índice composto para splits por transação
-- Query: SELECT * FROM transaction_splits WHERE transaction_id = ?
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_member 
  ON transaction_splits(transaction_id, member_id);

-- Índice para splits por membro
-- Query: SELECT * FROM transaction_splits WHERE member_id = ?
CREATE INDEX IF NOT EXISTS idx_transaction_splits_member_settled 
  ON transaction_splits(member_id, is_settled, created_at DESC);

-- Índice para splits por usuário (para receivables/payables)
-- Query: SELECT * FROM transaction_splits WHERE user_id = ? AND is_settled = false
CREATE INDEX IF NOT EXISTS idx_transaction_splits_user_pending 
  ON transaction_splits(user_id, is_settled, assigned_amount) 
  WHERE is_settled = false;

-- Índice para splits não liquidados (para relatórios)
-- Query: SELECT * FROM transaction_splits WHERE is_settled = false
CREATE INDEX IF NOT EXISTS idx_transaction_splits_pending_amount 
  ON transaction_splits(is_settled, assigned_amount DESC, created_at DESC) 
  WHERE is_settled = false;

-- ==============================================================================
-- PARTE 4: ÍNDICES PARA FAMILY_MEMBERS
-- ==============================================================================

-- Índice para membros por usuário
-- Query: SELECT * FROM family_members WHERE user_id = ? AND NOT deleted
CREATE INDEX IF NOT EXISTS idx_family_members_user_active 
  ON family_members(user_id, name) 
  WHERE deleted = false;

-- Índice para linked_user_id (para resolução de splits)
-- Query: SELECT * FROM family_members WHERE linked_user_id = ?
CREATE INDEX IF NOT EXISTS idx_family_members_linked_user 
  ON family_members(linked_user_id) 
  WHERE linked_user_id IS NOT NULL;

-- ==============================================================================
-- PARTE 5: ÍNDICES PARA TRIPS
-- ==============================================================================

-- Índice para viagens por usuário e data
-- Query: SELECT * FROM trips WHERE user_id = ? AND NOT deleted ORDER BY start_date DESC
CREATE INDEX IF NOT EXISTS idx_trips_user_date_active 
  ON trips(user_id, start_date DESC, end_date DESC) 
  WHERE deleted = false;

-- Índice para viagens ativas (sem data de fim ou futuras)
-- Query: SELECT * FROM trips WHERE user_id = ? AND (end_date IS NULL OR end_date >= CURRENT_DATE)
CREATE INDEX IF NOT EXISTS idx_trips_user_active_period 
  ON trips(user_id, end_date) 
  WHERE deleted = false AND (end_date IS NULL OR end_date >= CURRENT_DATE);

-- ==============================================================================
-- PARTE 6: ÍNDICES PARA ASSETS (se existir)
-- ==============================================================================

-- Verificar se tabela assets existe antes de criar índices
DO $
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assets') THEN
    -- Índice para assets por usuário
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_user_active 
             ON assets(user_id, name) 
             WHERE deleted = false';
    
    -- Índice para assets por tipo
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_assets_user_type_active 
             ON assets(user_id, type, current_value DESC) 
             WHERE deleted = false';
    
    RAISE NOTICE 'Índices para assets criados com sucesso';
  ELSE
    RAISE NOTICE 'Tabela assets não existe, pulando índices relacionados';
  END IF;
END $;

-- ==============================================================================
-- PARTE 7: ÍNDICES PARA PERFORMANCE DE AGREGAÇÕES
-- ==============================================================================

-- Índice para cálculo rápido de saldos por conta
-- Usado em: SUM(amount) GROUP BY account_id
CREATE INDEX IF NOT EXISTS idx_transactions_balance_calc 
  ON transactions(account_id, amount, type) 
  WHERE deleted = false AND account_id IS NOT NULL;

-- Índice para cálculo de totais por período
-- Usado em: SUM(amount) WHERE date BETWEEN ? AND ?
CREATE INDEX IF NOT EXISTS idx_transactions_period_totals 
  ON transactions(user_id, date, amount, type) 
  WHERE deleted = false;

-- Índice para estatísticas por categoria
-- Usado em: SUM(amount) GROUP BY category WHERE type = 'DESPESA'
CREATE INDEX IF NOT EXISTS idx_transactions_category_stats 
  ON transactions(user_id, category, amount, date DESC) 
  WHERE deleted = false AND type = 'DESPESA';

-- ==============================================================================
-- PARTE 8: VALIDAÇÃO E RELATÓRIO
-- ==============================================================================

-- Função para verificar uso dos índices
CREATE OR REPLACE FUNCTION check_index_usage()
RETURNS TABLE(
  index_name TEXT,
  table_name TEXT,
  size_mb NUMERIC,
  scans BIGINT,
  tuples_read BIGINT,
  tuples_fetched BIGINT
) AS $
BEGIN
  RETURN QUERY
  SELECT 
    i.indexrelname::TEXT,
    t.relname::TEXT,
    ROUND(pg_relation_size(i.indexrelid) / 1024.0 / 1024.0, 2),
    s.idx_scan,
    s.idx_tup_read,
    s.idx_tup_fetch
  FROM pg_stat_user_indexes s
  JOIN pg_class i ON i.oid = s.indexrelid
  JOIN pg_class t ON t.oid = s.relid
  WHERE i.indexrelname LIKE 'idx_%'
  ORDER BY s.idx_scan DESC;
END;
$ LANGUAGE plpgsql;

-- Log de conclusão
DO $
DECLARE
  index_count INTEGER;
BEGIN
  -- Contar índices criados nesta migration
  SELECT COUNT(*) INTO index_count
  FROM pg_indexes 
  WHERE indexname LIKE 'idx_%' 
  AND tablename IN ('transactions', 'accounts', 'transaction_splits', 'family_members', 'trips');
  
  RAISE NOTICE '=== ÍNDICES DE PERFORMANCE ADICIONADOS ===';
  RAISE NOTICE 'Total de índices otimizados: %', index_count;
  RAISE NOTICE 'Tabelas otimizadas: transactions, accounts, transaction_splits, family_members, trips';
  RAISE NOTICE 'Para monitorar uso: SELECT * FROM check_index_usage();';
  RAISE NOTICE 'Migration concluída com sucesso!';
END $;

COMMIT;

-- ==============================================================================
-- NOTAS DE PERFORMANCE:
-- ==============================================================================
-- 1. Todos os índices usam "IF NOT EXISTS" para segurança
-- 2. Índices parciais (WHERE) reduzem tamanho e melhoram performance
-- 3. Ordem das colunas otimizada para queries mais frequentes
-- 4. Índices compostos cobrem múltiplas condições de filtro
-- 5. Função check_index_usage() para monitoramento
-- ==============================================================================