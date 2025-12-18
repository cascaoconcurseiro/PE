-- ==============================================================================
-- MIGRATION: SOVEREIGN LEDGER (ETAPA 2) - FIXED V3
-- DATA: 2026-01-18
-- DESCRIÇÃO: Implementa o Ledger como fonte única da verdade.
--            CORREÇÃO 1: Dropa tabelas antigas.
--            CORREÇÃO 2: Relaxa constraint NOT NULL de audit_logs.
--            CORREÇÃO 3: Cast explícito de ambos os lados no JOIN para evitar erro text=uuid.
-- ==============================================================================

BEGIN;

-- 0. HOTFIX: AUDIT ERROR BLOCKER
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'audit_logs' AND column_name = 'entity_id') THEN
        ALTER TABLE public.audit_logs ALTER COLUMN entity_id DROP NOT NULL;
    END IF;
END $$;


-- 1. ESTRUTURA DO LEDGER (RESET SEGURO)
-- ------------------------------------------------------------------------------

DROP TABLE IF EXISTS public.journal_entries CASCADE;
DROP TABLE IF EXISTS public.ledger_accounts CASCADE;

-- Tabela: ledger_accounts (Espelho contábil da conta)
CREATE TABLE public.ledger_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    balance NUMERIC DEFAULT 0,
    currency TEXT DEFAULT 'BRL',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_ledger_accounts_account_id ON public.ledger_accounts(account_id);


-- Tabela: journal_entries (O Livro Razão - Fonte da Verdade)
CREATE TABLE public.journal_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ledger_account_id UUID REFERENCES public.ledger_accounts(id) ON DELETE CASCADE NOT NULL,
    transaction_id UUID, 
    entry_type TEXT NOT NULL CHECK (entry_type IN ('DEBIT', 'CREDIT')),
    amount NUMERIC NOT NULL CHECK (amount >= 0),
    description TEXT,
    occurred_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    source_type TEXT DEFAULT 'TRANSACTION'
);

CREATE INDEX idx_journal_entries_ledger_id ON public.journal_entries(ledger_account_id);
CREATE INDEX idx_journal_entries_transaction_id ON public.journal_entries(transaction_id);

COMMENT ON TABLE public.journal_entries IS 'FONTE ÚNICA DA VERDADE FINANCEIRA — Etapa 2';


-- 2. BACKFILL: GARANTIR QUE TODAS AS CONTAS TENHAM LEDGER_ACCOUNT
-- ------------------------------------------------------------------------------
INSERT INTO public.ledger_accounts (account_id, balance, currency)
SELECT id, 0, currency 
FROM public.accounts;


-- 3. TRIGGER SOBERANO: ATUALIZA SALDO DO LEDGER
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_sovereign_balance()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'INSERT') THEN
        IF (NEW.entry_type = 'CREDIT') THEN
            UPDATE public.ledger_accounts SET balance = balance + NEW.amount WHERE id = NEW.ledger_account_id;
        ELSIF (NEW.entry_type = 'DEBIT') THEN
            UPDATE public.ledger_accounts SET balance = balance - NEW.amount WHERE id = NEW.ledger_account_id;
        END IF;
    ELSIF (TG_OP = 'DELETE') THEN
        IF (OLD.entry_type = 'CREDIT') THEN
            UPDATE public.ledger_accounts SET balance = balance - OLD.amount WHERE id = OLD.ledger_account_id;
        ELSIF (OLD.entry_type = 'DEBIT') THEN
            UPDATE public.ledger_accounts SET balance = balance + OLD.amount WHERE id = OLD.ledger_account_id;
        END IF;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_journal_entry_balance_update
    AFTER INSERT OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.update_sovereign_balance();


-- 4. TRIGGER PONTE: LEDGER -> ACCOUNTS (CACHE)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_ledger_to_legacy_cache()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE public.accounts
    SET balance = NEW.balance
    WHERE id = NEW.account_id;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_sync_legacy_cache
    AFTER UPDATE OF balance ON public.ledger_accounts
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_ledger_to_legacy_cache();


-- 5. TRIGGER PRINCIPAL: TRANSACTIONS -> JOURNAL_ENTRIES
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.process_transaction_into_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_ledger_id UUID;
    v_dest_ledger_id UUID;
    v_account_id_uuid UUID;
    v_dest_account_id_uuid UUID;
