
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
