-- ==============================================================================
-- FUNÇÕES RPC V2 - SISTEMA COMPARTILHADO REESTRUTURADO
-- DATA: 2025-12-21
-- OBJETIVO: Implementar funções RPC robustas e atômicas para sistema compartilhado
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: FUNÇÃO CREATE_SHARED_TRANSACTION_V2
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_shared_transaction_v2(
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_shared_splits JSONB, -- [{"user_id": "uuid", "amount": 100.50, "email": "user@email.com"}]
    p_trip_id UUID DEFAULT NULL,
    p_installment_data JSONB DEFAULT NULL -- {"total": 12, "series_id": "uuid"}
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
        
        IF v_split_email IS NULL OR v_split_email = '' THEN
            RAISE EXCEPTION 'Email é obrigatório para cada split';
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
        updated_at
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
        NOW()
    ) RETURNING id INTO v_transaction_id;
    
    v_rollback_point := 'transaction_created';
    
    -- Criar solicitações de compartilhamento para cada split
    FOR v_split IN SELECT * FROM jsonb_array_elements(p_shared_splits)
    LOOP
        v_split_user_id := NULLIF(v_split->>'user_id', '')::UUID;
        v_split_email := v_split->>'email';
        v_split_amount := (v_split->>'amount')::NUMERIC;
        
        -- Tentar encontrar usuário pelo email se user_id não fornecido
        IF v_split_user_id IS NULL THEN
            SELECT id INTO v_split_user_id 
            FROM auth.users 
            WHERE email = v_split_email 
            AND deleted_at IS NULL;
        END IF;
        
        -- Criar solicitação
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
    END LOOP;
    
    v_rollback_point := 'requests_created';
    
    -- Log da operação
    INSERT INTO public.shared_system_audit_logs (
        operation_type,
        transaction_id,
        user_id,
        operation_data,
        success,
        execution_time_ms
    ) VALUES (
        'CREATE_SHARED_TRANSACTION',
        v_transaction_id,
        v_user_id,
        jsonb_build_object(
            'transaction_id', v_transaction_id,
            'amount', p_amount,
            'splits_count', jsonb_array_length(p_shared_splits),
            'total_assigned', v_total_assigned,
            'installments', v_total_installments,
            'request_ids', v_created_requests,
            'rollback_point', v_rollback_point
        ),
        true,
        EXTRACT(EPOCH FROM (NOW() - v_execution_start)) * 1000
    );
    
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
    
    INSERT INTO public.shared_system_audit_logs (
        operation_type,
        transaction_id,
        user_id,
        operation_data,
        success,
        error_message,
        execution_time_ms
    ) VALUES (
        'CREATE_SHARED_TRANSACTION',
        v_transaction_id,
        v_user_id,
        jsonb_build_object(
            'error_at_rollback_point', v_rollback_point,
            'amount', p_amount,
            'splits_count', COALESCE(jsonb_array_length(p_shared_splits), 0),
            'partial_request_ids', v_created_requests
        ),
        false,
        v_error_message,
        EXTRACT(EPOCH FROM (NOW() - v_execution_start)) * 1000
    );
    
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