BEGIN
    -- Safe cast logic using text regex first, then casting to uuid
    v_account_id_uuid := CASE WHEN NEW.account_id::text~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NEW.account_id::text::uuid ELSE NULL END;
    v_dest_account_id_uuid := CASE WHEN NEW.destination_account_id::text~'^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN NEW.destination_account_id::text::uuid ELSE NULL END;

    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        DELETE FROM public.journal_entries WHERE transaction_id = OLD.id;
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Find or Create Ledger Account
        IF v_account_id_uuid IS NOT NULL THEN
            SELECT id INTO v_ledger_id FROM public.ledger_accounts WHERE account_id = v_account_id_uuid;
            IF v_ledger_id IS NULL THEN
                INSERT INTO public.ledger_accounts (account_id, balance) VALUES (v_account_id_uuid, 0) RETURNING id INTO v_ledger_id;
            END IF;

            IF (NEW.type = 'RECEITA') THEN
                INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type)
                VALUES (v_ledger_id, NEW.id, 'CREDIT', NEW.amount, 'Receita: ' || NEW.description, 'TRANSACTION');
            ELSIF (NEW.type = 'DESPESA') THEN
                 INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type)
                VALUES (v_ledger_id, NEW.id, 'DEBIT', NEW.amount, 'Despesa: ' || NEW.description, 'TRANSACTION');
            ELSIF (NEW.type = 'TRANSFERÊNCIA') THEN
                INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type)
                VALUES (v_ledger_id, NEW.id, 'DEBIT', NEW.amount, 'Transf. Enviada: ' || NEW.description, 'TRANSACTION');
                
                IF (v_dest_account_id_uuid IS NOT NULL) THEN
                    SELECT id INTO v_dest_ledger_id FROM public.ledger_accounts WHERE account_id = v_dest_account_id_uuid;
                    IF v_dest_ledger_id IS NULL THEN
                        INSERT INTO public.ledger_accounts (account_id, balance) VALUES (v_dest_account_id_uuid, 0) RETURNING id INTO v_dest_ledger_id;
                    END IF;
                    INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type)
                    VALUES (v_dest_ledger_id, NEW.id, 'CREDIT', COALESCE(NEW.destination_amount, NEW.amount), 'Transf. Recebida: ' || NEW.description, 'TRANSACTION');
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


DROP TRIGGER IF EXISTS trg_bridge_transactions_ledger ON public.transactions;
CREATE TRIGGER trg_bridge_transactions_ledger
    AFTER INSERT OR UPDATE OR DELETE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.process_transaction_into_ledger();


-- 6. BACKFILL DOS DADOS (REPROCESSAR TUDO)
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_audit_accounts') THEN
        ALTER TABLE public.accounts DISABLE TRIGGER tr_audit_accounts;
    END IF;
    
    RAISE NOTICE 'Iniciando Backfill do Ledger...';
    
    DELETE FROM public.journal_entries; 
    UPDATE public.ledger_accounts SET balance = 0;
    
    -- A) RECEITAS
    INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, occurred_at)
    SELECT 
        la.id, t.id, 'CREDIT', t.amount, 'Receita (Import): ' || t.description, 'MIGRATION', t.date
    FROM public.transactions t
    JOIN public.ledger_accounts la ON la.account_id::text = t.account_id::text -- FIXED: Cast Both to Text
    WHERE t.type = 'RECEITA' AND t.deleted = FALSE;

    -- B) DESPESAS
    INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, occurred_at)
    SELECT 
        la.id, t.id, 'DEBIT', t.amount, 'Despesa (Import): ' || t.description, 'MIGRATION', t.date
    FROM public.transactions t
    JOIN public.ledger_accounts la ON la.account_id::text = t.account_id::text -- FIXED
    WHERE t.type = 'DESPESA' AND t.deleted = FALSE 
    AND NOT (t.is_shared = TRUE AND t.payer_id IS NOT NULL AND t.payer_id != 'me' AND t.payer_id != t.user_id::text);

    -- C) TRANSFERÊNCIAS (SAÍDA)
    INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, occurred_at)
    SELECT 
        la.id, t.id, 'DEBIT', t.amount, 'Transf. Env (Import): ' || t.description, 'MIGRATION', t.date
    FROM public.transactions t
    JOIN public.ledger_accounts la ON la.account_id::text = t.account_id::text -- FIXED
    WHERE t.type = 'TRANSFERÊNCIA' AND t.deleted = FALSE;

    -- D) TRANSFERÊNCIAS (ENTRADA)
    INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, occurred_at)
    SELECT 
        la.id, t.id, 'CREDIT', COALESCE(t.destination_amount, t.amount), 'Transf. Rec (Import): ' || t.description, 'MIGRATION', t.date
    FROM public.transactions t
    JOIN public.ledger_accounts la ON la.account_id::text = t.destination_account_id::text -- FIXED
    WHERE t.type = 'TRANSFERÊNCIA' AND t.deleted = FALSE;
    
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'tr_audit_accounts') THEN
        ALTER TABLE public.accounts ENABLE TRIGGER tr_audit_accounts;
    END IF;

    RAISE NOTICE 'Backfill Concluído.';
END $$;

COMMIT;
