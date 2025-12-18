-- ==============================================================================
-- MIGRATION: RECONCILIATION & PERFORMANCE (ETAPA 4)
-- DATA: 2026-01-20
-- DESCRIÇÃO: Implementa governança de dados, snapshots e imutabilidade do Ledger.
--            1. Tabela ledger_reconciliations (Auditoria contábil).
--            2. Tabela financial_snapshots (Cache histórico).
--            3. Índices de alta performance.
--            4. Trava de Imutabilidade (Hard Rule) no Journal.
-- ==============================================================================

BEGIN;

-- 1. TABELA DE RECONCILIAÇÃO
-- ------------------------------------------------------------------------------
-- Permite registrar o estado do saldo em um ponto no tempo e comparar com o esperado.
CREATE TABLE IF NOT EXISTS public.ledger_reconciliations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
    period_end DATE NOT NULL,
    calculated_balance NUMERIC NOT NULL,
    expected_balance NUMERIC, -- Opcional: saldo informado pelo banco real
    status TEXT CHECK (status IN ('MATCHED', 'MISMATCH', 'PENDING')) DEFAULT 'PENDING',
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    reconciled_at TIMESTAMP WITH TIME ZONE,
    notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_reconciliations_user_period ON public.ledger_reconciliations(user_id, period_end);


-- 2. TABELA DE SNAPSHOTS (CACHE HISTÓRICO)
-- ------------------------------------------------------------------------------
-- Armazena o "Patrimônio" do usuário dia a dia. Reprocessável.
CREATE TABLE IF NOT EXISTS public.financial_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    snapshot_date DATE NOT NULL,
    total_assets NUMERIC DEFAULT 0,     -- Soma de contas positivas
    total_liabilities NUMERIC DEFAULT 0, -- Soma de contas negativas / dívidas
    net_worth NUMERIC DEFAULT 0,         -- Assets - Liabilities
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    CONSTRAINT uq_user_snapshot_date UNIQUE(user_id, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_snapshots_lookup ON public.financial_snapshots(user_id, snapshot_date DESC);


-- 3. ÍNDICES DE PERFORMANCE CRÍTICOS
-- ------------------------------------------------------------------------------
-- Acelera queries de saldo e dashboards.

-- Para somar entradas de uma conta rapidamente
CREATE INDEX IF NOT EXISTS idx_journal_entries_account_sum ON public.journal_entries(ledger_account_id, occurred_at);

-- Para filtrar entradas por usuário (via join, se necessário, ou se adicionarmos user_id denormalizado no futuro)
-- Nota: journal_entries liga a ledger_accounts que liga a accounts que tem user_id. 
-- Fazer queries de "Meu Extrato Geral" exige joins.
-- O índice em ledger_accounts(account_id) já ajuda muito.


-- 4. REGRA DE OURO: LEDGER IMUTÁVEL
-- ------------------------------------------------------------------------------
-- Ninguém altera o passado. Apenas cria novos registros para corrigir.

CREATE OR REPLACE FUNCTION public.prevent_ledger_tampering()
RETURNS TRIGGER AS $$
BEGIN
    IF (TG_OP = 'DELETE') THEN
        -- Permitir DELETE apenas se for parte de uma limpeza admin explicita (ex: cascade user delete)
        -- Mas para operações normais, é proibido.
        -- Como detectar cascade? TG_LEVEL? Difícil em PG puro de forma simples.
        -- Vamos permitir DELETE apenas se a conta pai for deletada (Cascading).
        -- Mas se alguém tentar dar DELETE FROM journal_entries WHERE id = X... Bloquear.
        
        -- Truque check: Se o ledger_account ainda existe, não pode deletar a entry.
        IF EXISTS (SELECT 1 FROM public.ledger_accounts WHERE id = OLD.ledger_account_id) THEN
            RAISE EXCEPTION 'VIOLATION: Journal Entries are immutable. Create a reversing entry instead of deleting.';
        END IF;
    ELSIF (TG_OP = 'UPDATE') THEN
        RAISE EXCEPTION 'VIOLATION: Journal Entries are immutable. Create a reversing entry instead of updating.';
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_ledger ON public.journal_entries;
CREATE TRIGGER trg_protect_ledger
    BEFORE UPDATE OR DELETE ON public.journal_entries
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_ledger_tampering();


-- 5. FUNÇÃO GERADORA DE SNAPSHOT
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.generate_daily_snapshot(p_user_id UUID, p_date DATE)
RETURNS VOID AS $$
DECLARE
    v_assets NUMERIC := 0;
    v_liabilities NUMERIC := 0;
BEGIN
    -- Calcula Assets (Contas > 0) e Liabilities (Contas < 0) baseado no saldo ATUAL das contas
    -- e voltando no tempo? Não, snapshot geralmente é "hoje".
    -- Se quisermos snapshot retroativo, teríamos que somar journal_entries <= p_date.
    -- Vamos fazer retroativo para ser robusto.

    WITH calculated_balances AS (
        SELECT 
            la.id,
            SUM(
                CASE 
                    WHEN je.entry_type = 'CREDIT' THEN je.amount 
                    ELSE -je.amount 
                END
            ) as balance
        FROM public.ledger_accounts la
        JOIN public.accounts a ON a.id = la.account_id
        LEFT JOIN public.journal_entries je ON je.ledger_account_id = la.id AND Var_date_trunc('day', je.occurred_at) <= p_date
        WHERE a.user_id = p_user_id
        GROUP BY la.id
    )
    SELECT 
        COALESCE(SUM(CASE WHEN balance > 0 THEN balance ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN balance < 0 THEN ABS(balance) ELSE 0 END), 0)
    INTO v_assets, v_liabilities
    FROM calculated_balances;

    -- Upsert Snapshot
    INSERT INTO public.financial_snapshots (user_id, snapshot_date, total_assets, total_liabilities, net_worth)
    VALUES (p_user_id, p_date, v_assets, v_liabilities, v_assets - v_liabilities)
    ON CONFLICT (user_id, snapshot_date) 
    DO UPDATE SET 
        total_assets = EXCLUDED.total_assets, 
        total_liabilities = EXCLUDED.total_liabilities,
        net_worth = EXCLUDED.net_worth,
        created_at = NOW();

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
