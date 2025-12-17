-- ==============================================================================
-- FIX: FINAL RPC SIGNATURE (SCHEMA CACHE FIX)
-- DATA: 2026-01-26
-- OBJ: Corrigir assinatura de create_transaction para corresponder EXATAMENTE
--      aos parâmetros enviados pelo frontend. O erro "Could not find function"
--      ocorre quando a assinatura no banco não corresponde aos parâmetros passados.
-- ==============================================================================

BEGIN;

-- 1. DROP EXISTING FUNCTION(S) TO AVOID OVERLOAD ISSUES
-- ------------------------------------------------------------------------------
-- PostgreSQL permite sobrecarga de funções (mesmo nome, parâmetros diferentes).
-- Isso pode causar confusão. Vamos remover todas as versões existentes.
DROP FUNCTION IF EXISTS public.create_transaction(TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_transaction(TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.create_transaction(TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT);

-- 2. RECREATE WITH DEFINITIVE SIGNATURE
-- ------------------------------------------------------------------------------
-- Esta é a assinatura EXATA esperada pelo frontend (supabaseService.ts linha 218-237):
-- p_description, p_amount, p_type, p_category, p_date, p_account_id,
-- p_destination_account_id, p_trip_id, p_is_shared, p_domain,
-- p_is_installment, p_current_installment, p_total_installments, p_series_id,
-- p_is_recurring, p_frequency, p_shared_with

CREATE OR REPLACE FUNCTION public.create_transaction(
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
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Domain Resolution: TRAVEL if trip, else provided or PERSONAL
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- INSERT with all columns
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id,
        created_at, updated_at
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with,
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END,
        NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    -- Call Sync for Shared Transactions (Robust - Fails silently in production)
    BEGIN
        PERFORM public.sync_shared_transaction(v_new_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[create_transaction] Sync failed for ID %: %', v_new_id, SQLERRM;
    END;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. VERIFY update_transaction HAS MATCHING SIGNATURE
-- ------------------------------------------------------------------------------
-- O mesmo problema pode ocorrer em update_transaction. Garantir assinatura completa.

DROP FUNCTION IF EXISTS public.update_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.update_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT);

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
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT FALSE,
    p_shared_with JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Verify ownership
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    -- Domain Resolution
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    UPDATE public.transactions SET
        description = p_description,
        amount = p_amount,
        type = p_type,
        category = p_category,
        date = p_date,
        account_id = p_account_id,
        destination_account_id = p_destination_account_id,
        trip_id = p_trip_id,
        is_shared = p_is_shared,
        domain = v_final_domain,
        is_installment = p_is_installment,
        current_installment = p_current_installment,
        total_installments = p_total_installments,
        series_id = p_series_id,
        is_recurring = p_is_recurring,
        frequency = p_frequency,
        is_settled = p_is_settled,
        shared_with = COALESCE(p_shared_with, shared_with), -- Keep existing if null
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
