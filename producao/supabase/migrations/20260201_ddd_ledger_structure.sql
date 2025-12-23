-- ==============================================================================
-- MIGRATION: DDD DOUBLE ENTRY LEDGER (PART 1 - STRUCTURE)
-- DATA: 2026-02-01
-- DESCRIÇÃO: Implementação da estrutura de Partidas Dobradas (Double Entry).
--            1. Chart of Accounts (Plano de Contas Unificado).
--            2. Ledger Entries (O Agregado Raiz Imutável).
--            3. Preservação de Contexto (Trip, Shared, Domain).
-- ==============================================================================

BEGIN;

-- 1. PLANO DE CONTAS (CHART OF ACCOUNTS)
-- ------------------------------------------------------------------------------
-- Unifica Contas Reais (Ativos/Passivos) e Nominais (Receitas/Despesas)
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE')),
    code TEXT, -- Ex: 1.1.01 (Opcional, para ordenação contábil)
    parent_id UUID REFERENCES public.chart_of_accounts(id), -- Para hierarquia
    
    -- Links para o sistema legado (Para garantir paralalelismo)
    linked_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL, -- Para Ativos/Passivos
    linked_category TEXT, -- Para Receitas/Despesas (String legacy)
    
    is_system BOOLEAN DEFAULT FALSE, -- Contas raiz do sistema
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    
    CONSTRAINT code_unique_per_user UNIQUE (user_id, code) DEFERRABLE INITIALLY DEFERRED
);

CREATE INDEX idx_chart_accounts_user ON public.chart_of_accounts(user_id);
CREATE INDEX idx_chart_accounts_type ON public.chart_of_accounts(type);
CREATE INDEX idx_chart_accounts_mapping ON public.chart_of_accounts(linked_account_id, linked_category);

-- 2. LEDGER ENTRIES (PARTIDAS DOBRADAS - AGGREGATE ROOT)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID, -- Link para a transação original (Traceability)
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    
    -- O Core das Partidas Dobradas
    debit_account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
    credit_account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0), -- Sempre positivo. A direção é definida por Debit/Credit.
    
    -- Contexto Temporal Imutável
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL, -- Quando o fato ocorreu
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(), -- Quando foi registrado no sistema
    
    -- Contexto de Domínio (Critical for Shared/Trip preservation)
    domain TEXT DEFAULT 'PERSONAL' CHECK (domain IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS')),
    trip_id UUID, -- Referência direta para viagem (se houver)
    description TEXT,
    
    -- Rastreabilidade e Auditoria
    metadata JSONB DEFAULT '{}'::jsonb, -- Store tags, original raw data, shared details
    archived BOOLEAN DEFAULT FALSE, -- Soft delete lógico (Reverso)
    
    CONSTRAINT different_accounts CHECK (debit_account_id != credit_account_id)
);

CREATE INDEX idx_ledger_entries_transaction ON public.ledger_entries(transaction_id);
CREATE INDEX idx_ledger_entries_dates ON public.ledger_entries(occurred_at);
CREATE INDEX idx_ledger_entries_trip ON public.ledger_entries(trip_id);
CREATE INDEX idx_ledger_entries_accounts ON public.ledger_entries(debit_account_id, credit_account_id);


-- 3. FUNÇÃO DE MIGRAÇÃO: POPULAR PLANO DE CONTAS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_chart_of_accounts() 
RETURNS VOID AS $$
DECLARE
    r_account RECORD;
    r_cat RECORD;
