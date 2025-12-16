-- ==============================================================================
-- FINAL RPC TYPE FIX (FULL SIGNATURE)
-- DATA: 2026-01-24
-- OBJ: Corrigir '::text' casts na assinatura COMPLETA de create_transaction.
--      (A versão anterior usava uma assinatura simplificada que não correspondia à chamada do App).
-- ==============================================================================

BEGIN;

-- 1. DROP AMBIGUOUS FUNCTIONS (Optional clarity)
-- DROP FUNCTION IF EXISTS public.create_transaction(...); 
-- (Postgres handles replace mostly, but overloaded signatures might act up. We prefer CREATE OR REPLACE).

-- 2. CREATE TRANSACTION (FULL SIGNATURE + TYPE FIX)
-- ------------------------------------------------------------------------------
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
    -- Extended Ops
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb -- Critical: App uses this
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Determine Domain
    v_final_domain := COALESCE(p_domain, 'personal');

    -- Insert (CASTS REMOVED for UUID columns)
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id 
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id,               -- FIX: No ::text
        p_destination_account_id,   -- FIX: No ::text
        p_trip_id,                  -- FIX: No ::text
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, 
        p_series_id,                -- FIX: No ::text
        p_is_recurring, p_frequency,
        p_shared_with, 
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END
    ) RETURNING id INTO v_new_id;
    
    -- Sync Mirroring
    PERFORM public.sync_shared_transaction(v_new_id);

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. UPDATE TRANSACTION (Already fixed in previous step but good to reinforce)
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
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    v_final_domain := COALESCE(p_domain, 'PERSONAL');

    UPDATE public.transactions SET
        description = p_description,
        amount = p_amount,
        type = p_type,
        category = p_category,
        date = p_date,
        account_id = p_account_id,               -- FIX: No ::text
        destination_account_id = p_destination_account_id, -- FIX: No ::text
        trip_id = p_trip_id,                     -- FIX: No ::text
        is_shared = p_is_shared,
        domain = v_final_domain,
        is_installment = p_is_installment,
        current_installment = p_current_installment,
        total_installments = p_total_installments,
        series_id = p_series_id,                 -- FIX: No ::text
        is_recurring = p_is_recurring,
        frequency = p_frequency,
        is_settled = p_is_settled,
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. SETTLE SPLIT (Ensuring correctness)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_split(
    p_split_id UUID,
    p_payment_account_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_split RECORD;
    v_transaction_id UUID;
    v_description TEXT;
BEGIN
    SELECT s.*, t.description as original_desc, t.user_id as payer_user_id 
    INTO v_split
    FROM public.transaction_splits s
    JOIN public.transactions t ON t.id = s.transaction_id
    WHERE s.id = p_split_id
    FOR UPDATE OF s;

    IF (v_split IS NULL) THEN RAISE EXCEPTION 'Split not found.'; END IF;
    IF (v_split.status != 'OPEN') THEN RAISE EXCEPTION 'Split is already settled or cancelled.'; END IF;
    IF (v_split.debtor_id != auth.uid()) THEN RAISE EXCEPTION 'Access Denied: You can only settle your own debts.'; END IF;

    v_description := 'Pgto Dívida: ' || v_split.original_desc;

    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, domain, user_id
    ) VALUES (
        v_description, v_split.assigned_amount, 'TRANSFERÊNCIA', 'Ajuste', CURRENT_DATE,
        p_payment_account_id, -- FIX: No ::text
        'SHARED', auth.uid()
    ) RETURNING id INTO v_transaction_id;

    UPDATE public.transaction_splits SET status = 'SETTLED' WHERE id = p_split_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
