-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. User Profiles (Public profile info linked to Auth)
create table public.user_profiles (
  id uuid references auth.users not null primary key,
  email text,
  name text,
  avatar_url text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null,
  sync_status text default 'SYNCED',
  deleted boolean default false
);
alter table public.user_profiles enable row level security;
create policy "Users can view own profile" on public.user_profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.user_profiles for update using (auth.uid() = id);

-- 2. Accounts
create table public.accounts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  type text not null,
  balance numeric default 0,
  initial_balance numeric default 0,
  currency text default 'BRL',
  "limit" numeric, -- limit is a reserved keyword, quoted
  closing_day integer,
  due_day integer,
  is_international boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.accounts enable row level security;
create policy "Users can CRUD own accounts" on public.accounts for all using (auth.uid() = user_id);

-- 3. Trips
create table public.trips (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  start_date date,
  end_date date,
  budget numeric default 0,
  currency text default 'BRL',
  image_url text,
  participants jsonb default '[]',
  itinerary jsonb default '[]',
  checklist jsonb default '[]',
  shopping_list jsonb default '[]',
  exchange_entries jsonb default '[]',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.trips enable row level security;
create policy "Users can CRUD own trips" on public.trips for all using (auth.uid() = user_id);

-- 4. Transactions
create table public.transactions (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  description text not null,
  amount numeric not null,
  type text not null, -- INCOME, EXPENSE, TRANSFER
  date date not null,
  category text,
  account_id uuid references public.accounts(id),
  destination_account_id uuid references public.accounts(id),
  trip_id uuid references public.trips(id),
  currency text default 'BRL',
  
  -- Recurrence
  is_recurring boolean default false,
  frequency text,
  recurrence_day integer,
  last_generated timestamp with time zone,
  
  -- Installments
  is_installment boolean default false,
  current_installment integer,
  total_installments integer,
  original_amount numeric,
  series_id uuid,
  
  -- Sharing/Splitting
  is_shared boolean default false,
  shared_with jsonb,
  payer_id uuid,
  is_settled boolean default false,
  is_refund boolean default false,
  
  -- Metadata
  observation text,
  enable_notification boolean default false,
  notification_date date,
  
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.transactions enable row level security;
create policy "Users can CRUD own transactions" on public.transactions for all using (auth.uid() = user_id);

-- 5. Goals
create table public.goals (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  target_amount numeric not null,
  current_amount numeric default 0,
  deadline date,
  icon text,
  color text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.goals enable row level security;
create policy "Users can CRUD own goals" on public.goals for all using (auth.uid() = user_id);

-- 6. Budgets
create table public.budgets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  category_id text not null,
  amount numeric not null,
  period text default 'MONTHLY',
  alert_threshold numeric default 80,
  rollover boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.budgets enable row level security;
create policy "Users can CRUD own budgets" on public.budgets for all using (auth.uid() = user_id);

-- 7. Family Members
create table public.family_members (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  role text,
  email text,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.family_members enable row level security;
create policy "Users can CRUD own family members" on public.family_members for all using (auth.uid() = user_id);

-- 8. Assets (Investments)
create table public.assets (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  ticker text not null,
  name text,
  type text,
  quantity numeric default 0,
  average_price numeric default 0,
  current_price numeric default 0,
  currency text default 'BRL',
  last_update timestamp with time zone,
  trade_history jsonb default '[]',
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.assets enable row level security;
create policy "Users can CRUD own assets" on public.assets for all using (auth.uid() = user_id);

-- 9. Custom Categories
create table public.custom_categories (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  name text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()),
  updated_at timestamp with time zone default timezone('utc'::text, now()),
  deleted boolean default false,
  sync_status text default 'SYNCED'
);
alter table public.custom_categories enable row level security;
create policy "Users can CRUD own categories" on public.custom_categories for all using (auth.uid() = user_id);

-- 10. Snapshots (History)
create table public.snapshots (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  date date not null,
  total_balance numeric default 0,
  total_invested numeric default 0,
  total_debt numeric default 0,
  net_worth numeric default 0,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.snapshots enable row level security;
create policy "Users can CRUD own snapshots" on public.snapshots for all using (auth.uid() = user_id);

-- 11. Audit Logs
create table public.audit_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users not null,
  entity text not null,
  entity_id uuid not null,
  action text not null,
  changes jsonb,
  created_at timestamp with time zone default timezone('utc'::text, now())
);
alter table public.audit_logs enable row level security;
create policy "Users can insert audit logs" on public.audit_logs for insert with check (auth.uid() = user_id);
create policy "Users can view own audit logs" on public.audit_logs for select using (auth.uid() = user_id);
