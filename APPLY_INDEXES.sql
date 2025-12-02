-- ========================================
-- PERFORMANCE INDEXES - APPLY THIS SCRIPT
-- ========================================
-- Execute este script no Supabase Dashboard > SQL Editor
-- Estes índices melhoram significativamente a performance das queries

-- Transactions indexes (tabela mais consultada)
create index if not exists idx_transactions_user_date on public.transactions(user_id, date desc) where deleted = false;
create index if not exists idx_transactions_account on public.transactions(account_id, deleted) where deleted = false;
create index if not exists idx_transactions_destination on public.transactions(destination_account_id) where destination_account_id is not null and deleted = false;
create index if not exists idx_transactions_trip on public.transactions(trip_id) where trip_id is not null and deleted = false;
create index if not exists idx_transactions_series on public.transactions(series_id) where series_id is not null and deleted = false;
create index if not exists idx_transactions_deleted on public.transactions(deleted, user_id);

-- Accounts indexes
create index if not exists idx_accounts_user on public.accounts(user_id, deleted) where deleted = false;
create index if not exists idx_accounts_type on public.accounts(type, user_id) where deleted = false;

-- Trips indexes
create index if not exists idx_trips_user_dates on public.trips(user_id, start_date, end_date) where deleted = false;

-- Assets indexes
create index if not exists idx_assets_user on public.assets(user_id, deleted) where deleted = false;
create index if not exists idx_assets_ticker on public.assets(ticker, user_id) where deleted = false;

-- Budgets indexes
create index if not exists idx_budgets_user_category on public.budgets(user_id, category_id) where deleted = false;

-- Goals indexes
create index if not exists idx_goals_user on public.goals(user_id, deleted) where deleted = false;

-- Family Members indexes
create index if not exists idx_family_user on public.family_members(user_id, deleted) where deleted = false;

-- Custom Categories indexes
create index if not exists idx_categories_user on public.custom_categories(user_id, deleted) where deleted = false;

-- Snapshots indexes
create index if not exists idx_snapshots_user_date on public.snapshots(user_id, date desc);

-- Audit Logs indexes
create index if not exists idx_audit_user_created on public.audit_logs(user_id, created_at desc);

-- Verificar índices criados
select 
    schemaname,
    tablename,
    indexname,
    indexdef
from pg_indexes
where schemaname = 'public'
order by tablename, indexname;
