-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║                    PEMEIA - SCHEMA CONSOLIDADO v1.0                          ║
-- ║                    Data: 2024-12-10                                           ║
-- ║                    Arquivo único com todo o schema do banco                   ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 1: LIMPEZA (APENAS PARA RESET TOTAL - CUIDADO!)
-- ═══════════════════════════════════════════════════════════════════════════════

-- DROP TABLES (Descomente apenas se quiser resetar TUDO)
-- DROP TABLE IF EXISTS public.transactions CASCADE;
-- DROP TABLE IF EXISTS public.accounts CASCADE;
-- DROP TABLE IF EXISTS public.trips CASCADE;
-- DROP TABLE IF EXISTS public.assets CASCADE;
-- DROP TABLE IF EXISTS public.goals CASCADE;
-- DROP TABLE IF EXISTS public.budgets CASCADE;
-- DROP TABLE IF EXISTS public.family_members CASCADE;
-- DROP TABLE IF EXISTS public.custom_categories CASCADE;
-- DROP TABLE IF EXISTS public.snapshots CASCADE;
-- DROP TABLE IF EXISTS public.audit_logs CASCADE;
-- DROP TABLE IF EXISTS public.user_profiles CASCADE;
-- DROP TABLE IF EXISTS public.user_settings CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 2: TABELAS PRINCIPAIS
-- ═══════════════════════════════════════════════════════════════════════════════

-- 1. USER PROFILES (Perfil do Usuário - Vinculado ao Auth)
CREATE TABLE IF NOT EXISTS public.user_profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT,
    name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

