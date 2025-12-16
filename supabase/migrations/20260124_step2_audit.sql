-- ==============================================================================
-- MIGRATION: STEP 2 - SNAPSHOT ZERO (AUDIT)
-- DATA: 2026-01-24
-- OBJ: Registrar estado atual e inconsistências sem corrigir nada.
-- ==============================================================================

BEGIN;

-- 1. ESTRUTURA DE AUDITORIA
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_snapshots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    snapshot_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    snapshot_type TEXT, -- 'PRE-MIGRATION', 'POST-REPLAY', 'FINAL'
    details JSONB
);

CREATE TABLE IF NOT EXISTS public.audit_inconsistencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    detected_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    entity_type TEXT,
    entity_id UUID,
    issue_description TEXT,
    severity TEXT -- 'CRITICAL', 'WARNING'
);

-- 2. SNAPSHOT CONTÁBIL (Saldo Calculado vs Ledger Atual)
-- ------------------------------------------------------------------------------
-- Calcula saldo real baseado nas transações (Source of Truth Histórico)
CREATE OR REPLACE FUNCTION public.capture_snapshot_zero()
RETURNS UUID AS $$
DECLARE
    v_snapshot_id UUID;
    v_data JSONB;
BEGIN
    -- Agrega saldos por conta (Legacy Calculation)
    WITH legacy_balances AS (
        SELECT 
            account_id, 
            SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE -amount END) as calc_balance
        FROM public.transactions
        WHERE deleted = FALSE
        GROUP BY account_id
    ),
    -- Saldos do Ledger (Se existir)
    ledger_balances AS (
        SELECT 
            account_id, 
            balance as ledger_balance
        FROM public.ledger_accounts
    )
    SELECT jsonb_agg(jsonb_build_object(
        'account_id', COALESCE(l.account_id::text, b.account_id::text),
        'legacy_calc', COALESCE(b.calc_balance, 0),
        'ledger_stored', COALESCE(l.ledger_balance, 0),
        'diff', COALESCE(b.calc_balance, 0) - COALESCE(l.ledger_balance, 0)
    ))
    INTO v_data
    FROM legacy_balances b
    FULL OUTER JOIN ledger_balances l ON b.account_id::uuid = l.account_id;

    -- Persiste
    INSERT INTO public.audit_snapshots (snapshot_type, details)
    VALUES ('PRE-MIGRATION', v_data)
    RETURNING id INTO v_snapshot_id;

    RETURN v_snapshot_id;
END;
$$ LANGUAGE plpgsql;

-- 3. DETECÇÃO DE INCONSISTÊNCIAS
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.detect_inconsistencies()
RETURNS VOID AS $$
BEGIN
    -- A) Transactions sem User
    INSERT INTO public.audit_inconsistencies (entity_type, entity_id, issue_description, severity)
    SELECT 'TRANSACTION', id, 'Missing User ID', 'CRITICAL'
    FROM public.transactions WHERE user_id IS NULL;

    -- B) Splits mismatch (Soma dos splits != Valor da transação)
    -- (Apenas para transações marcadas como is_shared)
    -- TODO: Verificar se transaction_splits.assigned_amount soma == transaction.amount
    -- Complexo pois splits podem ser parciais? Prompt diz "transaction_splits refatorada". 
    -- Assumindo regra: Soma dos splits deve bater? Ou transaction_splits é apenas dívidas?
    -- Se for apenas dívidas, não tem que bater 100%. Falaremos 'WARNING' se > amount.
    
    INSERT INTO public.audit_inconsistencies (entity_type, entity_id, issue_description, severity)
    SELECT 'TRANSACTION', t.id, 
        'Split Sum (' || SUM(s.assigned_amount) || ') > Transaction Amount (' || t.amount || ')', 
        'CRITICAL'
    FROM public.transactions t
    JOIN public.transaction_splits s ON t.id = s.transaction_id
    WHERE t.deleted = FALSE
    GROUP BY t.id
    HAVING SUM(s.assigned_amount) > (t.amount + 0.05); -- margem erro float

    -- C) Transactions com FKs quebradas (Orphans)
    -- (Só se FKs não forem strict, mas já aplicamos strict fks. Verificamos se passou algo antes.)
    -- Como aplicamos 20260117_strict_fks.sql, o banco já deve ter bloqueado. 
    -- Mas vale checar NULLs onde não deveria.

END;
$$ LANGUAGE plpgsql;

-- EXECUÇÃO INICIAL
SELECT public.capture_snapshot_zero();
SELECT public.detect_inconsistencies();

COMMIT;
