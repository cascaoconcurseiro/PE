-- 1. Habilitar extensão UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Garantir Tabelas e Colunas do Sistema Financeiro
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    "limit" NUMERIC,
    closing_day INTEGER,
    due_day INTEGER,
    is_international BOOLEAN DEFAULT FALSE,
    initial_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL,
    category TEXT NOT NULL,
    account_id TEXT,
    destination_account_id TEXT,
    trip_id TEXT,
    currency TEXT DEFAULT 'BRL',
    is_recurring BOOLEAN DEFAULT FALSE,
    frequency TEXT,
    recurrence_day INTEGER,
    last_generated TEXT,
    is_installment BOOLEAN DEFAULT FALSE,
    current_installment INTEGER,
    total_installments INTEGER,
    original_amount NUMERIC,
    series_id TEXT,
    enable_notification BOOLEAN DEFAULT FALSE,
    notification_date DATE,
    observation TEXT,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with JSONB DEFAULT '[]'::jsonb,
    payer_id TEXT,
    is_settled BOOLEAN DEFAULT FALSE,
    is_refund BOOLEAN DEFAULT FALSE,
    destination_amount NUMERIC,
    exchange_rate NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.trips (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    destination TEXT,
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

CREATE TABLE IF NOT EXISTS public.goals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    target_amount NUMERIC NOT NULL,
    current_amount NUMERIC DEFAULT 0,
    deadline DATE,
    icon TEXT,
    color TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.budgets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    period TEXT DEFAULT 'MONTHLY',
    alert_threshold INTEGER DEFAULT 80,
    rollover BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.assets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    quantity NUMERIC NOT NULL,
    average_price NUMERIC NOT NULL,
    current_price NUMERIC NOT NULL,
    currency TEXT DEFAULT 'BRL',
    account_id TEXT,
    last_update TIMESTAMP WITH TIME ZONE,
    trade_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    avatar TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.custom_categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

CREATE TABLE IF NOT EXISTS public.snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
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

-- 3. Aplicar Políticas de Segurança (RLS)
DO $$ 
DECLARE 
    tbl text; 
    tables text[] := ARRAY['accounts', 'transactions', 'trips', 'goals', 'budgets', 'assets', 'family_members', 'custom_categories', 'snapshots'];
BEGIN 
    FOREACH tbl IN ARRAY tables
    LOOP 
        -- Habilita RLS se a tabela existir
        IF EXISTS (SELECT FROM pg_tables WHERE schemaname = 'public' AND tablename = tbl) THEN
            EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
            
            -- Remove políticas antigas para evitar conflitos ao re-executar
            EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own %I" ON %I', tbl, tbl); 
            
            -- Cria nova política restritiva
            EXECUTE format('CREATE POLICY "Users can manage their own %I" ON %I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id)', tbl, tbl); 
        END IF;
    END LOOP; 
END $$;