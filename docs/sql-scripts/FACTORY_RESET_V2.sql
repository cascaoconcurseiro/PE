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

    -- Desabilitar triggers temporariamente para performance
    SET session_replication_role = 'replica';

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
                    WHEN (elem->>'memberId') = 'me' OR (elem->>'memberId')::uuid = v_user_id
                    THEN elem || '{"isSettled": true, "settledAt": "' || NOW()::text || '"}'::jsonb
                    ELSE elem
                END
            )
            FROM jsonb_array_elements(shared_with) elem
        ),
        updated_at = NOW()
    WHERE 
        user_id != v_user_id  -- Transação de outro usuário
        AND is_shared = true
        AND shared_with IS NOT NULL
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(shared_with) elem
            WHERE (elem->>'memberId') = 'me' 
               OR (elem->>'memberId')::uuid = v_user_id
        );

    -- 1.2 Notificar usuários que tinham transações compartilhadas COMIGO (eu criei, eles deviam)
    FOR v_tx_record IN 
        SELECT DISTINCT 
            t.id,
            t.description,
            t.amount,
            fm.linked_user_id as debtor_user_id
        FROM public.transactions t
        CROSS JOIN LATERAL jsonb_array_elements(t.shared_with) elem
        LEFT JOIN public.family_members fm ON fm.user_id = v_user_id 
            AND (fm.id::text = elem->>'memberId' OR fm.linked_user_id::text = elem->>'memberId')
        WHERE t.user_id = v_user_id
          AND t.is_shared = true
          AND t.shared_with IS NOT NULL
          AND fm.linked_user_id IS NOT NULL
    LOOP
        -- Criar notificação para o devedor
        INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
        VALUES (
            v_tx_record.debtor_user_id,
            'SHARED_CANCELLED',
            'Transação compartilhada cancelada',
            v_user_name || ' resetou a conta. A dívida de R$ ' || v_tx_record.amount || ' (' || v_tx_record.description || ') foi cancelada.',
            jsonb_build_object('transaction_id', v_tx_record.id, 'cancelled_by', v_user_id),
            NOW()
        );
    END LOOP;

    -- 1.3 Cancelar settlement requests pendentes
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
        
        -- 3.1 Notificar participantes de viagens que vou deletar
        FOR v_trip_record IN 
            SELECT t.id, t.name, tp.user_id as participant_user_id
            FROM public.trips t
            LEFT JOIN public.trip_participants tp ON tp.trip_id = t.id
            WHERE t.user_id = v_user_id
              AND tp.user_id != v_user_id
        LOOP
            INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
            VALUES (
                v_trip_record.participant_user_id,
                'TRIP_DELETED',
                'Viagem excluída',
                v_user_name || ' excluiu a viagem "' || v_trip_record.name || '".',
                jsonb_build_object('trip_id', v_trip_record.id, 'deleted_by', v_user_id),
                NOW()
            );
        END LOOP;

        -- 3.2 Deletar participações em viagens (tabela relacional se existir)
        DELETE FROM public.trip_participants WHERE user_id = v_user_id;
        
        -- 3.3 Deletar budgets de viagem
        DELETE FROM public.trip_participant_budgets WHERE user_id = v_user_id;

        -- 3.4 Deletar viagens que eu criei
        DELETE FROM public.trips WHERE user_id = v_user_id;

        -- 3.5 Me remover de viagens de outros (atualizar JSONB participants se usado)
        UPDATE public.trips
        SET participants = (
            SELECT jsonb_agg(elem)
            FROM jsonb_array_elements(participants) elem
            WHERE (elem->>'id')::uuid != v_user_id
              AND elem->>'id' != v_user_id::text
        )
        WHERE participants IS NOT NULL
          AND user_id != v_user_id
          AND (
              participants @> jsonb_build_array(jsonb_build_object('id', v_user_id::text))
              OR participants::text LIKE '%' || v_user_id::text || '%'
          );

    ELSE
        -- RESET FINANCEIRO: Manter estrutura de viagens, só limpar despesas
        -- As transações já foram deletadas na Fase 2
        -- Apenas resetar budgets pessoais de viagem
        DELETE FROM public.trip_participant_budgets WHERE user_id = v_user_id;
    END IF;

    -- ========================================================================
    -- FASE 4: FAMÍLIA (apenas se unlink_family = true)
    -- ========================================================================
    
    IF p_unlink_family THEN
        -- 4.1 Notificar membros vinculados
        FOR v_affected_user_id IN 
            SELECT linked_user_id FROM public.family_members 
            WHERE user_id = v_user_id AND linked_user_id IS NOT NULL
        LOOP
            INSERT INTO public.notifications (user_id, type, title, message, data, created_at)
            VALUES (
                v_affected_user_id,
                'FAMILY_UNLINKED',
                'Vínculo familiar removido',
                v_user_name || ' removeu o vínculo de compartilhamento com você.',
                jsonb_build_object('unlinked_by', v_user_id),
                NOW()
            );
        END LOOP;

        -- 4.2 Deletar meus membros de família
        DELETE FROM public.family_members WHERE user_id = v_user_id;
        
        -- 4.3 Remover meu vínculo dos membros de outros
        DELETE FROM public.family_members WHERE linked_user_id = v_user_id;
    END IF;

    -- ========================================================================
    -- FASE 5: LIMPEZA FINAL
    -- ========================================================================
    
    -- 5.1 Limpar logs de auditoria (opcional - comentar se quiser manter)
    DELETE FROM public.audit_logs WHERE changed_by = v_user_id;

    -- Restaurar triggers
    SET session_replication_role = 'origin';

EXCEPTION WHEN OTHERS THEN
    -- Garantir que triggers são restaurados mesmo em caso de erro
    SET session_replication_role = 'origin';
    RAISE;
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
Notifica usuários afetados e quita dívidas automaticamente.';