BEGIN
    -- A. Migrar Contas Reais (Assets/Liabilities) da tabela 'accounts'
    FOR r_account IN SELECT * FROM public.accounts WHERE deleted = FALSE LOOP
        INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
        SELECT 
            r_account.user_id, 
            r_account.name, 
            CASE 
                WHEN r_account.type = 'CHECKING' OR r_account.type = 'CASH' OR r_account.type = 'INVESTMENT' THEN 'ASSET'
                WHEN r_account.type = 'CREDIT_CARD' OR r_account.type = 'LOAN' THEN 'LIABILITY'
                ELSE 'ASSET' -- Default safe
            END,
            r_account.id
        WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE linked_account_id = r_account.id);
    END LOOP;

    -- B. Migrar Categorias (Receitas/Despesas) da tabela 'transactions'
    -- Categorias de Receita
    FOR r_cat IN SELECT DISTINCT user_id, category FROM public.transactions WHERE type = 'RECEITA' AND category IS NOT NULL LOOP
        INSERT INTO public.chart_of_accounts (user_id, name, type, linked_category)
        SELECT r_cat.user_id, r_cat.category, 'REVENUE', r_cat.category
        WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE user_id = r_cat.user_id AND linked_category = r_cat.category AND type = 'REVENUE');
    END LOOP;

    -- Categorias de Despesa
    FOR r_cat IN SELECT DISTINCT user_id, category FROM public.transactions WHERE type = 'DESPESA' AND category IS NOT NULL LOOP
        INSERT INTO public.chart_of_accounts (user_id, name, type, linked_category)
        SELECT r_cat.user_id, r_cat.category, 'EXPENSE', r_cat.category
        WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE user_id = r_cat.user_id AND linked_category = r_cat.category AND type = 'EXPENSE');
    END LOOP;
    
    -- C. Criar Equity Account (Capital Inicial / Ajuste)
    INSERT INTO public.chart_of_accounts (user_id, name, type, code)
    SELECT DISTINCT id, 'Capital Inicial / Ajustes', 'EQUITY', '3.0.00'
    FROM auth.users
    WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE user_id = auth.users.id AND type = 'EQUITY');

END;
$$ LANGUAGE plpgsql;

-- Executar Migração Inicial da Estrutura
SELECT public.migrate_chart_of_accounts();


-- 4. FUNÇÃO DE MIGRAÇÃO: POPULAR LEDGER (DOUBLE ENTRY)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.migrate_legacy_transactions_to_ddd() 
RETURNS VOID AS $$
DECLARE
    t RECORD;
    v_debit_acc UUID;
    v_credit_acc UUID;
    v_trip_uuid UUID;
BEGIN
    FOR t IN SELECT * FROM public.transactions WHERE deleted = FALSE ORDER BY date ASC LOOP
        -- Resolver Trip ID (Safe Cast) - AGORA COM TIPAGEM ESTRITA
        v_trip_uuid := CASE WHEN t.trip_id::text~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN t.trip_id::text::uuid ELSE NULL END;

        -- 1. RECEITA: Debit ASSET (Banco), Credit REVENUE (Categoria)
        IF t.type = 'RECEITA' THEN
            -- Achar Conta Banco
            SELECT id INTO v_debit_acc FROM public.chart_of_accounts 
            WHERE linked_account_id::text = t.account_id::text AND type = 'ASSET';
            
            -- Achar Conta Receita
            SELECT id INTO v_credit_acc FROM public.chart_of_accounts 
            WHERE linked_category = t.category AND type = 'REVENUE' AND user_id = t.user_id;
            
            IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO public.ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, amount, 
                    occurred_at, domain, trip_id, description, metadata
                ) VALUES (
                    t.id, t.user_id, v_debit_acc, v_credit_acc, t.amount,
                    t.date, COALESCE(t.domain, 'PERSONAL'), v_trip_uuid, t.description, 
                    jsonb_build_object('legacy_type', 'RECEITA', 'shared', t.is_shared)
                );
            END IF;

        -- 2. DESPESA: Debit EXPENSE (Categoria), Credit ASSET/LIABILITY (Banco/Cartão)
        ELSIF t.type = 'DESPESA' THEN
            -- Achar Conta Despesa
            SELECT id INTO v_debit_acc FROM public.chart_of_accounts 
            WHERE linked_category = t.category AND type = 'EXPENSE' AND user_id = t.user_id;

            -- Achar Conta Pagamento (Asset ou Liability)
            SELECT id INTO v_credit_acc FROM public.chart_of_accounts 
            WHERE linked_account_id::text = t.account_id::text;
            
            IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO public.ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, amount, 
                    occurred_at, domain, trip_id, description, metadata
                ) VALUES (
                    t.id, t.user_id, v_debit_acc, v_credit_acc, t.amount,
                    t.date, COALESCE(t.domain, 'PERSONAL'), v_trip_uuid, t.description,
                    jsonb_build_object('legacy_type', 'DESPESA', 'shared', t.is_shared)
                );
            END IF;

        -- 3. TRANSFERÊNCIA: Debit ASSET (Destino), Credit ASSET (Origem)
        ELSIF t.type = 'TRANSFERÊNCIA' THEN
             -- Origem (Credit)
            SELECT id INTO v_credit_acc FROM public.chart_of_accounts 
            WHERE linked_account_id::text = t.account_id::text;
            
            -- Destino (Debit)
            SELECT id INTO v_debit_acc FROM public.chart_of_accounts 
            WHERE linked_account_id::text = t.destination_account_id::text;

            IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO public.ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, amount, 
                    occurred_at, domain, trip_id, description, metadata
                ) VALUES (
                    t.id, t.user_id, v_debit_acc, v_credit_acc, t.amount,
                    t.date, COALESCE(t.domain, 'PERSONAL'), v_trip_uuid, t.description,
                    jsonb_build_object('legacy_type', 'TRANSFERÊNCIA')
                );
            END IF;
        END IF;

    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Executar Carga Inicial
