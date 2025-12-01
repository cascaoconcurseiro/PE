-- DANGER: DROPPING ALL TABLES TO START FRESH
DROP TABLE IF EXISTS public.transactions CASCADE;
DROP TABLE IF EXISTS public.accounts CASCADE;
DROP TABLE IF EXISTS public.trips CASCADE;
DROP TABLE IF EXISTS public.assets CASCADE;
DROP TABLE IF EXISTS public.goals CASCADE;
DROP TABLE IF EXISTS public.budgets CASCADE;
DROP TABLE IF EXISTS public.family_members CASCADE;
DROP TABLE IF EXISTS public.custom_categories CASCADE;
DROP TABLE IF EXISTS public.snapshots CASCADE;
DROP TABLE IF EXISTS public.audit_logs CASCADE;
DROP TABLE IF EXISTS public.user_profiles CASCADE;
-- Clean up old tables if they exist (legacy)
DROP TABLE IF EXISTS public.profiles CASCADE; 
DROP TABLE IF EXISTS public.credit_cards CASCADE;
DROP TABLE IF EXISTS public.invoices CASCADE;
DROP TABLE IF EXISTS public.invoice_items CASCADE;

-- 1. Profiles (Linked to Auth)
CREATE TABLE public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_user_profiles" ON public.user_profiles FOR ALL TO authenticated USING (id = (select auth.uid())) WITH CHECK (id = (select auth.uid()));

-- 2. Accounts
CREATE TABLE public.accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    initial_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0, -- Mapped correctly from frontend 'limit'
    closing_day INTEGER,
    due_day INTEGER,
    is_international BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_accounts" ON public.accounts FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 3. Transactions
CREATE TABLE public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    account_id TEXT, -- Loose reference to allow 'EXTERNAL' or UUID
    destination_account_id TEXT,
    trip_id TEXT,
    currency TEXT DEFAULT 'BRL',
    
    -- Recurrence
    is_recurring BOOLEAN DEFAULT FALSE,
    frequency TEXT,
    recurrence_day INTEGER,
    last_generated DATE,
    series_id TEXT,
    
    -- Installments
    is_installment BOOLEAN DEFAULT FALSE,
    current_installment INTEGER,
    total_installments INTEGER,
    original_amount NUMERIC,
    
    -- Shared / Details
    observation TEXT,
    enable_notification BOOLEAN DEFAULT FALSE,
    notification_date DATE,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with JSONB DEFAULT '[]'::jsonb,
    payer_id TEXT,
    related_member_id TEXT,
    is_settled BOOLEAN DEFAULT FALSE,
    is_refund BOOLEAN DEFAULT FALSE,
    
    -- Multi-currency
    destination_amount NUMERIC,
    exchange_rate NUMERIC,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 4. Trips
CREATE TABLE public.trips (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    start_date DATE,
    end_date DATE,
    budget NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    image_url TEXT,
    participants JSONB DEFAULT '[]'::jsonb,
    itinerary JSONB DEFAULT '[]'::jsonb,
    checklist JSONB DEFAULT '[]'::jsonb,
    shopping_list JSONB DEFAULT '[]'::jsonb,
    exchange_entries JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_trips" ON public.trips FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 5. Assets
CREATE TABLE public.assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity NUMERIC DEFAULT 0,
    average_price NUMERIC DEFAULT 0,
    current_price NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    account_id TEXT,
    last_update TIMESTAMP WITH TIME ZONE,
    trade_history JSONB DEFAULT '[]'::jsonb,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_assets" ON public.assets FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 6. Goals
CREATE TABLE public.goals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    target_amount NUMERIC DEFAULT 0,
    current_amount NUMERIC DEFAULT 0,
    deadline DATE,
    icon TEXT,
    color TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_goals" ON public.goals FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 7. Budgets
CREATE TABLE public.budgets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    category_id TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    period TEXT DEFAULT 'MONTHLY',
    alert_threshold INTEGER DEFAULT 80,
    rollover BOOLEAN DEFAULT FALSE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_budgets" ON public.budgets FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 8. Family Members
CREATE TABLE public.family_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_family_members" ON public.family_members FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 9. Custom Categories
CREATE TABLE public.custom_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_custom_categories" ON public.custom_categories FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 10. Snapshots
CREATE TABLE public.snapshots (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    date DATE NOT NULL,
    total_balance NUMERIC DEFAULT 0,
    total_invested NUMERIC DEFAULT 0,
    total_debt NUMERIC DEFAULT 0,
    net_worth NUMERIC DEFAULT 0,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_snapshots" ON public.snapshots FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- 11. Audit Logs
CREATE TABLE public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "owner_access_audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (user_id = (select auth.uid())) WITH CHECK (user_id = (select auth.uid()));

-- Triggers for Auto Profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, email)
  VALUES (
    new.id, 
    COALESCE(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();