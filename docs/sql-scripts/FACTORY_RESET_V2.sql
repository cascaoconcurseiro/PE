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
-- Recebe user_id explicitamente para garantir que funciona via RPC
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
    -- FASE 1: RESOLVER PENDÊNCIAS COMPARTILHADAS
    -- ========================================================================
    
    -- Marcar dívidas como settled (onde outro pagou por mim)
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

    -- Cancelar settlement requests pendentes
    UPDATE public.settlement_requests
    SET status = 'CANCELLED', updated_at = NOW()
    WHERE (payer_id = v_user_id OR receiver_id = v_user_id)
      AND status = 'PENDING';

    -- ========================================================================
    -- FASE 2: DELETAR TRANSAÇÕES
    -- ========================================================================
    
    -- Deletar transações filhas primeiro (foreign key)
    DELETE FROM public.transactions
    WHERE source_transaction_id IN (
        SELECT id FROM public.transactions WHERE user_id = v_user_id
    );

    -- Deletar todas as transações do usuário
    DELETE FROM public.transactions WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

    -- ========================================================================
    -- FASE 3: DELETAR CONTAS
    -- ========================================================================
    
    DELETE FROM public.accounts WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- ========================================================================
    -- FASE 4: DELETAR OUTROS DADOS FINANCEIROS
    -- ========================================================================
    
    -- Budgets
    DELETE FROM public.budgets WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_budgets = ROW_COUNT;

    -- Goals
    DELETE FROM public.goals WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_goals = ROW_COUNT;

    -- Assets
    DELETE FROM public.assets WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_assets = ROW_COUNT;

    -- Snapshots
    DELETE FROM public.snapshots WHERE user_id = v_user_id;

    -- Custom Categories
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;

    -- Notifications
    DELETE FROM public.notifications WHERE user_id = v_user_id;

    -- ========================================================================
    -- FASE 5: VIAGENS
    -- ========================================================================
    
    -- Deletar budgets de viagem do usuário
    DELETE FROM public.trip_participant_budgets WHERE user_id = v_user_id;

    IF p_unlink_family THEN
        -- Deletar viagens que o usuário criou
        DELETE FROM public.trips WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_trips = ROW_COUNT;

        -- Remover usuário de viagens de outros (JSONB participants)
        UPDATE public.trips
        SET participants = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(participants) elem
            WHERE elem->>'id' != v_user_id::text
        )
        WHERE participants IS NOT NULL
          AND user_id != v_user_id
          AND participants::text LIKE '%' || v_user_id::text || '%';
    END IF;

    -- ========================================================================
    -- FASE 6: FAMÍLIA (apenas se unlink_family = true)
    -- ========================================================================
    
    IF p_unlink_family THEN
        -- Deletar membros de família do usuário
        DELETE FROM public.family_members WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_members = ROW_COUNT;
        
        -- Remover vínculo do usuário em outros perfis
        DELETE FROM public.family_members WHERE linked_user_id = v_user_id;
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
