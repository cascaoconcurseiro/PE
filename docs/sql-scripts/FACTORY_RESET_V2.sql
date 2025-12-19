-- ============================================================================
-- FACTORY RESET V2 - SMART & SAFE
-- ============================================================================
-- Execute este script no Supabase SQL Editor
-- ============================================================================

-- DROP da função antiga
DROP FUNCTION IF EXISTS public.fn_smart_factory_reset(boolean);
DROP FUNCTION IF EXISTS public.fn_smart_factory_reset(uuid, boolean);

-- ============================================================================
-- FUNÇÃO PRINCIPAL: FACTORY RESET INTELIGENTE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_smart_factory_reset(
    p_user_id uuid DEFAULT NULL,
    p_unlink_family boolean DEFAULT false
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid;
    v_deleted_transactions int := 0;
    v_deleted_accounts int := 0;
    v_deleted_budgets int := 0;
    v_deleted_goals int := 0;
    v_deleted_assets int := 0;
    v_deleted_trips int := 0;
    v_deleted_members int := 0;
BEGIN
    -- Usar user_id passado ou auth.uid()
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Validação
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não identificado');
    END IF;

    -- ========================================================================
    -- FASE 0: DESABILITAR CONSTRAINTS TEMPORARIAMENTE (via deferrable)
    -- ========================================================================
    
    -- Marcar dívidas como settled (onde outro pagou por mim)
    -- Isso evita que fiquem pendências após o reset
    BEGIN
        UPDATE public.transactions
        SET 
            shared_with = (
                SELECT jsonb_agg(
                    CASE 
                        WHEN elem->>'memberId' = 'me' OR elem->>'memberId' = v_user_id::text
                        THEN jsonb_set(jsonb_set(elem, '{isSettled}', 'true'), '{settledAt}', to_jsonb(NOW()::text))
                        ELSE elem
                    END
                )
                FROM jsonb_array_elements(shared_with) elem
            ),
            updated_at = NOW()
        WHERE 
            user_id != v_user_id
            AND is_shared = true
            AND shared_with IS NOT NULL
            AND jsonb_array_length(COALESCE(shared_with, '[]'::jsonb)) > 0;
    EXCEPTION WHEN OTHERS THEN
        NULL; -- Ignorar erros nesta fase
    END;

    -- Cancelar settlement requests pendentes
    BEGIN
        UPDATE public.settlement_requests
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE (payer_id = v_user_id OR receiver_id = v_user_id)
          AND status = 'PENDING';
    EXCEPTION WHEN OTHERS THEN
        NULL;
    END;

    -- ========================================================================
    -- FASE 1: DELETAR DADOS DEPENDENTES PRIMEIRO (ordem importa!)
    -- ========================================================================
    
    -- 1.1 Deletar notificações (sem dependências)
    BEGIN
        DELETE FROM public.notifications WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 1.2 Deletar snapshots (sem dependências)
    BEGIN
        DELETE FROM public.snapshots WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 1.3 Deletar custom_categories (sem dependências)
    BEGIN
        DELETE FROM public.custom_categories WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 1.4 Deletar assets (sem dependências)
    BEGIN
        DELETE FROM public.assets WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_assets = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 1.5 Deletar goals (sem dependências)
    BEGIN
        DELETE FROM public.goals WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_goals = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 1.6 Deletar budgets (sem dependências)
    BEGIN
        DELETE FROM public.budgets WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_budgets = ROW_COUNT;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 1.7 Deletar trip_participant_budgets
    BEGIN
        DELETE FROM public.trip_participant_budgets WHERE user_id = v_user_id;
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- ========================================================================
    -- FASE 2: DELETAR TRANSAÇÕES (podem ter self-references)
    -- ========================================================================
    
    -- 2.1 Primeiro: Remover referências de source_transaction_id
    BEGIN
        UPDATE public.transactions 
        SET source_transaction_id = NULL 
        WHERE source_transaction_id IN (
            SELECT id FROM public.transactions WHERE user_id = v_user_id
        );
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.2 Deletar transações filhas (cópias compartilhadas)
    BEGIN
        DELETE FROM public.transactions
        WHERE source_transaction_id IN (
            SELECT id FROM public.transactions WHERE user_id = v_user_id
        );
    EXCEPTION WHEN OTHERS THEN NULL; END;

    -- 2.3 Deletar todas as transações do usuário
    DELETE FROM public.transactions WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

    -- ========================================================================
    -- FASE 3: DELETAR CONTAS (após transações)
    -- ========================================================================
    
    DELETE FROM public.accounts WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- ========================================================================
    -- FASE 4: VIAGENS
    -- ========================================================================
    
    IF p_unlink_family THEN
        -- Remover usuário de viagens de outros (JSONB participants)
        BEGIN
            UPDATE public.trips
            SET participants = (
                SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
                FROM jsonb_array_elements(participants) elem
                WHERE elem->>'id' != v_user_id::text
            )
            WHERE participants IS NOT NULL
              AND user_id != v_user_id
              AND participants::text LIKE '%' || v_user_id::text || '%';
        EXCEPTION WHEN OTHERS THEN NULL; END;

        -- Deletar viagens que o usuário criou
        BEGIN
            DELETE FROM public.trips WHERE user_id = v_user_id;
            GET DIAGNOSTICS v_deleted_trips = ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- ========================================================================
    -- FASE 5: FAMÍLIA (apenas se unlink_family = true)
    -- ========================================================================
    
    IF p_unlink_family THEN
        -- Deletar membros de família do usuário
        BEGIN
            DELETE FROM public.family_members WHERE user_id = v_user_id;
            GET DIAGNOSTICS v_deleted_members = ROW_COUNT;
        EXCEPTION WHEN OTHERS THEN NULL; END;
        
        -- Remover vínculo do usuário em outros perfis
        BEGIN
            DELETE FROM public.family_members WHERE linked_user_id = v_user_id;
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END IF;

    -- ========================================================================
    -- RETORNO COM ESTATÍSTICAS
    -- ========================================================================
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'transactions', v_deleted_transactions,
            'accounts', v_deleted_accounts,
            'budgets', v_deleted_budgets,
            'goals', v_deleted_goals,
            'assets', v_deleted_assets,
            'trips', v_deleted_trips,
            'family_members', v_deleted_members
        ),
        'unlink_family', p_unlink_family
    );

EXCEPTION WHEN OTHERS THEN
    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$$;

-- ============================================================================
-- GRANT de permissões
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.fn_smart_factory_reset(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_smart_factory_reset(uuid, boolean) TO service_role;

-- ============================================================================
-- COMENTÁRIO
-- ============================================================================
COMMENT ON FUNCTION public.fn_smart_factory_reset IS 
'Factory Reset v2 - Deleta todos os dados do usuário.
Parâmetros:
- p_user_id: UUID do usuário (opcional, usa auth.uid() se não informado)
- p_unlink_family: Se true, também remove viagens e vínculos familiares
Retorna JSON com estatísticas de deleção.';
