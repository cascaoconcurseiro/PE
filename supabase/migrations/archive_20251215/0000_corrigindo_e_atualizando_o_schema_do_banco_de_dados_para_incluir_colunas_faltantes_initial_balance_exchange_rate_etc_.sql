-- 1. Corrigir tabela ACCOUNTS
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS initial_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT FALSE;

-- 2. Corrigir tabela TRANSACTIONS
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS destination_amount NUMERIC,
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC,
ADD COLUMN IF NOT EXISTS destination_account_id UUID,
ADD COLUMN IF NOT EXISTS trip_id UUID,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS frequency TEXT,
ADD COLUMN IF NOT EXISTS recurrence_day INTEGER,
ADD COLUMN IF NOT EXISTS last_generated TEXT,
ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_installment INTEGER,
ADD COLUMN IF NOT EXISTS total_installments INTEGER,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
ADD COLUMN IF NOT EXISTS series_id TEXT,
ADD COLUMN IF NOT EXISTS enable_notification BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_date DATE,
ADD COLUMN IF NOT EXISTS observation TEXT,
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payer_id TEXT,
ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT FALSE;

-- Converter shared_with para JSONB se for outro tipo (para suportar objetos complexos)
-- Isso evita erros se a coluna foi criada como ARRAY de texto anteriormente
ALTER TABLE public.transactions 
DROP COLUMN IF EXISTS shared_with;

ALTER TABLE public.transactions 
ADD COLUMN shared_with JSONB DEFAULT '[]'::jsonb;

-- 3. Corrigir tabela TRIPS
ALTER TABLE public.trips
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS participants JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS itinerary JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS checklist JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS shopping_list JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS exchange_entries JSONB DEFAULT '[]'::jsonb;

-- 4. Corrigir tabela ASSETS
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS account_id UUID,
ADD COLUMN IF NOT EXISTS last_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trade_history JSONB DEFAULT '[]'::jsonb;

-- 5. Garantir tabelas auxiliares que podem não existir
CREATE TABLE IF NOT EXISTS public.custom_categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;

-- Política de segurança para categorias personalizadas
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'custom_categories' AND policyname = 'Users can manage their own custom_categories'
    ) THEN
        CREATE POLICY "Users can manage their own custom_categories" ON public.custom_categories FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;

-- 6. Garantir Snapshot
CREATE TABLE IF NOT EXISTS public.snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'snapshots' AND policyname = 'Users can manage their own snapshots'
    ) THEN
        CREATE POLICY "Users can manage their own snapshots" ON public.snapshots FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
    END IF;
END
$$;