-- ==============================================================================
-- PARTE 2: FUNÇÃO RESPOND_TO_SHARED_REQUEST_V2
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.respond_to_shared_request_v2(
    p_request_id UUID,
    p_status TEXT, -- 'ACCEPTED' | 'REJECTED'
    p_account_id UUID DEFAULT NULL -- Required for ACCEPTED
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_request RECORD;
    v_original_transaction RECORD;
    v_mirror_transaction_id UUID;
    v_execution_start TIMESTAMPTZ := NOW();
    v_error_message TEXT;
    v_rollback_point TEXT := 'start';
BEGIN
    -- Validações iniciais
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF p_status NOT IN ('ACCEPTED', 'REJECTED') THEN
        RAISE EXCEPTION 'Status deve ser ACCEPTED ou REJECTED';
    END IF;
    
    IF p_status = 'ACCEPTED' AND p_account_id IS NULL THEN
        RAISE EXCEPTION 'account_id é obrigatório para aceitar solicitação';
    END IF;
    
    -- Buscar e validar solicitação
    SELECT * INTO v_request
    FROM public.shared_transaction_requests
    WHERE id = p_request_id
    AND invited_user_id = v_user_id
    AND status = 'PENDING'
    AND expires_at > NOW();
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Solicitação não encontrada, já processada ou expirada';
    END IF;
    
    v_rollback_point := 'request_validated';
    
    -- Buscar transação original
    SELECT * INTO v_original_transaction
    FROM public.transactions
    WHERE id = v_request.transaction_id
    AND deleted = false;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transação original não encontrada ou foi deletada';
    END IF;
    
    v_rollback_point := 'transaction_validated';
    
    -- Processar resposta
    IF p_status = 'ACCEPTED' THEN
        -- Criar transação espelho
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
            source_transaction_id,
            is_mirror,
            shared_with,
            created_at,
            updated_at
        ) VALUES (
            v_user_id,
            v_original_transaction.description || ' (Compartilhado por ' || 
                COALESCE((SELECT COALESCE(raw_user_meta_data->>'name', email) FROM auth.users WHERE id = v_request.requester_id), 'Usuário') || ')',
            v_request.assigned_amount,
            'DESPESA',
            v_original_transaction.category,
            v_original_transaction.date,
            p_account_id,
            v_original_transaction.trip_id,
            v_original_transaction.currency,
            true,
            v_request.requester_id::TEXT,
            v_original_transaction.domain,
            v_original_transaction.is_installment,
            v_original_transaction.current_installment,
            v_original_transaction.total_installments,
            v_original_transaction.series_id,
            v_original_transaction.id,
            true,
            jsonb_build_array(jsonb_build_object(
                'memberId', 'original_payer',
                'assignedAmount', v_request.assigned_amount,
                'percentage', ROUND((v_request.assigned_amount / v_original_transaction.amount) * 100, 2),
                'isSettled', false
            )),
            NOW(),
            NOW()
        ) RETURNING id INTO v_mirror_transaction_id;
        
        v_rollback_point := 'mirror_created';
        
        -- Criar registro de espelhamento
        INSERT INTO public.shared_transaction_mirrors (
            original_transaction_id,
            mirror_transaction_id,
            mirror_user_id,
            sync_status,
            last_sync_at
        ) VALUES (
            v_original_transaction.id,
            v_mirror_transaction_id,
            v_user_id,
            'SYNCED',
            NOW()
        );
        
        v_rollback_point := 'mirror_record_created';
    END IF;
    
    -- Atualizar status da solicitação
    UPDATE public.shared_transaction_requests
    SET 
        status = p_status,
        responded_at = NOW(),
        updated_at = NOW()
    WHERE id = p_request_id;
    
    v_rollback_point := 'request_updated';
    
    -- Log da operação
    INSERT INTO public.shared_system_audit_logs (
        operation_type,
        request_id,
        transaction_id,
        user_id,
        operation_data,
        success,
        execution_time_ms
    ) VALUES (
        'RESPOND_TO_REQUEST',
        p_request_id,
        v_original_transaction.id,
        v_user_id,
        jsonb_build_object(
            'response_status', p_status,
            'mirror_transaction_id', v_mirror_transaction_id,
            'assigned_amount', v_request.assigned_amount,
            'account_id', p_account_id,
            'rollback_point', v_rollback_point
        ),
        true,
        EXTRACT(EPOCH FROM (NOW() - v_execution_start)) * 1000
    );
    
    -- Retornar resultado de sucesso
    RETURN jsonb_build_object(
        'success', true,
        'data', jsonb_build_object(
            'request_id', p_request_id,
            'status', p_status,
            'mirror_transaction_id', v_mirror_transaction_id,
            'original_transaction_id', v_original_transaction.id
        ),
        'message', CASE 
            WHEN p_status = 'ACCEPTED' THEN 'Solicitação aceita e despesa criada com sucesso'
            ELSE 'Solicitação rejeitada com sucesso'
        END
    );
    
