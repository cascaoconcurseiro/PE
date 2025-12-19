-- ============================================================================
-- FACTORY RESET V3 - BASEADO NO NUCLEAR QUE FUNCIONOU
-- ============================================================================
-- Execute este script COMPLETO no Supabase SQL Editor
-- ============================================================================

DROP FUNCTION IF EXISTS public.fn_smart_factory_reset(boolean);
DROP FUNCTION IF EXISTS public.fn_smart_factory_reset(uuid, boolean);

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
BEGIN
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RETURN '{"success": false, "error": "Usuário não identificado"}'::jsonb;
    END IF;

    -- ========================================================================
    -- PASSO 1: Alterar FKs para CASCADE/SET NULL (igual ao nuclear)
    -- ========================================================================
    
    ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
    ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
        FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account 
        FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_dest_account 
        FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

    -- ========================================================================
    -- PASSO 2: Limpar self-references (só do usuário)
    -- ========================================================================
    
    UPDATE public.transactions SET source_transaction_id = NULL 
    WHERE source_transaction_id IN (SELECT id FROM public.transactions WHERE user_id = v_user_id);
    
    UPDATE public.transactions SET settled_by_tx_id = NULL 
    WHERE settled_by_tx_id IN (SELECT id FROM public.transactions WHERE user_id = v_user_id);

    -- ========================================================================
    -- PASSO 3: Deletar tabelas dependentes (só do usuário)
    -- ========================================================================
    
    DELETE FROM public.transaction_splits 
    WHERE transaction_id IN (SELECT id FROM public.transactions WHERE user_id = v_user_id);

    DELETE FROM public.ledger_entries 
    WHERE transaction_id IN (SELECT id FROM public.transactions WHERE user_id = v_user_id);

    DELETE FROM public.bank_statements 
    WHERE account_id IN (SELECT id FROM public.accounts WHERE user_id = v_user_id);

    -- ========================================================================
    -- PASSO 4: Deletar transações (CASCADE vai deletar audit)
    -- ========================================================================
    
    -- Mirrors primeiro
    DELETE FROM public.transactions 
    WHERE source_transaction_id IN (SELECT id FROM public.transactions WHERE user_id = v_user_id);
    
    -- Minhas transações
    DELETE FROM public.transactions WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_transactions = ROW_COUNT;

    -- ========================================================================
    -- PASSO 5: Deletar contas
    -- ========================================================================
    
    DELETE FROM public.accounts WHERE user_id = v_user_id;
    GET DIAGNOSTICS v_deleted_accounts = ROW_COUNT;

    -- ========================================================================
    -- PASSO 6: Deletar outros dados
    -- ========================================================================
    
    DELETE FROM public.assets WHERE user_id = v_user_id;
    DELETE FROM public.goals WHERE user_id = v_user_id;
    DELETE FROM public.budgets WHERE user_id = v_user_id;
    DELETE FROM public.snapshots WHERE user_id = v_user_id;
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;
    DELETE FROM public.user_notifications WHERE user_id = v_user_id;

    -- ========================================================================
    -- PASSO 7: Viagens e família (se solicitado)
    -- ========================================================================
    
    IF p_unlink_family THEN
        DELETE FROM public.trip_participant_budgets 
        WHERE trip_id IN (SELECT id FROM public.trips WHERE user_id = v_user_id);
        
        DELETE FROM public.trips WHERE user_id = v_user_id;
        DELETE FROM public.family_members WHERE user_id = v_user_id;
        DELETE FROM public.family_members WHERE linked_user_id = v_user_id;
    END IF;

    -- ========================================================================
    -- PASSO 8: Restaurar FKs originais
    -- ========================================================================
    
    ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
    ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
        FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account 
        FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

    ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
    ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_dest_account 
        FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

    -- ========================================================================
    -- RETORNO
    -- ========================================================================
    
    RETURN jsonb_build_object(
        'success', true,
        'deleted', jsonb_build_object(
            'transactions', v_deleted_transactions,
            'accounts', v_deleted_accounts
        )
    );

EXCEPTION WHEN OTHERS THEN
    -- Restaurar FKs em caso de erro
    BEGIN
        ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
        ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
            FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

        ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
        ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account 
            FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

        ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
        ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_dest_account 
            FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;
    EXCEPTION WHEN OTHERS THEN NULL;
    END;

    RETURN jsonb_build_object(
        'success', false,
        'error', SQLERRM,
        'detail', SQLSTATE
    );
END;
$fn$;

GRANT EXECUTE ON FUNCTION public.fn_smart_factory_reset(uuid, boolean) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fn_smart_factory_reset(uuid, boolean) TO service_role;
