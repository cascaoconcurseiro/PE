-- 1. Create Audit Logs Table
create table if not exists public.audit_logs (
    id uuid not null default gen_random_uuid() primary key,
    table_name text not null,
    record_id uuid not null,
    operation text not null, -- 'INSERT', 'UPDATE', 'DELETE'
    old_values jsonb,
    new_values jsonb,
    changed_by uuid default auth.uid(),
    changed_at timestamptz not null default now()
);

-- 2. Security (RLS)
alter table public.audit_logs enable row level security;

-- Only Allow Read Access to the user who performed the action OR the owner of the data (if we could determine it easily).
-- For now, simplistic policy: Users can see logs of changes *they* made, or we might want them to see changes to *their* data.
-- Since this is an audit log for disputes, it's important to see what OTHERS did.
-- We will link via the 'user_id' in the json payload if possible, or reliance on the fact that family members share data.
-- A safe start: Allow read if you are authenticated. (Refine later for privacy if needed).
create policy "Users can view audit logs"
    on public.audit_logs for select
    to authenticated
    using (true); 

-- No one can insert/update/delete audit logs manually via API.
-- Logs are created ONLY by Triggers (Security Definer).

-- 3. Universal Audit Trigger Function
create or replace function public.fn_audit_log_changes()
returns trigger
language plpgsql
security definer
as $$
begin
    insert into public.audit_logs (
        table_name,
        record_id,
        operation,
        old_values,
        new_values,
        changed_by
    )
    values (
        TG_TABLE_NAME::text,
        coalesce(
            case when TG_OP = 'DELETE' then OLD.id else NEW.id end,
            gen_random_uuid() -- Fallback if no ID (should not happen on our tables)
        ),
        TG_OP,
        case when TG_OP in ('UPDATE', 'DELETE') then row_to_json(OLD) else null end,
        case when TG_OP in ('INSERT', 'UPDATE') then row_to_json(NEW) else null end,
        auth.uid()
    );
    return null; -- Result is ignored for AFTER triggers
end;
$$;

-- 4. Apply Triggers to Critical Tables

-- Transactions (The most disputed items)
drop trigger if exists tr_audit_transactions on public.transactions;
create trigger tr_audit_transactions
    after insert or update or delete on public.transactions
    for each row execute function public.fn_audit_log_changes();

-- Accounts (Balance and settings)
drop trigger if exists tr_audit_accounts on public.accounts;
create trigger tr_audit_accounts
    after insert or update or delete on public.accounts
    for each row execute function public.fn_audit_log_changes();

-- Family Members (Security/Access)
drop trigger if exists tr_audit_family_members on public.family_members;
create trigger tr_audit_family_members
    after insert or update or delete on public.family_members
    for each row execute function public.fn_audit_log_changes();

-- Trips (Shared contexts)
drop trigger if exists tr_audit_trips on public.trips;
create trigger tr_audit_trips
    after insert or update or delete on public.trips
    for each row execute function public.fn_audit_log_changes();
