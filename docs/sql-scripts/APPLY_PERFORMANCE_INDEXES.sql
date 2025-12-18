-- ============================================================================
-- SCRIPT PARA APLICAR ÍNDICES DE PERFORMANCE
-- Execute este script no Supabase Dashboard > SQL Editor
-- IMPORTANTE: Execute cada bloco separadamente se der erro
-- ============================================================================

-- 1. Índice composto para busca de transações por período
DROP INDEX IF EXISTS idx_transactions_user_date_range;
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_range 
ON public.transactions(user_id, date DESC)
WHERE deleted = false;

-- 2. Índice para transações compartilhadas não liquidadas
DROP INDEX IF EXISTS idx_transactions_unsettled_shared;
CREATE INDEX IF NOT EXISTS idx_transactions_unsettled_shared
ON public.transactions(user_id, is_settled, date DESC)
WHERE deleted = false AND is_settled = false;

-- 3. Índice para contas ativas
DROP INDEX IF EXISTS idx_accounts_user_active;
CREATE INDEX IF NOT EXISTS idx_accounts_user_active
ON public.accounts(user_id, name)
WHERE deleted = false;

-- 4. Índice para viagens
DROP INDEX IF EXISTS idx_trips_user_active;
CREATE INDEX IF NOT EXISTS idx_trips_user_active
ON public.trips(user_id)
WHERE deleted = false;

-- 5. Índice para membros da família
DROP INDEX IF EXISTS idx_family_user_active;
CREATE INDEX IF NOT EXISTS idx_family_user_active
ON public.family_members(user_id)
WHERE deleted = false;

-- 6. Atualizar estatísticas
ANALYZE public.transactions;
ANALYZE public.accounts;
ANALYZE public.trips;
ANALYZE public.family_members;