SELECT public.migrate_legacy_transactions_to_ddd();


-- 5. TRIGGER DE SINCRONIZAÇÃO CONTÍNUA (BIFROST)
-- ------------------------------------------------------------------------------
-- Mantém o Ledger DDD atualizado quando novas transações entram no legado.
CREATE OR REPLACE FUNCTION public.sync_transaction_to_ddd_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_debit_acc UUID;
    v_credit_acc UUID;
    v_trip_uuid UUID;
BEGIN
    -- Se DELETING ou UPDATING, remova a entry antiga para recriar
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        DELETE FROM public.ledger_entries WHERE transaction_id = OLD.id;
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
         v_trip_uuid := CASE WHEN NEW.trip_id::text~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NEW.trip_id::text::uuid ELSE NULL END;
         
         -- Garante que Categorias existam no Chart (Lazy Creation)
         IF NEW.category IS NOT NULL THEN
             IF NEW.type = 'RECEITA' THEN
                 INSERT INTO public.chart_of_accounts (user_id, name, type, linked_category)
                 SELECT NEW.user_id, NEW.category, 'REVENUE', NEW.category
                 WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE user_id = NEW.user_id AND linked_category = NEW.category AND type = 'REVENUE');
             ELSIF NEW.type = 'DESPESA' THEN
                 INSERT INTO public.chart_of_accounts (user_id, name, type, linked_category)
                 SELECT NEW.user_id, NEW.category, 'EXPENSE', NEW.category
                 WHERE NOT EXISTS (SELECT 1 FROM public.chart_of_accounts WHERE user_id = NEW.user_id AND linked_category = NEW.category AND type = 'EXPENSE');
             END IF;
         END IF;

         -- Lógica de Débito/Crédito (Precisa ser duplicada do migrate pois Trigger não pode chamar função que faz INSERT em loop)
         IF NEW.type = 'RECEITA' THEN
            SELECT id INTO v_debit_acc FROM public.chart_of_accounts WHERE linked_account_id::text = NEW.account_id::text AND type = 'ASSET';
            SELECT id INTO v_credit_acc FROM public.chart_of_accounts WHERE linked_category = NEW.category AND type = 'REVENUE' AND user_id = NEW.user_id;
         ELSIF NEW.type = 'DESPESA' THEN
            SELECT id INTO v_debit_acc FROM public.chart_of_accounts WHERE linked_category = NEW.category AND type = 'EXPENSE' AND user_id = NEW.user_id;
            SELECT id INTO v_credit_acc FROM public.chart_of_accounts WHERE linked_account_id::text = NEW.account_id::text;
         ELSIF NEW.type = 'TRANSFERÊNCIA' THEN
            SELECT id INTO v_credit_acc FROM public.chart_of_accounts WHERE linked_account_id::text = NEW.account_id::text;
            SELECT id INTO v_debit_acc FROM public.chart_of_accounts WHERE linked_account_id::text = NEW.destination_account_id::text;
         END IF;

         IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO public.ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, amount, 
                    occurred_at, domain, trip_id, description, metadata
                ) VALUES (
                    NEW.id, NEW.user_id, v_debit_acc, v_credit_acc, NEW.amount,
                    NEW.date, COALESCE(NEW.domain, 'PERSONAL'), v_trip_uuid, NEW.description,
                    jsonb_build_object('legacy_type', NEW.type, 'shared', NEW.is_shared, 'sync', 'realtime')
                );
         END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_ddd_ledger ON public.transactions;
CREATE TRIGGER trg_sync_ddd_ledger
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_transaction_to_ddd_ledger();

COMMIT;