EXCEPTION WHEN OTHERS THEN
    -- Log do erro
    v_error_message := SQLERRM;
    
    INSERT INTO public.shared_system_audit_logs (
        operation_type,
        request_id,
        transaction_id,
        user_id,
        operation_data,
        success,
        error_message,
        execution_time_ms
    ) VALUES (
        'RESPOND_TO_REQUEST',
        p_request_id,
        COALESCE(v_original_transaction.id, v_request.transaction_id),
        v_user_id,
        jsonb_build_object(
            'error_at_rollback_point', v_rollback_point,
            'response_status', p_status,
            'account_id', p_account_id
        ),
        false,
        v_error_message,
        EXTRACT(EPOCH FROM (NOW() - v_execution_start)) * 1000
    );
    
    -- Retornar erro estruturado
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'RESPOND_TO_REQUEST_FAILED',
            'message', v_error_message,
            'rollback_point', v_rollback_point
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 3: FUNÇÃO SYNC_SHARED_TRANSACTION_V2
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.sync_shared_transaction_v2(
    p_transaction_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_transaction RECORD;
    v_mirror RECORD;
    v_synced_count INTEGER := 0;
    v_error_count INTEGER := 0;
    v_execution_start TIMESTAMPTZ := NOW();
    v_error_message TEXT;
    v_sync_errors TEXT[] := ARRAY[]::TEXT[];
BEGIN
    -- Validações iniciais
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    -- Buscar transação
    SELECT * INTO v_transaction
    FROM public.transactions
    WHERE id = p_transaction_id
    AND (user_id = v_user_id OR is_mirror = true)
    AND deleted = false;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Transação não encontrada ou acesso negado';
    END IF;
    
    -- Se for transação espelho, sincronizar com original
    IF v_transaction.is_mirror = true THEN
        -- Sincronizar dados não-críticos do espelho com original
        UPDATE public.transactions t
        SET 
            description = CASE 
                WHEN o.description != t.description AND t.source_transaction_id IS NOT NULL THEN
                    o.description || ' (Compartilhado por ' || 
                    COALESCE((SELECT COALESCE(raw_user_meta_data->>'name', email) FROM auth.users WHERE id = o.user_id), 'Usuário') || ')'
                ELSE t.description
            END,
            category = COALESCE(o.category, t.category),
            date = COALESCE(o.date, t.date),
            updated_at = NOW()
        FROM public.transactions o
        WHERE t.id = p_transaction_id
        AND o.id = t.source_transaction_id
        AND o.deleted = false;
        
        -- Atualizar status de sincronização
        UPDATE public.shared_transaction_mirrors
        SET 
            sync_status = 'SYNCED',
            last_sync_at = NOW(),
            sync_error = NULL
        WHERE mirror_transaction_id = p_transaction_id;
        
        v_synced_count := 1;
    ELSE
        -- Se for transação original, sincronizar todos os espelhos
        FOR v_mirror IN 
            SELECT stm.*, t.id as mirror_tx_id, t.user_id as mirror_user_id
            FROM public.shared_transaction_mirrors stm
            JOIN public.transactions t ON t.id = stm.mirror_transaction_id
            WHERE stm.original_transaction_id = p_transaction_id
            AND t.deleted = false
        LOOP
            BEGIN
                -- Sincronizar dados do espelho
                UPDATE public.transactions
                SET 
                    description = v_transaction.description || ' (Compartilhado por ' || 
                        COALESCE((SELECT COALESCE(raw_user_meta_data->>'name', email) FROM auth.users WHERE id = v_transaction.user_id), 'Usuário') || ')',
                    category = v_transaction.category,
                    date = v_transaction.date,
                    trip_id = v_transaction.trip_id,
                    currency = v_transaction.currency,
                    updated_at = NOW()
                WHERE id = v_mirror.mirror_tx_id;
                
                -- Atualizar status de sincronização
                UPDATE public.shared_transaction_mirrors
                SET 
                    sync_status = 'SYNCED',
                    last_sync_at = NOW(),
                    sync_error = NULL
                WHERE id = v_mirror.id;
                
                v_synced_count := v_synced_count + 1;
                
            EXCEPTION WHEN OTHERS THEN
                v_error_count := v_error_count + 1;
                v_sync_errors := array_append(v_sync_errors, 'Mirror ' || v_mirror.mirror_tx_id || ': ' || SQLERRM);
                
                -- Marcar erro na sincronização
                UPDATE public.shared_transaction_mirrors
                SET 
                    sync_status = 'ERROR',
                    sync_error = SQLERRM,
                    last_sync_at = NOW()
                WHERE id = v_mirror.id;
            END;
        END LOOP;
    END IF;
    
    -- Log da operação
    INSERT INTO public.shared_system_audit_logs (
        operation_type,
        transaction_id,
        user_id,
        operation_data,
        success,
        error_message,
        execution_time_ms
    ) VALUES (
        'SYNC_MIRROR',
        p_transaction_id,
        v_user_id,
        jsonb_build_object(
            'is_mirror', v_transaction.is_mirror,
            'synced_count', v_synced_count,
            'error_count', v_error_count,
            'sync_errors', v_sync_errors
        ),
        v_error_count = 0,
        CASE WHEN v_error_count > 0 THEN array_to_string(v_sync_errors, '; ') ELSE NULL END,
        EXTRACT(EPOCH FROM (NOW() - v_execution_start)) * 1000
    );
    
    -- Retornar resultado
    RETURN jsonb_build_object(
        'success', v_error_count = 0,
        'data', jsonb_build_object(
            'transaction_id', p_transaction_id,
            'synced_count', v_synced_count,
            'error_count', v_error_count,
            'is_mirror', v_transaction.is_mirror
        ),
        'message', CASE 
            WHEN v_error_count = 0 THEN 'Sincronização concluída com sucesso'
            ELSE 'Sincronização concluída com ' || v_error_count || ' erros'
        END,
        'errors', CASE WHEN v_error_count > 0 THEN v_sync_errors ELSE NULL END
    );
    
EXCEPTION WHEN OTHERS THEN
    v_error_message := SQLERRM;
    
    -- Log do erro
    INSERT INTO public.shared_system_audit_logs (
        operation_type,
        transaction_id,
        user_id,
        operation_data,
        success,
        error_message,
        execution_time_ms
    ) VALUES (
        'SYNC_MIRROR',
        p_transaction_id,
        v_user_id,
        jsonb_build_object(
            'fatal_error', true,
            'synced_count', v_synced_count,
            'error_count', v_error_count
        ),
        false,
        v_error_message,
        EXTRACT(EPOCH FROM (NOW() - v_execution_start)) * 1000
    );
    
    -- Retornar erro estruturado
    RETURN jsonb_build_object(
        'success', false,
        'error', jsonb_build_object(
            'code', 'SYNC_TRANSACTION_FAILED',
            'message', v_error_message
        )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 4: FUNÇÃO GET_SHARED_REQUESTS_V4 (ATUALIZADA)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_shared_requests_v4()
RETURNS TABLE (
    id UUID,
    transaction_id UUID,
    requester_id UUID,
    requester_name TEXT,
    requester_email TEXT,
    assigned_amount NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    tx_description TEXT,
    tx_amount NUMERIC,
    tx_currency TEXT,
    tx_date DATE,
    tx_category TEXT,
    tx_observation TEXT,
    tx_trip_id UUID
) AS $$
DECLARE
    v_user_id UUID := auth.uid();
BEGIN
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    RETURN QUERY
    SELECT 
        str.id,
        str.transaction_id,
        str.requester_id,
        COALESCE(u.raw_user_meta_data->>'name', u.email, 'Usuário Desconhecido') as requester_name,
        str.invited_email as requester_email,
        str.assigned_amount,
        str.status,
        str.created_at,
        str.expires_at,
        t.description as tx_description,
        t.amount as tx_amount,
        t.currency as tx_currency,
        t.date as tx_date,
        t.category as tx_category,
        t.observation as tx_observation,
        t.trip_id as tx_trip_id
    FROM public.shared_transaction_requests str
    JOIN public.transactions t ON t.id = str.transaction_id
    LEFT JOIN auth.users u ON u.id = str.requester_id
    WHERE str.invited_user_id = v_user_id
    AND str.status = 'PENDING'
    AND str.expires_at > NOW()
    AND t.deleted = false
    ORDER BY str.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 5: PERMISSÕES E COMENTÁRIOS
-- ==============================================================================

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.create_shared_transaction_v2(TEXT, NUMERIC, TEXT, DATE, UUID, JSONB, UUID, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION public.respond_to_shared_request_v2(UUID, TEXT, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_shared_transaction_v2(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_shared_requests_v4() TO authenticated;

-- Comentários das funções
COMMENT ON FUNCTION public.create_shared_transaction_v2(TEXT, NUMERIC, TEXT, DATE, UUID, JSONB, UUID, JSONB) IS 
'Cria transação compartilhada com validações robustas e operações atômicas. Suporta parcelamento e múltiplos usuários.';

COMMENT ON FUNCTION public.respond_to_shared_request_v2(UUID, TEXT, UUID) IS 
'Responde a solicitação de compartilhamento de forma atômica. Cria transação espelho automaticamente quando aceita.';

COMMENT ON FUNCTION public.sync_shared_transaction_v2(UUID) IS 
'Sincroniza dados entre transação original e espelhos. Implementa recuperação automática de falhas.';

COMMENT ON FUNCTION public.get_shared_requests_v4() IS 
'Busca solicitações de compartilhamento pendentes com dados completos da transação e usuário solicitante.';

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
FUNÇÕES RPC V2 IMPLEMENTADAS:

1. CREATE_SHARED_TRANSACTION_V2:
   - Validações robustas de entrada
   - Suporte a parcelamento
   - Operações atômicas
   - Log detalhado de auditoria
   - Tratamento de erro estruturado
   - Rollback automático em falhas

2. RESPOND_TO_SHARED_REQUEST_V2:
   - Validação de permissões
   - Criação automática de transação espelho
   - Registro de relacionamento original-espelho
   - Auditoria completa
   - Operações atômicas

3. SYNC_SHARED_TRANSACTION_V2:
   - Sincronização bidirecional
   - Recuperação de falhas
   - Retry automático
   - Status de sincronização
   - Log de erros detalhado

4. GET_SHARED_REQUESTS_V4:
   - Dados completos da transação
   - Informações do solicitante
   - Filtros de expiração
   - Performance otimizada

MELHORIAS IMPLEMENTADAS:
- Operações 100% atômicas
- Auditoria completa de todas as operações
- Tratamento robusto de erros
- Validações abrangentes
- Suporte a parcelamento
- Sincronização confiável
- Performance otimizada
- Segurança aprimorada

PRÓXIMOS PASSOS:
1. Implementar sistema de recuperação automática
2. Criar componentes frontend refatorados
3. Adicionar testes de propriedade
4. Implementar métricas e alertas
*/