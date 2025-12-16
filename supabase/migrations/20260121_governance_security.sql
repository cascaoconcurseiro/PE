-- ==============================================================================
-- MIGRATION: GOVERNANCE & SECURITY (ETAPA 5) - FIXED V2
-- DATA: 2026-01-21
-- DESCRIÇÃO: Implementa RLS (Row Level Security) e restrições de escrita.
--            CORREÇÃO: Desabilita temporariamente o trigger de imutabilidade para backfill.
-- ==============================================================================

BEGIN;

-- 1. DENORMALIZATION: Adicionar user_id para RLS performático
-- ------------------------------------------------------------------------------
-- Evita joins complexos na policy de cada linha.

-- A) Ledger Accounts
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'ledger_accounts' AND column_name = 'user_id') THEN
        ALTER TABLE public.ledger_accounts ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- B) Journal Entries
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'journal_entries' AND column_name = 'user_id') THEN
        ALTER TABLE public.journal_entries ADD COLUMN user_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- C) Backfill (Popula os dados existentes)
-- IMPORTANTE: Precisamos pausar o trigger de imutabilidade, pois vamos alterar linhas antigas
-- para adicionar o owner (user_id). Esta é uma operação administrativa legítima.
DO $$
BEGIN
    -- Pausa proteção
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_ledger') THEN
        ALTER TABLE public.journal_entries DISABLE TRIGGER trg_protect_ledger;
        RAISE NOTICE 'Ledger protection paused for schema upgrade.';
    END IF;

    RAISE NOTICE 'Backfilling user_id for Ledger Accounts...';
    UPDATE public.ledger_accounts la
    SET user_id = a.user_id
    FROM public.accounts a
    WHERE la.account_id = a.id
    AND la.user_id IS NULL;

    RAISE NOTICE 'Backfilling user_id for Journal Entries...';
    UPDATE public.journal_entries je
    SET user_id = la.user_id
    FROM public.ledger_accounts la
    WHERE je.ledger_account_id = la.id
    AND je.user_id IS NULL;
    
    -- Reativa proteção
    IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_ledger') THEN
        ALTER TABLE public.journal_entries ENABLE TRIGGER trg_protect_ledger;
        RAISE NOTICE 'Ledger protection re-enabled.';
    END IF;
END $$;

-- D) Garantir NOT NULL (Segurança)
ALTER TABLE public.ledger_accounts ALTER COLUMN user_id SET NOT NULL;
ALTER TABLE public.journal_entries ALTER COLUMN user_id SET NOT NULL;

-- Índices para user_id (ajuda no RLS filter)
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_user ON public.ledger_accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user ON public.journal_entries(user_id);


-- 2. HABILITAR RLS (Segurança em Nível de Linha)
-- ------------------------------------------------------------------------------
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_reconciliations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_snapshots ENABLE ROW LEVEL SECURITY;


-- 3. POLICIES (Regras de Acesso)
-- ------------------------------------------------------------------------------

-- A) Ledger Accounts: Apenas LEITURA para o dono. Escrita via sistema apenas.
DROP POLICY IF EXISTS "Users can view own ledger accounts" ON public.ledger_accounts;
CREATE POLICY "Users can view own ledger accounts"
ON public.ledger_accounts FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- B) Journal Entries: Apenas LEITURA para o dono.
DROP POLICY IF EXISTS "Users can view own journal entries" ON public.journal_entries;
CREATE POLICY "Users can view own journal entries"
ON public.journal_entries FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- C) Reconciliations: Dono pode ver e criar (requests manuais).
DROP POLICY IF EXISTS "Users can view own reconciliations" ON public.ledger_reconciliations;
CREATE POLICY "Users can view own reconciliations"
ON public.ledger_reconciliations FOR SELECT
TO authenticated
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert reconciliations" ON public.ledger_reconciliations;
CREATE POLICY "Users can insert reconciliations"
ON public.ledger_reconciliations FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

-- D) Snapshots: Apenas Leitura.
DROP POLICY IF EXISTS "Users can view own snapshots" ON public.financial_snapshots;
CREATE POLICY "Users can view own snapshots"
ON public.financial_snapshots FOR SELECT
TO authenticated
USING (user_id = auth.uid());


-- 4. HARDENING: REMOVER PERMISSÕES DE ESCRITA
-- ------------------------------------------------------------------------------
-- Blindagem final: Mesmo que a RLS falhe, a role 'authenticated' (Client/API) 
-- não deve ter permissão física de INSERT/UPDATE/DELETE no Ledger.
-- Tudo deve passar por store procedures (RPCs) ou triggers de Transactions.

REVOKE INSERT, UPDATE, DELETE ON public.journal_entries FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.ledger_accounts FROM authenticated;

-- Garantir que podem ler
GRANT SELECT ON public.journal_entries TO authenticated;
GRANT SELECT ON public.ledger_accounts TO authenticated;


-- 5. REAFIRMAR SECURITY DEFINER
-- ------------------------------------------------------------------------------
-- As funções do sistema, executadas via Triggers na tabela Transactions (que o usuario PODE escrever),
-- precisam ser SECURITY DEFINER para conseguir escrever no Ledger (onde o usuario NÃO PODE escrever).
-- Já definimos isso nas migrações anteriores, mas reforçando:

ALTER FUNCTION public.process_transaction_into_ledger() SECURITY DEFINER;
ALTER FUNCTION public.update_sovereign_balance() SECURITY DEFINER;
ALTER FUNCTION public.sync_ledger_to_legacy_cache() SECURITY DEFINER;
ALTER FUNCTION public.generate_daily_snapshot(UUID, DATE) SECURITY DEFINER;

COMMIT;
