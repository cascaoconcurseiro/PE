-- ==============================================================================
-- FIX: ERRO "operator does not exist: uuid = text"
-- DATA: 2025-12-19
-- PROBLEMA: Comparação entre UUID e TEXT nas funções de compartilhamento
-- ==============================================================================

BEGIN;

-- ============================================================================
-- PARTE 1: CORRIGIR FUNÇÃO create_transaction
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb,
    p_payer_id TEXT DEFAULT NULL,
    p_currency TEXT DEFAULT 'BRL'
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
    v_final_payer_id TEXT;
BEGIN
    -- Validação de autenticação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Domain Resolution: TRAVEL se tem trip, SHARED se compartilhado, senão PERSONAL
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSIF p_is_shared = TRUE OR (p_shared_with IS NOT NULL AND jsonb_array_length(p_shared_with) > 0) THEN
        v_final_domain := 'SHARED';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- Validação de Transferência
    IF p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL THEN
        RAISE EXCEPTION 'Transferência requer conta de destino.';
    END IF;

    -- Sanitizar payer_id: 'me' ou vazio = NULL
    v_final_payer_id := CASE 
        WHEN p_payer_id IS NULL OR p_payer_id = '' OR p_payer_id = 'me' THEN NULL 
        ELSE p_payer_id 
    END;

    -- Inserção da transação
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id,
        currency,
        created_at, updated_at
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with, v_final_payer_id,
        p_currency,
        NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    -- Sincronizar transações compartilhadas (criar mirrors)
    IF p_is_shared = TRUE AND p_shared_with IS NOT NULL AND jsonb_array_length(p_shared_with) > 0 THEN
        BEGIN
            PERFORM public.sync_shared_transaction(v_new_id);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '[create_transaction] Sync compartilhado falhou para ID %: %', v_new_id, SQLERRM;
        END;
    END IF;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- PARTE 2: CORRIGIR FUNÇÃO sync_shared_transaction (CAST EXPLÍCITO)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.sync_shared_transaction(p_tx_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tx_rec RECORD;
    v_split JSONB;
    v_target_member_id UUID;
    v_target_user_id UUID;
    v_target_trip_id UUID;
    v_inviter_name TEXT;
    v_dynamic_domain TEXT;
BEGIN
    -- Buscar transação
    SELECT * INTO v_tx_rec FROM public.transactions WHERE id = p_tx_id;
    
    -- Verificar se é compartilhada e tem splits
    IF v_tx_rec IS NULL THEN
        RAISE NOTICE '[sync_shared_transaction] Transação % não encontrada', p_tx_id;
        RETURN;
    END IF;
    
    IF NOT (v_tx_rec.is_shared = true AND v_tx_rec.shared_with IS NOT NULL AND jsonb_array_length(v_tx_rec.shared_with) > 0) THEN
        RAISE NOTICE '[sync_shared_transaction] Transação % não é compartilhada ou não tem splits', p_tx_id;
        RETURN;
    END IF;
    
    -- Obter nome do criador
    SELECT COALESCE(raw_user_meta_data->>'name', email, 'Alguém') INTO v_inviter_name 
    FROM auth.users WHERE id = v_tx_rec.user_id;

    -- Iterar sobre cada split
    FOR v_split IN SELECT * FROM jsonb_array_elements(v_tx_rec.shared_with)
    LOOP
        v_target_member_id := (v_split->>'memberId')::UUID;
        
        -- Buscar user_id vinculado ao membro
        SELECT linked_user_id INTO v_target_user_id 
        FROM public.family_members 
        WHERE id = v_target_member_id;
        
        -- Só criar mirror se o membro tem usuário vinculado e não é o próprio criador
        IF v_target_user_id IS NOT NULL AND v_target_user_id != v_tx_rec.user_id THEN
            
            -- Verificar/Criar Trip Mirror se necessário
            v_target_trip_id := NULL;
            IF v_tx_rec.trip_id IS NOT NULL THEN
                SELECT id INTO v_target_trip_id FROM public.trips 
                WHERE source_trip_id = v_tx_rec.trip_id AND user_id = v_target_user_id;
                
                IF v_target_trip_id IS NULL THEN
                    BEGIN
                        PERFORM public.sync_shared_trip(v_tx_rec.trip_id);
                        SELECT id INTO v_target_trip_id FROM public.trips 
                        WHERE source_trip_id = v_tx_rec.trip_id AND user_id = v_target_user_id;
                    EXCEPTION WHEN OTHERS THEN
                        RAISE NOTICE '[sync_shared_transaction] Erro ao sincronizar viagem: %', SQLERRM;
                    END;
                END IF;
            END IF;

            -- Determinar domain
            v_dynamic_domain := CASE WHEN v_target_trip_id IS NOT NULL THEN 'TRAVEL' ELSE 'SHARED' END;

            -- Verificar se mirror já existe (CAST EXPLÍCITO para evitar erro uuid = text)
            IF NOT EXISTS (
                SELECT 1 FROM public.transactions 
                WHERE user_id = v_target_user_id 
                  AND payer_id = v_tx_rec.user_id::TEXT  -- CAST para TEXT
                  AND date = v_tx_rec.date
                  AND amount = (v_split->>'assignedAmount')::NUMERIC
                  AND description LIKE v_tx_rec.description || '%'
                  AND deleted = false
            ) THEN
                -- Inserir transação espelhada
                INSERT INTO public.transactions (
                    user_id, 
                    amount, 
                    date, 
                    description, 
                    category, 
                    type,
                    domain,
                    is_shared, 
                    payer_id,
                    source_transaction_id,
                    shared_with, 
                    trip_id,
                    currency,
                    exchange_rate,
                    is_installment,
                    current_installment,
                    total_installments,
                    series_id,
                    created_at, 
                    updated_at
                ) VALUES (
                    v_target_user_id, 
                    (v_split->>'assignedAmount')::NUMERIC, 
                    v_tx_rec.date, 
                    v_tx_rec.description || ' (' || v_inviter_name || ')', 
                    v_tx_rec.category,
                    'DESPESA',
                    v_dynamic_domain,
                    true, 
                    v_tx_rec.user_id::TEXT,  -- CAST para TEXT
                    v_tx_rec.id,
                    '[]'::jsonb,
                    v_target_trip_id,
                    v_tx_rec.currency,
                    v_tx_rec.exchange_rate,
                    v_tx_rec.is_installment,
                    v_tx_rec.current_installment,
                    v_tx_rec.total_installments,
                    v_tx_rec.series_id,
                    NOW(), 
                    NOW()
                );
                
                RAISE NOTICE '[sync_shared_transaction] Mirror criado para user %', v_target_user_id;
            END IF;
        END IF;
    END LOOP;
END;
$$;

-- ============================================================================
-- PARTE 3: CORRIGIR TRIGGER DE NOTIFICAÇÃO (CAST EXPLÍCITO)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.notify_shared_transaction()
RETURNS TRIGGER AS $$
DECLARE
    shared_member RECORD;
    member_user_id UUID;
    creator_name TEXT;
    tx_description TEXT;
    tx_amount NUMERIC;
    total_amount NUMERIC;
    installment_info TEXT;
BEGIN
    -- Só processar se a transação é compartilhada e tem sharedWith
    IF NEW.is_shared = TRUE AND NEW.shared_with IS NOT NULL AND jsonb_array_length(NEW.shared_with) > 0 THEN
        
        -- SE FOR PARCELADO: Só notificar na PRIMEIRA parcela
        IF NEW.is_installment = TRUE AND NEW.current_installment IS NOT NULL THEN
            IF NEW.current_installment > 1 THEN
                RETURN NEW;
            END IF;
            total_amount := NEW.amount * COALESCE(NEW.total_installments, 1);
            installment_info := ' (' || COALESCE(NEW.total_installments, 1)::TEXT || 'x de R$ ' || ROUND(NEW.amount, 2)::TEXT || ')';
        ELSE
            total_amount := NEW.amount;
            installment_info := '';
        END IF;
        
        -- Obter nome do criador
        SELECT COALESCE(raw_user_meta_data->>'name', email) INTO creator_name 
        FROM auth.users 
        WHERE id = NEW.user_id;
        
        -- Limpar descrição
        tx_description := regexp_replace(NEW.description, ' \(\d+/\d+\)$', '');
        tx_amount := total_amount;
        
        -- Iterar sobre cada membro compartilhado
        FOR shared_member IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            -- Buscar o user_id vinculado ao membro familiar
            SELECT linked_user_id INTO member_user_id
            FROM public.family_members
            WHERE id = (shared_member.value->>'memberId')::UUID
              AND linked_user_id IS NOT NULL;
            
            -- Se o membro tem um usuário vinculado e não é o próprio criador
            IF member_user_id IS NOT NULL AND member_user_id != NEW.user_id THEN
                
                -- Verificar se já existe notificação recente para esta série
                IF NEW.series_id IS NOT NULL THEN
                    IF EXISTS (
                        SELECT 1 FROM public.user_notifications
                        WHERE user_id = member_user_id
                          AND type = 'SHARED_EXPENSE'
                          AND (metadata->>'seriesId')::UUID = NEW.series_id
                          AND created_at > NOW() - INTERVAL '1 minute'
                    ) THEN
                        CONTINUE;
                    END IF;
                END IF;
                
                -- Inserir notificação
                INSERT INTO public.user_notifications (
                    user_id,
                    type,
                    title,
                    message,
                    metadata,
                    is_read,
                    created_at
                ) VALUES (
                    member_user_id,
                    'SHARED_EXPENSE',
                    'Nova Despesa Compartilhada',
                    COALESCE(creator_name, 'Alguém') || ' compartilhou uma despesa com você: ' || tx_description || installment_info || ' - Total: R$ ' || ROUND(tx_amount, 2)::TEXT,
                    jsonb_build_object(
                        'transactionId', NEW.id::TEXT,
                        'seriesId', NEW.series_id::TEXT,
                        'creatorId', NEW.user_id::TEXT,
                        'amount', NEW.amount,
                        'totalAmount', tx_amount,
                        'description', tx_description,
                        'isInstallment', COALESCE(NEW.is_installment, false),
                        'totalInstallments', NEW.total_installments,
                        'assignedAmount', (shared_member.value->>'assignedAmount')::NUMERIC
                    ),
                    FALSE,
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- Verificar se as funções foram atualizadas
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN ('create_transaction', 'sync_shared_transaction', 'notify_shared_transaction')
  AND routine_schema = 'public';
