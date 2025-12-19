-- ============================================================================
-- FACTORY RESET V2 - SMART & SAFE (CORRIGIDO - CROSS-USER FKs)
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
AS $fn$
DECLARE
    v_user_id uuid;
    v_deleted_transactions int := 0;
    v_deleted_accounts int := 0;
    v_deleted_budgets int := 0;
    v_deleted_goals int := 0;
    v_deleted_assets int := 0;
    v_deleted_trips int := 0;
    v_deleted_members int := 0;
    v_tx_ids uuid[];
    v_acc_ids uuid[];
    v_trip_ids uuid[];
    v_step text := 'INIT';
    v_table_exists boolean;
BEGIN
    -- Usar user_id passado ou auth.uid()
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    -- Validação
    IF v_user_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'error', 'Usuário não identificado');
    END IF;

    v_step := 'COLLECT_IDS';
    
    -- Coletar IDs de transações do usuário
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_tx_ids
    FROM public.transactions
    WHERE user_id = v_user_id;
    
    -- Coletar IDs de contas do usuário
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_acc_ids
    FROM public.accounts
    WHERE user_id = v_user_id;

    -- Coletar IDs de viagens do usuário
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_trip_ids
    FROM public.trips
    WHERE user_id = v_user_id;

    -- ========================================================================
    -- FASE 1: MARCAR DÍVIDAS COMO SETTLED (antes de deletar)
    -- ========================================================================
    v_step := 'SETTLE_DEBTS';
    
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
    v_step := 'CANCEL_SETTLEMENTS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'settlement_requests') INTO v_table_exists;
    IF v_table_exists THEN
        UPDATE public.settlement_requests
        SET status = 'CANCELLED', updated_at = NOW()
        WHERE (payer_id = v_user_id OR receiver_id = v_user_id)
          AND status = 'PENDING';
    END IF;

    -- ========================================================================
    -- FASE 2: DELETAR TABELAS COM FK PARA TRANSACTIONS
    -- ========================================================================
    
    v_step := 'DEL_TRANSACTION_SPLITS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_splits') INTO v_table_exists;
    IF v_table_exists AND array_length(v_tx_ids, 1) > 0 THEN
        DELETE FROM public.transaction_splits WHERE transaction_id = ANY(v_tx_ids);
    END IF;

    v_step := 'DEL_LEDGER_ENTRIES';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_entries') INTO v_table_exists;
    IF v_table_exists AND array_length(v_tx_ids, 1) > 0 THEN
        DELETE FROM public.ledger_entries WHERE transaction_id = ANY(v_tx_ids);
    END IF;

    v_step := 'DEL_TRANSACTION_AUDIT';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'transaction_audit') INTO v_table_exists;
    IF v_table_exists AND array_length(v_tx_ids, 1) > 0 THEN
        DELETE FROM public.transaction_audit WHERE transaction_id = ANY(v_tx_ids);
    END IF;

    v_step := 'DEL_SHARED_TX_REQUESTS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'shared_transaction_requests') INTO v_table_exists;
    IF v_table_exists AND array_length(v_tx_ids, 1) > 0 THEN
        DELETE FROM public.shared_transaction_requests WHERE transaction_id = ANY(v_tx_ids);
    END IF;

    v_step := 'DEL_JOURNAL_ENTRIES';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'journal_entries') INTO v_table_exists;
    IF v_table_exists AND array_length(v_tx_ids, 1) > 0 THEN
        DELETE FROM public.journal_entries WHERE transaction_id = ANY(v_tx_ids);
    END IF;

    -- ========================================================================
    -- FASE 3: LIMPAR SELF-REFERENCES EM TRANSACTIONS
    -- ========================================================================
    
    v_step := 'CLEAR_SOURCE_TX_ID';
    IF array_length(v_tx_ids, 1) > 0 THEN
        UPDATE public.transactions 
        SET source_transaction_id = NULL 
        WHERE source_transaction_id = ANY(v_tx_ids);
    END IF;

    v_step := 'CLEAR_SETTLED_BY_TX_ID';
    IF array_length(v_tx_ids, 1) > 0 THEN
        UPDATE public.transactions 
        SET settled_by_tx_id = NULL 
        WHERE settled_by_tx_id = ANY(v_tx_ids);
    END IF;

    -- ========================================================================
    -- FASE 4: DELETAR MINHAS TRANSAÇÕES
    -- ========================================================================
    
    v_step := 'DEL_MIRROR_TRANSACTIONS';
    IF array_length(v_tx_ids, 1) > 0 THEN
        DELETE FROM public.transactions
        WHERE source_transaction_id = ANY(v_tx_ids)
          AND user_id != v_user_id;
    END IF;

    v_step := 'DEL_MY_TRANSACTIONS';
    DELETE FROM public.transactions WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

    -- ========================================================================
    -- FASE 5: DESASSOCIAR TRANSAÇÕES DE OUTROS USUÁRIOS DAS MINHAS CONTAS
    -- (CRÍTICO! FK RESTRICT impede deletar contas se outros referenciam)
    -- ========================================================================
    
    v_step := 'UNLINK_OTHER_TX_FROM_MY_ACCOUNTS';
    IF array_length(v_acc_ids, 1) > 0 THEN
        -- Desassociar account_id de transações de outros usuários
        UPDATE public.transactions 
        SET account_id = NULL
        WHERE account_id = ANY(v_acc_ids)
          AND user_id != v_user_id;
        
        -- Desassociar destination_account_id de transações de outros usuários
        UPDATE public.transactions 
        SET destination_account_id = NULL
        WHERE destination_account_id = ANY(v_acc_ids)
          AND user_id != v_user_id;
    END IF;

    -- ========================================================================
    -- FASE 6: DELETAR TABELAS COM FK PARA ACCOUNTS
    -- ========================================================================
    
    v_step := 'DEL_BANK_STATEMENTS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'bank_statements') INTO v_table_exists;
    IF v_table_exists AND array_length(v_acc_ids, 1) > 0 THEN
        DELETE FROM public.bank_statements WHERE account_id = ANY(v_acc_ids);
    END IF;

    v_step := 'DEL_STATEMENTS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'statements') INTO v_table_exists;
    IF v_table_exists AND array_length(v_acc_ids, 1) > 0 THEN
        DELETE FROM public.statements WHERE account_id = ANY(v_acc_ids);
    END IF;

    v_step := 'DEL_ACCOUNT_RECONCILIATIONS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'account_reconciliations') INTO v_table_exists;
    IF v_table_exists AND array_length(v_acc_ids, 1) > 0 THEN
        DELETE FROM public.account_reconciliations WHERE account_id = ANY(v_acc_ids);
    END IF;

    v_step := 'DEL_LEDGER_ACCOUNTS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ledger_accounts') INTO v_table_exists;
    IF v_table_exists AND array_length(v_acc_ids, 1) > 0 THEN
        DELETE FROM public.ledger_accounts WHERE account_id = ANY(v_acc_ids);
    END IF;

    -- ========================================================================
    -- FASE 7: DELETAR CONTAS
    -- ========================================================================
    
    v_step := 'DEL_ACCOUNTS';
    DELETE FROM public.accounts WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- ========================================================================
    -- FASE 8: DELETAR TABELAS COM FK PARA TRIPS
    -- ========================================================================
    
    v_step := 'DEL_TRIP_PARTICIPANT_BUDGETS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'trip_participant_budgets') INTO v_table_exists;
    IF v_table_exists AND array_length(v_trip_ids, 1) > 0 THEN
        DELETE FROM public.trip_participant_budgets WHERE trip_id = ANY(v_trip_ids);
    END IF;

    -- ========================================================================
    -- FASE 9: DELETAR DADOS INDEPENDENTES
    -- ========================================================================
    
    v_step := 'DEL_NOTIFICATIONS';
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') INTO v_table_exists;
    IF v_table_exists THEN
        DELETE FROM public.notifications WHERE user_id = v_user_id;
    END IF;

    v_step := 'DEL_SNAPSHOTS';
    DELETE FROM public.snapshots WHERE user_id = v_user_id;

    v_step := 'DEL_CUSTOM_CATEGORIES';
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;

    v_step := 'DEL_ASSETS';
    DELETE FROM public.assets WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_assets = ROW_COUNT;

    v_step := 'DEL_GOALS';
    DELETE FROM public.goals WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_goals = ROW_COUNT;

    v_step := 'DEL_BUDGETS';
    DELETE FROM public.budgets WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_budgets = ROW_COUNT;

    -- ========================================================================
    -- FASE 10: VIAGENS E FAMÍLIA (se unlink_family = true)
    -- ========================================================================
    
    IF p_unlink_family THEN
        v_step := 'UPDATE_OTHER_TRIPS';
        UPDATE public.trips
        SET participants = (
            SELECT COALESCE(jsonb_agg(elem), '[]'::jsonb)
            FROM jsonb_array_elements(participants) elem
            WHERE elem->>'id' != v_user_id::text
        )
        WHERE participants IS NOT NULL
          AND user_id != v_user_id
          AND participants::text LIKE '%' || v_user_id::text || '%';

        v_step := 'DEL_MY_TRIPS';
        DELETE FROM public.trips WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_trips = ROW_COUNT;

        v_step := 'DEL_MY_FAMILY_MEMBERS';
        DELETE FROM public.family_members WHERE user_id = v_user_id;
        GET DIAGNOSTICS v_deleted_members = ROW_COUNT;
        
        v_step := 'DEL_LINKED_FAMILY_MEMBERS';
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
        'detail', SQLSTATE,
        'step', v_step
    );
END;
$fn$;

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

FASE 5 CRÍTICA: Desassocia transações de OUTROS usuários que referenciam
minhas contas (account_id/destination_account_id = NULL) para permitir
a deleção das contas mesmo com FK RESTRICT.';
