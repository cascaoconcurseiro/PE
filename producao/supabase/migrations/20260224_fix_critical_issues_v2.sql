-- ==============================================================================
-- MIGRATION: FIX CRITICAL ISSUES - CORREÇÕES FINAIS
-- DATA: 2026-02-24
-- OBJETIVO: Corrigir problemas críticos identificados na auditoria
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: DESABILITAR TRIGGER PROBLEMÁTICO
-- ==============================================================================

-- Desabilitar triggers se existirem
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'trg_sync_ddd_ledger' 
        AND tgrelid = 'transactions'::regclass
    ) THEN
        EXECUTE 'ALTER TABLE transactions DISABLE TRIGGER trg_sync_ddd_ledger';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'sync_transaction_to_ddd_ledger' 
        AND tgrelid = 'transactions'::regclass
    ) THEN
        EXECUTE 'ALTER TABLE transactions DISABLE TRIGGER sync_transaction_to_ddd_ledger';
    END IF;
END $$;

-- Remover policy restritiva
DROP POLICY IF EXISTS "System Freeze - Block Inserts" ON transactions;

-- ==============================================================================
-- PARTE 2: CRIAR FUNÇÃO CALCULATE_CASH_FLOW
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.calculate_cash_flow(
    p_user_id UUID,
    p_year INTEGER
)
RETURNS TABLE(
    month INTEGER,
    income NUMERIC,
    expense NUMERIC
) 
LANGUAGE plpgsql 
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(MONTH FROM t.date)::INTEGER AS month,
        COALESCE(SUM(CASE 
            WHEN t.type = 'RECEITA' THEN t.amount 
            ELSE 0 
        END), 0) AS income,
        COALESCE(SUM(CASE 
            WHEN t.type = 'DESPESA' THEN 
                CASE 
                    WHEN t.is_shared AND (t.payer_id IS NULL OR t.payer_id = 'me') THEN
                        t.amount - COALESCE((
                            SELECT SUM((split->>'assignedAmount')::NUMERIC)
                            FROM jsonb_array_elements(t.shared_with) AS split
                            WHERE (split->>'isSettled')::BOOLEAN = FALSE
                        ), 0)
                    WHEN t.is_shared AND t.payer_id IS NOT NULL AND t.payer_id != 'me' THEN
                        COALESCE((
                            SELECT (split->>'assignedAmount')::NUMERIC
                            FROM jsonb_array_elements(t.shared_with) AS split
                            WHERE split->>'memberId' = p_user_id::TEXT
                            LIMIT 1
                        ), t.amount)
                    ELSE t.amount
                END
            ELSE 0 
        END), 0) AS expense
    FROM transactions t
    WHERE t.user_id = p_user_id
        AND EXTRACT(YEAR FROM t.date) = p_year
        AND t.deleted = FALSE
    GROUP BY EXTRACT(MONTH FROM t.date)
    ORDER BY month;
END;
$$;

-- ==============================================================================
-- PARTE 3: CRIAR FUNÇÃO GET_RECEIVABLES_PAYABLES
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_receivables_payables(
    p_user_id UUID
)
RETURNS TABLE(
    receivables NUMERIC,
    payables NUMERIC,
    receivables_detail JSONB,
    payables_detail JSONB
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_receivables NUMERIC := 0;
    v_payables NUMERIC := 0;
    v_receivables_detail JSONB := '[]'::JSONB;
    v_payables_detail JSONB := '[]'::JSONB;
BEGIN
    SELECT 
        COALESCE(SUM((split->>'assignedAmount')::NUMERIC), 0),
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'transaction_id', t.id,
                'description', t.description,
                'amount', (split->>'assignedAmount')::NUMERIC,
                'date', t.date,
                'member_id', split->>'memberId',
                'member_email', split->>'email'
            )
        ), '[]'::JSONB)
    INTO v_receivables, v_receivables_detail
    FROM transactions t,
         jsonb_array_elements(t.shared_with) AS split
    WHERE t.user_id = p_user_id
        AND t.is_shared = TRUE
        AND (t.payer_id IS NULL OR t.payer_id = 'me')
        AND (split->>'isSettled')::BOOLEAN = FALSE
        AND t.deleted = FALSE;

    SELECT 
        COALESCE(SUM(t.amount), 0),
        COALESCE(jsonb_agg(
            jsonb_build_object(
                'transaction_id', t.id,
                'description', t.description,
                'amount', t.amount,
                'date', t.date,
                'payer_id', t.payer_id
            )
        ), '[]'::JSONB)
    INTO v_payables, v_payables_detail
    FROM transactions t
    WHERE t.user_id = p_user_id
        AND t.is_shared = TRUE
        AND t.payer_id IS NOT NULL
        AND t.payer_id != 'me'
        AND t.is_settled = FALSE
        AND t.deleted = FALSE;

    RETURN QUERY SELECT v_receivables, v_payables, v_receivables_detail, v_payables_detail;
END;
$$;

-- ==============================================================================
-- PARTE 4: CRIAR FUNÇÃO GET_ACCOUNT_BALANCE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_account_balance(
    p_account_id UUID,
    p_user_id UUID
)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_balance NUMERIC := 0;
BEGIN
    SELECT COALESCE(
        SUM(CASE 
            WHEN t.type = 'RECEITA' THEN t.amount
            WHEN t.type = 'DESPESA' THEN -t.amount
            WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = p_account_id THEN -t.amount
            WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = p_account_id THEN 
                COALESCE(t.destination_amount, t.amount)
            ELSE 0
        END), 0
    )
    INTO v_balance
    FROM transactions t
    WHERE (t.account_id = p_account_id OR t.destination_account_id = p_account_id)
        AND t.user_id = p_user_id
        AND t.deleted = FALSE
        AND t.date <= CURRENT_DATE;

    RETURN v_balance;
