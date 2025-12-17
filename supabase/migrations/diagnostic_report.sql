-- ==============================================================================
-- SCRIPT DE DIAGNÓSTICO DE SAÚDE DO BANCO DE DADOS (SUPABASE)
-- DATA: 2026-01-26
-- DESCRIÇÃO: Este script executa uma série de verificações de integridade e 
--            retorna um relatório de problemas encontrados.
-- COMO USAR: Copie e cole no SQL Editor do Supabase e execute.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.run_health_check()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT,
    affected_count BIGINT
) LANGUAGE plpgsql AS $$
DECLARE
    v_orphaned_accounts BIGINT;
    v_orphaned_trips BIGINT;
    v_balance_mismatch BIGINT;
    v_missing_rls BIGINT;
    v_invalid_splits BIGINT;
BEGIN
    -- 1. CHECAGEM DE INTEGRIDADE REFERENCIAL (FKs Manuais/Soft Delete)
    -- Transações apontando para contas que não existem (excluindo NULL)
    SELECT COUNT(*) INTO v_orphaned_accounts 
    FROM public.transactions t 
    LEFT JOIN public.accounts a ON t.account_id = a.id 
    WHERE t.account_id IS NOT NULL AND a.id IS NULL;

    RETURN QUERY SELECT 
        'Orphaned Transactions (Account)', 
        CASE WHEN v_orphaned_accounts > 0 THEN 'FAIL' ELSE 'PASS' END, 
        'Transações referenciando contas inexistentes', 
        v_orphaned_accounts;

    -- Transações apontando para viagens que não existem
    SELECT COUNT(*) INTO v_orphaned_trips 
    FROM public.transactions t 
    LEFT JOIN public.trips tr ON t.trip_id = tr.id 
    WHERE t.trip_id IS NOT NULL AND tr.id IS NULL;

    RETURN QUERY SELECT 
        'Orphaned Transactions (Trip)', 
        CASE WHEN v_orphaned_trips > 0 THEN 'FAIL' ELSE 'PASS' END, 
        'Transações referenciando viagens inexistentes', 
        v_orphaned_trips;

    -- 2. CONSISTÊNCIA DE SALDOS
    -- Verifica se saldo atual da conta bate com saldo inicial + transações
    -- Nota: Cálculo aproximado (ignora ajustes complexos de reconciliação para performance, foca em discrepâncias brutas)
    RETURN QUERY 
    WITH calculated AS (
        SELECT 
            a.id, 
            a.name,
            a.initial_balance,
            a.balance as stored_balance,
            COALESCE(SUM(CASE WHEN t.type = 'RECEITA' THEN t.amount ELSE -t.amount END), 0) as tx_sum
        FROM public.accounts a
        LEFT JOIN public.transactions t ON t.account_id = a.id AND t.deleted = false
        WHERE a.deleted = false
        GROUP BY a.id
    )
    SELECT 
        'Balance Consistency (' || c.name || ')',
        CASE WHEN ABS((c.initial_balance + c.tx_sum) - c.stored_balance) > 0.1 THEN 'WARNING' ELSE 'PASS' END,
        'Calc: ' || (c.initial_balance + c.tx_sum) || ' vs Stored: ' || c.stored_balance,
        1::BIGINT
    FROM calculated c
    WHERE ABS((c.initial_balance + c.tx_sum) - c.stored_balance) > 0.1;

    -- 3. SPLITS ÓRFÃOS
    SELECT COUNT(*) INTO v_invalid_splits
    FROM public.transaction_splits s
    LEFT JOIN public.transactions t ON s.transaction_id = t.id
    WHERE t.id IS NULL;

    RETURN QUERY SELECT 
        'Orphaned Splits', 
        CASE WHEN v_invalid_splits > 0 THEN 'FAIL' ELSE 'PASS' END, 
        'Splits sem transação pai', 
        v_invalid_splits;

    -- 4. RLS CHECK
    SELECT COUNT(*) INTO v_missing_rls
    FROM pg_tables 
    WHERE schemaname = 'public' 
    AND rowsecurity = false 
    AND tablename IN ('transactions', 'accounts', 'trips', 'transaction_splits', 'user_settings');

    RETURN QUERY SELECT 
        'RLS Configuration', 
        CASE WHEN v_missing_rls > 0 THEN 'FAIL' ELSE 'PASS' END, 
        'Tabelas críticas sem RLS ativado', 
        v_missing_rls;

    -- 5. FUNCTION SIGNATURE CHECK (O problema recente)
    -- Verifica se create_transaction tem os 17 argumentos
    RETURN QUERY SELECT 
        'RPC Signature Limit',
        CASE WHEN EXISTS (
            SELECT 1 FROM pg_proc p 
            JOIN pg_namespace n ON p.pronamespace = n.oid 
            WHERE n.nspname = 'public' AND p.proname = 'create_transaction' AND p.pronargs = 17
        ) THEN 'PASS' ELSE 'FAIL' END,
        'Verificação da função create_transaction atualizada',
        0::BIGINT;

END;
$$;

-- Executar Relatório
SELECT * FROM public.run_health_check();

ROLLBACK; -- Rollback para não salvar a função de teste permanentemente (opcional, mas bom pra limpeza)