-- 2. ACCOUNTS (Contas Bancárias e Cartões)
CREATE TABLE IF NOT EXISTS public.accounts (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'CONTA CORRENTE', 'POUPANÇA', 'CARTÃO DE CRÉDITO', 'DINHEIRO', 'INVESTIMENTOS'
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    initial_balance NUMERIC DEFAULT 0,
    credit_limit NUMERIC DEFAULT 0, -- Para cartões de crédito
    closing_day INTEGER, -- Dia de fechamento da fatura
    due_day INTEGER, -- Dia de vencimento
    is_international BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

-- 3. TRANSACTIONS (Transações Financeiras)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    description TEXT NOT NULL,
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    type TEXT NOT NULL, -- 'RECEITA', 'DESPESA', 'TRANSFERÊNCIA'
    category TEXT NOT NULL,
    account_id TEXT, -- UUID ou 'EXTERNAL'
    destination_account_id TEXT, -- Para transferências
    trip_id TEXT, -- Vinculo com viagem
    currency TEXT DEFAULT 'BRL',
    
    -- Recorrência
    is_recurring BOOLEAN DEFAULT FALSE,
    frequency TEXT, -- 'Única', 'Diária', 'Semanal', 'Mensal', 'Anual'
    recurrence_day INTEGER,
    last_generated DATE,
    series_id TEXT, -- Agrupa parcelas/recorrências
    
    -- Parcelamento
    is_installment BOOLEAN DEFAULT FALSE,
    current_installment INTEGER,
    total_installments INTEGER,
    original_amount NUMERIC, -- Valor total antes de parcelar
    
    -- Compartilhamento
    observation TEXT,
    is_shared BOOLEAN DEFAULT FALSE,
    shared_with JSONB DEFAULT '[]'::jsonb, -- [{memberId, percentage, assignedAmount, isSettled, settledAt}]
    payer_id TEXT, -- Quem pagou (ID do membro ou 'me')
    related_member_id TEXT, -- Membro relacionado ao acerto
    is_settled BOOLEAN DEFAULT FALSE,
    settled_at TIMESTAMP WITH TIME ZONE,
    
    -- Notificações
    enable_notification BOOLEAN DEFAULT FALSE,
    notification_date DATE,
    
    -- Estorno
    is_refund BOOLEAN DEFAULT FALSE,
    
    -- Multi-moeda
    destination_amount NUMERIC,
    exchange_rate NUMERIC,
    
    -- Sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

-- 4. TRIPS (Viagens)
CREATE TABLE IF NOT EXISTS public.trips (
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

-- 5. ASSETS (Investimentos)
CREATE TABLE IF NOT EXISTS public.assets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    ticker TEXT NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL, -- 'AÇÃO', 'FII', 'RENDA_FIXA', 'CRYPTO', 'ETF'
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

-- 6. GOALS (Metas Financeiras)
CREATE TABLE IF NOT EXISTS public.goals (
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

-- 7. BUDGETS (Orçamentos por Categoria)
CREATE TABLE IF NOT EXISTS public.budgets (
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

-- 8. FAMILY MEMBERS (Membros da Família para Compartilhamento)
CREATE TABLE IF NOT EXISTS public.family_members (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    role TEXT,
    email TEXT,
    linked_user_id UUID, -- Se vinculado a outro usuário do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

-- 9. CUSTOM CATEGORIES (Categorias Personalizadas)
CREATE TABLE IF NOT EXISTS public.custom_categories (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    sync_status TEXT DEFAULT 'SYNCED'
);

-- 10. SNAPSHOTS (Histórico Patrimonial)
CREATE TABLE IF NOT EXISTS public.snapshots (
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

-- 11. AUDIT LOGS (Log de Alterações)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    action TEXT NOT NULL,
    changes JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. USER SETTINGS (Configurações do Usuário)
CREATE TABLE IF NOT EXISTS public.user_settings (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    theme TEXT DEFAULT 'system',
    language TEXT DEFAULT 'pt-BR',
    currency TEXT DEFAULT 'BRL',
    notifications_enabled BOOLEAN DEFAULT TRUE,
    show_values BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 3: ROW LEVEL SECURITY (RLS)
-- ═══════════════════════════════════════════════════════════════════════════════

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas de Acesso (usuário só acessa seus próprios dados)
DROP POLICY IF EXISTS "owner_access_user_profiles" ON public.user_profiles;
CREATE POLICY "owner_access_user_profiles" ON public.user_profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS "owner_access_accounts" ON public.accounts;
CREATE POLICY "owner_access_accounts" ON public.accounts FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_transactions" ON public.transactions;
CREATE POLICY "owner_access_transactions" ON public.transactions FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_trips" ON public.trips;
CREATE POLICY "owner_access_trips" ON public.trips FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_assets" ON public.assets;
CREATE POLICY "owner_access_assets" ON public.assets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_goals" ON public.goals;
CREATE POLICY "owner_access_goals" ON public.goals FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_budgets" ON public.budgets;
CREATE POLICY "owner_access_budgets" ON public.budgets FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_family_members" ON public.family_members;
CREATE POLICY "owner_access_family_members" ON public.family_members FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_custom_categories" ON public.custom_categories;
CREATE POLICY "owner_access_custom_categories" ON public.custom_categories FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_snapshots" ON public.snapshots;
CREATE POLICY "owner_access_snapshots" ON public.snapshots FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_audit_logs" ON public.audit_logs;
CREATE POLICY "owner_access_audit_logs" ON public.audit_logs FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "owner_access_user_settings" ON public.user_settings;
CREATE POLICY "owner_access_user_settings" ON public.user_settings FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 4: TRIGGERS E FUNÇÕES
-- ═══════════════════════════════════════════════════════════════════════════════

-- 4.1 TRIGGER: Criar perfil automaticamente ao criar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, name, email)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email
  )
  ON CONFLICT (id) DO NOTHING;
  
  INSERT INTO public.user_settings (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 4.2 TRIGGER: Atualizar saldo da conta automaticamente (PARTIDAS DOBRADAS)
CREATE OR REPLACE FUNCTION update_account_balance_v4()
RETURNS TRIGGER AS $$
BEGIN
    -- INSERTS
    IF (TG_OP = 'INSERT') THEN
        IF NEW.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
            IF NEW.destination_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + COALESCE(NEW.destination_amount, NEW.amount) WHERE id::text = NEW.destination_account_id::text;
            END IF;
        END IF;
        RETURN NEW;

    -- DELETES
    ELSIF (TG_OP = 'DELETE') THEN
        IF OLD.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
            IF OLD.destination_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance - COALESCE(OLD.destination_amount, OLD.amount) WHERE id::text = OLD.destination_account_id::text;
            END IF;
        END IF;
        RETURN OLD;

    -- UPDATES
    ELSIF (TG_OP = 'UPDATE') THEN
        -- Reverter OLD
        IF OLD.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
            IF OLD.destination_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance - COALESCE(OLD.destination_amount, OLD.amount) WHERE id::text = OLD.destination_account_id::text;
            END IF;
        END IF;

        -- Aplicar NEW
        IF NEW.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
            IF NEW.destination_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + COALESCE(NEW.destination_amount, NEW.amount) WHERE id::text = NEW.destination_account_id::text;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_update_account_balance ON transactions;
DROP TRIGGER IF EXISTS tr_update_account_balance_v4 ON transactions;
CREATE TRIGGER tr_update_account_balance_v4
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_account_balance_v4();

-- ═══════════════════════════════════════════════════════════════════════════════
-- PARTE 5: ÍNDICES PARA PERFORMANCE
-- ═══════════════════════════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_deleted ON transactions(deleted);
CREATE INDEX IF NOT EXISTS idx_transactions_series_id ON transactions(series_id);

CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_type ON accounts(type);
CREATE INDEX IF NOT EXISTS idx_accounts_deleted ON accounts(deleted);

CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_trips_user_id ON trips(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON goals(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_assets_user_id ON assets(user_id);

-- ═══════════════════════════════════════════════════════════════════════════════
-- FIM DO SCHEMA CONSOLIDADO
-- ═══════════════════════════════════════════════════════════════════════════════
