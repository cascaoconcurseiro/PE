-- ==============================================================================
-- MIGRATION: STEP 3 - NEW INFRA IN PARALLEL (RPCs COMPLETION)
-- DATA: 2026-01-24
-- OBJ: Fornecer RPCs para UPDATE e DELETE, permitindo fechamento total da escrita direta.
-- ==============================================================================

BEGIN;

-- 1. RPC: UPDATE TRANSACTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_transaction(
    p_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    -- Extended
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Validação de Existing
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    -- Validação de Domínio (Reutiliza lógica)
    IF (p_trip_id IS NOT NULL) THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(p_domain, 'PERSONAL');
    END IF;

    IF (p_trip_id IS NOT NULL AND v_final_domain != 'TRAVEL') THEN
        RAISE EXCEPTION 'Business Rule Breach: Trip transactions must be TRAVEL domain.';
    END IF;

    IF (p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL) THEN
        RAISE EXCEPTION 'Business Rule Breach: Transfer requires destination account.';
    END IF;

    -- Update Atômico
    UPDATE public.transactions SET
        description = p_description,
        amount = p_amount,
        type = p_type,
        category = p_category,
        date = p_date,
        account_id = p_account_id::text,
        destination_account_id = p_destination_account_id::text,
        trip_id = p_trip_id::text,
        is_shared = p_is_shared,
        domain = v_final_domain,
        is_installment = p_is_installment,
        current_installment = p_current_installment,
        total_installments = p_total_installments,
        series_id = p_series_id::text,
        is_recurring = p_is_recurring,
        frequency = p_frequency,
        is_settled = p_is_settled,
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;

    -- Trigger 'process_transaction_into_ledger' handles ledger update via bridge.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RPC: DELETE TRANSACTION
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.delete_transaction(
    p_id UUID,
    p_scope TEXT DEFAULT 'SINGLE' -- 'SINGLE' or 'SERIES'
)
RETURNS VOID AS $$
DECLARE
    v_tx RECORD;
    v_user_id UUID := auth.uid();
BEGIN
    SELECT * INTO v_tx FROM public.transactions WHERE id = p_id AND user_id = v_user_id;
    
    IF v_tx IS NULL THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    IF (p_scope = 'SERIES' AND v_tx.series_id IS NOT NULL) THEN
        -- Delete entire series
        UPDATE public.transactions 
        SET deleted = TRUE, updated_at = NOW()
        WHERE series_id = v_tx.series_id AND user_id = v_user_id;
    ELSE
        -- Delete single
        UPDATE public.transactions 
        SET deleted = TRUE, updated_at = NOW()
        WHERE id = p_id AND user_id = v_user_id;
    END IF;
    
    -- Ledger updates automatically via Bridge Trigger.
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