END;
$$;

-- ==============================================================================
-- PARTE 5: ADICIONAR COLUNA NOTES SE NÃO EXISTIR
-- ==============================================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'transactions' AND column_name = 'notes'
    ) THEN
        ALTER TABLE transactions ADD COLUMN notes TEXT;
    END IF;
END $$;

-- ==============================================================================
-- PARTE 6: ATUALIZAR FUNÇÃO CREATE_SHARED_TRANSACTION_V2
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_shared_transaction_v2(
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_shared_splits JSONB,
    p_trip_id UUID DEFAULT NULL,
    p_installment_data JSONB DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_transaction_id UUID;
    v_series_id UUID;
    v_total_installments INTEGER := 1;
    v_current_installment INTEGER := 1;
    v_split JSONB;
    v_split_user_id UUID;
    v_split_email TEXT;
    v_split_amount NUMERIC;
    v_request_id UUID;
    v_created_requests UUID[] := ARRAY[]::UUID[];
    v_total_assigned NUMERIC := 0;
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor deve ser positivo';
    END IF;
    
    IF p_shared_splits IS NULL OR jsonb_array_length(p_shared_splits) = 0 THEN
        RAISE EXCEPTION 'Pelo menos um usuário deve ser especificado';
    END IF;
    
    IF p_installment_data IS NOT NULL THEN
        v_total_installments := COALESCE((p_installment_data->>'total')::INTEGER, 1);
        v_series_id := COALESCE((p_installment_data->>'series_id')::UUID, gen_random_uuid());
        
        IF v_total_installments < 1 OR v_total_installments > 99 THEN
            RAISE EXCEPTION 'Número de parcelas deve estar entre 1 e 99';
        END IF;
    END IF;
    
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_shared_splits)
    LOOP
        v_split_amount := (v_split->>'amount')::NUMERIC;
        v_split_email := v_split->>'email';
        
        IF v_split_amount <= 0 THEN
            RAISE EXCEPTION 'Valor do split deve ser positivo';
        END IF;
        
        IF v_split_email IS NULL OR v_split_email = '' THEN
            RAISE EXCEPTION 'Email é obrigatório';
        END IF;
        
        v_total_assigned := v_total_assigned + v_split_amount;
    END LOOP;
    
    IF v_total_assigned > p_amount THEN
        RAISE EXCEPTION 'Total dos splits excede o valor da transação';
    END IF;
    
    INSERT INTO public.transactions (
        user_id, description, amount, type, category, date, account_id, trip_id,
        currency, is_shared, payer_id, domain, is_installment, current_installment,
        total_installments, series_id, shared_with, notes, created_at, updated_at
    ) VALUES (
        v_user_id,
        p_description || CASE WHEN v_total_installments > 1 THEN ' (1/' || v_total_installments || ')' ELSE '' END,
        p_amount, 'DESPESA', p_category, p_date, p_account_id, p_trip_id,
        'BRL', true, 'me',
        CASE WHEN p_trip_id IS NOT NULL THEN 'TRAVEL' ELSE 'SHARED' END,
        v_total_installments > 1, v_current_installment, v_total_installments,
        v_series_id, p_shared_splits, p_notes, NOW(), NOW()
    ) RETURNING id INTO v_transaction_id;
    
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_shared_splits)
    LOOP
        v_split_user_id := NULLIF(v_split->>'user_id', '')::UUID;
        v_split_email := v_split->>'email';
        v_split_amount := (v_split->>'amount')::NUMERIC;
        
        IF v_split_user_id IS NULL THEN
            SELECT id INTO v_split_user_id 
            FROM auth.users 
            WHERE email = v_split_email AND deleted_at IS NULL;
        END IF;
        
        INSERT INTO public.shared_transaction_requests (
            transaction_id, requester_id, target_user_id, target_email,
            assigned_amount, status, created_at, updated_at
        ) VALUES (
            v_transaction_id, v_user_id, v_split_user_id, v_split_email,
            v_split_amount,
            CASE WHEN v_split_user_id IS NOT NULL THEN 'PENDING' ELSE 'AWAITING_REGISTRATION' END,
            NOW(), NOW()
        ) RETURNING id INTO v_request_id;
        
        v_created_requests := array_append(v_created_requests, v_request_id);
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'transaction_id', v_transaction_id,
        'request_ids', v_created_requests,
        'message', 'Transação compartilhada criada com sucesso'
    );
END;
$$;

-- ==============================================================================
-- PARTE 7: GRANT PERMISSIONS
-- ==============================================================================

GRANT EXECUTE ON FUNCTION public.calculate_cash_flow(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_receivables_payables(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_account_balance(UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_shared_transaction_v2 TO authenticated;

-- ==============================================================================
-- VALIDAÇÃO
-- ==============================================================================

DO $$
DECLARE
    v_test_user_id UUID;
    v_test_result RECORD;
BEGIN
    SELECT id INTO v_test_user_id FROM auth.users WHERE deleted_at IS NULL LIMIT 1;
    
    IF v_test_user_id IS NOT NULL THEN
        SELECT * INTO v_test_result FROM calculate_cash_flow(v_test_user_id, 2025) LIMIT 1;
        RAISE NOTICE 'calculate_cash_flow: OK';
        
        SELECT * INTO v_test_result FROM get_receivables_payables(v_test_user_id);
        RAISE NOTICE 'get_receivables_payables: OK - Receivables: %, Payables: %', 
            v_test_result.receivables, v_test_result.payables;
    END IF;
END $$;
