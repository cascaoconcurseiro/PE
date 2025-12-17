-- ==============================================================================
-- VERIFICATION SCRIPT: DDD LEDGER ACCURACY
-- DESCRIÇÃO: Compara o saldo calculado via DDD Ledger com o saldo 'Real' das Contas.
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_ddd_balance NUMERIC;
    v_legacy_balance NUMERIC;
    v_diff NUMERIC;
    v_pass BOOLEAN := TRUE;
BEGIN
    RAISE NOTICE 'INICIANDO VERIFICAÇÃO DE SALDOS DDD...';
    RAISE NOTICE '---------------------------------------------------';

    -- 1. Verificar cada Conta Real (Ativo/Passivo)
    FOR r IN SELECT * FROM public.accounts WHERE deleted = FALSE LOOP
        
        -- Calcular Saldo DDD: Sum(Debits) - Sum(Credits) para ATIVOS
        -- Se for Passivo (Cartão), normalmente é Credit side, mas 'balance' no legacy costuma ser "Quanto eu tenho (positivo)" ou "Quanto devo (negativo)".
        -- Accounts Legacy: Cartão com gasto costuma ficar negativo? Ou positivo como dívida?
        -- Assumindo padrão Dyad: Cartão Balance = Gastos (Positivo) ou Dívida (Negativo)?
        -- Geralmente: Conta Corrente = Positivo. Cartão = Negativo.
        
        -- Saldo DDD Puro:
        SELECT COALESCE(SUM(CASE WHEN debit_account_id = ca.id THEN amount ELSE 0 END), 0) - 
               COALESCE(SUM(CASE WHEN credit_account_id = ca.id THEN amount ELSE 0 END), 0)
        INTO v_ddd_balance
        FROM public.ledger_entries le
        JOIN public.chart_of_accounts ca ON (le.debit_account_id = ca.id OR le.credit_account_id = ca.id)
        WHERE ca.linked_account_id = r.id;
        
        -- Pegar Saldo Legacy (Calculado via transações para ser justo, ou o campo cacheado?)
        -- Vamos confiar no campo cacheado 'balance' da conta accounts se estiver atualizado.
        v_legacy_balance := r.balance;
        
        v_diff := v_ddd_balance - v_legacy_balance;
        
        IF ABS(v_diff) > 0.01 THEN
            RAISE NOTICE 'FALHA NA CONTA %: Legacy=%, DDD=%, Diff=%', r.name, v_legacy_balance, v_ddd_balance, v_diff;
            v_pass := FALSE;
        ELSE
            RAISE NOTICE 'OK: % (Saldo %)', r.name, v_ddd_balance;
        END IF;
    END LOOP;

    RAISE NOTICE '---------------------------------------------------';
    IF v_pass THEN
        RAISE NOTICE 'VERIFICAÇÃO BEM SUCEDIDA: TODAS AS CONTAS BATEM!';
    ELSE
        RAISE NOTICE 'VERIFICAÇÃO FALHOU EM ALGUMAS CONTAS.';
    END IF;
END $$;
