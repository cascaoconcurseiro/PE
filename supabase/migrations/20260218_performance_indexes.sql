-- ============================================================================
-- ÍNDICES DE PERFORMANCE OTIMIZADOS
-- Data: 2026-02-18
-- Objetivo: Acelerar as queries principais do sistema
-- ============================================================================

-- 1. TRANSACTIONS: Índice composto para a query principal (getTransactionsByRange)
-- Query: WHERE user_id = X AND deleted = false AND date >= Y AND date <= Z ORDER BY date DESC
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_user_date_range 
ON public.transactions(user_id, deleted, date DESC)
WHERE deleted = false;

-- 2. TRANSACTIONS: Índice para busca de transações compartilhadas não liquidadas
-- Query: WHERE user_id = X AND deleted = false AND is_settled = false AND (is_shared = true OR shared_with IS NOT NULL)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_transactions_unsettled_shared
ON public.transactions(user_id, is_settled, date DESC)
WHERE deleted = false AND is_settled = false AND (is_shared = true OR shared_with IS NOT NULL);

-- 3. ACCOUNTS: Índice para listagem de contas ativas
-- Query: WHERE user_id = X AND deleted = false ORDER BY name
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_accounts_user_active
ON public.accounts(user_id, name)
WHERE deleted = false;

-- 4. TRIPS: Índice para listagem de viagens do usuário
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_user_active
ON public.trips(user_id, created_at DESC)
WHERE deleted = false;

-- 5. FAMILY_MEMBERS: Índice para membros da família
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_family_user_active
ON public.family_members(user_id)
WHERE deleted = false;

-- 6. BUDGETS: Índice para orçamentos ativos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_budgets_user_active
ON public.budgets(user_id)
WHERE deleted = false;

-- 7. GOALS: Índice para metas ativas
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_goals_user_active
ON public.goals(user_id)
WHERE deleted = false;

-- 8. ASSETS: Índice para ativos
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assets_user_active
ON public.assets(user_id, ticker)
WHERE deleted = false;

-- ============================================================================
-- ANALYZE para atualizar estatísticas após criar índices
-- ============================================================================
ANALYZE public.transactions;
ANALYZE public.accounts;
ANALYZE public.trips;
ANALYZE public.family_members;
ANALYZE public.budgets;
ANALYZE public.goals;
ANALYZE public.assets;
