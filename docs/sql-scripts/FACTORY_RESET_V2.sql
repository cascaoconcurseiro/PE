-- ============================================================================
-- FACTORY RESET V2 - SMART & SAFE
-- ============================================================================
-- Execute este script no Supabase SQL Editor
-- Substitui a função fn_smart_factory_reset com lógica melhorada
-- ============================================================================

-- DROP da função antiga (se existir)
DROP FUNCTION IF EXISTS public.fn_smart_factory_reset(boolean);

-- ============================================================================
-- FUNÇÃO PRINCIPAL: FACTORY RESET INTELIGENTE
-- ============================================================================
CREATE OR REPLACE FUNCTION public.fn_smart_factory_reset(p_unlink_family boolean DEFAULT false)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id uuid := auth.uid();
    v_user_name text;
    v_affected_user_id uuid;
    v_trip_record RECORD;
    v_tx_record RECORD;
BEGIN
    -- Validação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- Buscar nome do usuário para notificações
    SELECT COALESCE(raw_user_meta_data->>'name', email, 'Usuário') INTO v_user_name
    FROM auth.users WHERE id = v_user_id;

    -- ========================================================================
    -- FASE 1: RESOLVER PENDÊNCIAS COMPARTILHADAS
    -- ========================================================================
    
    -- 1.1 Transações onde EU sou devedor (outro pagou por mim)
    -- Marcar como settled para não deixar dívida pendente
    UPDATE public.transactions
    SET 
        shared_with = (
            SELECT jsonb_agg(
                CASE 
                    WHEN (elem->>'memberId') = 'me' OR (elem->>'memberId')::text = v_user_id::text
                    THEN jsonb_set(
                        jsonb_set(elem, '{isSettled}', 'true'::jsonb),
                        '{settledAt}',
                        to_jsonb(NOW()::text)
                    )
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
        AND jsonb_array_length(shared_with) > 0;

    -- 1.2 Cancelar settlement requests pendentes
    UPDATE public.settlement_requests
    SET status = 'CANCELLED', responded_at = NOW()
    WHERE (payer_id = v_user_id OR receiver_id = v_user_id)
      AND status = 'PENDING';

    -- ========================================================================
    -- FASE 2: LIMPAR DADOS PESSOAIS
    -- ========================================================================
    
    -- 2.1 Deletar transações filhas (cópias de transações que eu criei)
    DELETE FROM public.transactions
    WHERE source_transaction_id IN (
        SELECT id FROM public.transactions WHERE user_id = v_user_id
    );

    -- 2.2 Deletar TODAS as minhas transações
    DELETE FROM public.transactions WHERE user_id = v_user_id;

    -- 2.3 Deletar minhas contas
    DELETE FROM public.accounts WHERE user_id = v_user_id;

    -- 2.4 Deletar budgets
    DELETE FROM public.budgets WHERE user_id = v_user_id;

    -- 2.5 Deletar goals
    DELETE FROM public.goals WHERE user_id = v_user_id;

    -- 2.6 Deletar assets
    DELETE FROM public.assets WHERE user_id = v_user_id;

    -- 2.7 Deletar snapshots
    DELETE FROM public.snapshots WHERE user_id = v_user_id;

    -- 2.8 Deletar categorias customizadas
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;

    -- 2.9 Limpar notificações
    DELETE FROM public.notifications WHERE user_id = v_user_id;

    -- ========================================================================
    -- FASE 3: VIAGENS
    -- ========================================================================
    
    IF p_unlink_family THEN
        -- RESET TOTAL: Deletar viagens que criei e me remover de viagens de outros
        
        -- 3.1 Deletar participações em viagens (tabela relacional se existir)
        BEGIN
            DELETE FROM public.trip_participants WHERE user_id = v_user_id;
        EXCEPTION WHEN undefined_table THEN
            NULL; -- Tabela não existe, ignorar
        END;
        
        -- 3.2 Deletar budgets de viagem
        BEGIN
            DELETE FROM public.trip_participant_budgets WHERE user_id = v_user_id;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;

        -- 3.3 Deletar viagens que eu criei
        DELETE FROM public.trips WHERE user_id = v_user_id;

        -- 3.4 Me remover de viagens de outros (atualizar JSONB participants se usado)
        UPDATE public.trips
        SET participants = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(participants) elem
            WHERE elem->>'id' != v_user_id::text
        )
        WHERE participants IS NOT NULL
          AND user_id != v_user_id
          AND participants::text LIKE '%' || v_user_id::text || '%';

    ELSE
        -- RESET FINANCEIRO: Manter estrutura de viagens, só limpar despesas
        BEGIN
            DELETE FROM public.trip_participant_budgets WHERE user_id = v_user_id;
        EXCEPTION WHEN undefined_table THEN
            NULL;
        END;
    END IF;

    -- ========================================================================
    -- FASE 4: FAMÍLIA (apenas se unlink_family = true)
    -- ========================================================================
    
    IF p_unlink_family THEN
        -- 4.1 Deletar meus membros de família
        DELETE FROM public.family_members WHERE user_id = v_user_id;
        
        -- 4.2 Remover meu vínculo dos membros de outros
        DELETE FROM public.family_members WHERE linked_user_id = v_user_id;
    END IF;

    -- ========================================================================
    -- FASE 5: LIMPEZA FINAL
    -- ========================================================================
    
    -- 5.1 Limpar logs de auditoria
    BEGIN
        DELETE FROM public.audit_logs WHERE changed_by = v_user_id;
    EXCEPTION WHEN undefined_table THEN
        NULL;
    END;

END;
$$;

-- ============================================================================
-- GRANT de permissões
-- ============================================================================
GRANT EXECUTE ON FUNCTION public.fn_smart_factory_reset(boolean) TO authenticated;

-- ============================================================================
-- COMENTÁRIO
-- ============================================================================
COMMENT ON FUNCTION public.fn_smart_factory_reset IS 
'Factory Reset inteligente v2. 
- p_unlink_family = false: Reset financeiro (mantém vínculos)
- p_unlink_family = true: Reset total (remove todos os vínculos)
Quita dívidas automaticamente marcando como settled.';
