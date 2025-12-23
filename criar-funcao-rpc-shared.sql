-- ==============================================================================
-- CRIAR FUNÇÃO RPC: create_shared_transaction_v2
-- PROBLEMA: Função não existe no banco, causando erro na importação de parcelas
-- SOLUÇÃO: Criar a função RPC necessária
-- ==============================================================================

-- Primeiro, verificar se a função já existe
SELECT 
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname LIKE '%create_shared_transaction%'
ORDER BY proname;

-- ==============================================================================
-- CRIAR A FUNÇÃO RPC NECESSÁRIA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_shared_transaction_v2(
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_shared_splits JSONB DEFAULT '[]'::jsonb,
    p_trip_id UUID DEFAULT NULL,
    p_installment_data JSONB DEFAULT NULL
) RETURNS JSONB AS $$
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
    v_execution_start TIMESTAMPTZ := NOW();
    v_error_message TEXT;
    v_rollback_point TEXT := 'start';
BEGIN
    -- Validações iniciais
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor deve ser positivo';
    END IF;
    
    IF p_shared_splits IS NULL OR jsonb_array_length(p_shared_splits) = 0 THEN
        RAISE EXCEPTION 'Pelo menos um usuário deve ser especificado para compartilhamento';
    END IF;
    
    -- Processar dados de parcelamento se fornecidos
    IF p_installment_data IS NOT NULL THEN
        v_total_installments := COALESCE((p_installment_data->>'total')::INTEGER, 1);
        v_series_id := COALESCE((p_installment_data->>'series_id')::UUID, gen_random_uuid());
        
        IF v_total_installments < 1 OR v_total_installments > 99 THEN
            RAISE EXCEPTION 'Número de parcelas deve estar entre 1 e 99';
        END IF;
    END IF;
    
    -- Validar splits e calcular total
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_shared_splits)
    LOOP
        v_split_amount := (v_split->>'amount')::NUMERIC;
        v_split_email := v_split->>'email';
        
        IF v_split_amount <= 0 THEN
            RAISE EXCEPTION 'Valor do split deve ser positivo: %', v_split_amount;
        END IF;
        
        -- Email é opcional para esta versão simplificada
        IF v_split_email IS NULL OR v_split_email = '' THEN
            v_split_email := 'placeholder@shared.local';
        END IF;
        
        v_total_assigned := v_total_assigned + v_split_amount;
    END LOOP;
    
    -- Validar que total dos splits não excede o valor da transação
    IF v_total_assigned > p_amount THEN
        RAISE EXCEPTION 'Total dos splits (%) excede o valor da transação (%)', v_total_assigned, p_amount;
    END IF;
    
    v_rollback_point := 'validations_complete';
    
    -- Criar transação principal
    INSERT INTO public.transactions (
        user_id,
        description,
        amount,
        type,
        category,
        date,
        account_id,
        trip_id,
        currency,
        is_shared,
        payer_id,
        domain,
        is_installment,
        current_installment,
        total_installments,
        series_id,
        shared_with,
        created_at,
        updated_at,
        deleted
    ) VALUES (
        v_user_id,
        p_description || CASE WHEN v_total_installments > 1 THEN ' (1/' || v_total_installments || ')' ELSE '' END,
        p_amount,
        'DESPESA',
        p_category,
        p_date,
        p_account_id,
        p_trip_id,
        'BRL',
        true,
        'me',
        CASE WHEN p_trip_id IS NOT NULL THEN 'TRAVEL' ELSE 'SHARED' END,
        v_total_installments > 1,
        v_current_installment,
        v_total_installments,
        v_series_id,
        p_shared_splits,
        NOW(),
        NOW(),
        false
    ) RETURNING id INTO v_transaction_id;
    
    v_rollback_point := 'transaction_created';
    
    -- Criar solicitações de compartilhamento para cada split
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_shared_splits)
    LOOP
        v_split_user_id := NULLIF(v_split->>'user_id', '')::UUID;
        v_split_email := COALESCE(v_split->>'email', 'placeholder@shared.local');
        v_split_amount := (v_split->>'amount')::NUMERIC;
        
        -- Tentar encontrar usuário pelo email se user_id não fornecido
        IF v_split_user_id IS NULL AND v_split_email != 'placeholder@shared.local' THEN
            SELECT id INTO v_split_user_id 
            FROM auth.users 
            WHERE email = v_split_email 
            AND deleted_at IS NULL;
        END IF;
        
        -- Criar solicitação apenas se necessário (não para o próprio usuário)
        IF v_split_user_id IS NOT NULL AND v_split_user_id != v_user_id THEN
            INSERT INTO public.shared_transaction_requests (
                transaction_id,
                requester_id,
                invited_email,
                invited_user_id,
                assigned_amount,
                status,
                expires_at,
                request_metadata,
                created_at
            ) VALUES (
                v_transaction_id,
                v_user_id,
                v_split_email,
                v_split_user_id,
                v_split_amount,
                'PENDING',
                NOW() + INTERVAL '7 days',
                jsonb_build_object(
                    'installment_info', CASE WHEN v_total_installments > 1 THEN
                        jsonb_build_object(
                            'current', v_current_installment,
                            'total', v_total_installments,
                            'series_id', v_series_id
                        )
                    ELSE NULL END,
                    'original_amount', p_amount,
                    'split_percentage', ROUND((v_split_amount / p_amount) * 100, 2)
                ),
                NOW()
            ) RETURNING id INTO v_request_id;
            
            v_created_requests := array_append(v_created_requests, v_request_id);
        END IF;
    END LOOP;
    
    v_rollback_point := 'requests_created';
    
    -- Retornar resultado de sucesso
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'transaction_id', v_transaction_id,
            'request_ids', v_created_requests,
            'total_requests', array_length(v_created_requests, 1),
            'series_id', v_series_id,
            'installments', v_total_installments
        ),
        'message', 'Transação compartilhada criada com sucesso'
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log do erro
    v_error_message := SQLERRM;
    
    -- Retornar erro estruturado
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'CREATE_SHARED_TRANSACTION_FAILED',
            'message', v_error_message,
            'rollback_point', v_rollback_point
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.create_shared_transaction_v2(TEXT, NUMERIC, TEXT, DATE, UUID, JSONB, UUID, JSONB) TO authenticated;

-- Comentário da função
COMMENT ON FUNCTION public.create_shared_transaction_v2(TEXT, NUMERIC, TEXT, DATE, UUID, JSONB, UUID, JSONB) IS 
'Cria transação compartilhada com validações robustas e operações atômicas. Suporta parcelamento e múltiplos usuários.';

-- Verificar se a função foi criada
SELECT 
    'FUNÇÃO CRIADA COM SUCESSO' as status,
    proname as function_name,
    pg_get_function_arguments(oid) as arguments
FROM pg_proc 
WHERE proname = 'create_shared_transaction_v2';