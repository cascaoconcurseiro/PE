-- ==============================================================================
-- HOTFIX: RPC UUID TYPES
-- DATA: 2026-01-24
-- OBJ: Corrigir erro "expression is of type text" ao inserir em colunas UUID.
--      (account_id, trip_id, destination_account_id, series_id)
-- ==============================================================================

BEGIN;

-- 1. CORREÇÃO: CREATE TRANSACTION
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
    -- New Fields for Installments/Recurrence
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
BEGIN
    -- 1. Validação de Domínio
    IF (p_trip_id IS NOT NULL) THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(p_domain, 'PERSONAL');
    END IF;

    -- Validação Cruzada de Trip
    IF (p_trip_id IS NOT NULL AND v_final_domain != 'TRAVEL') THEN
        RAISE EXCEPTION 'Business Rule Breach: Trip transactions must be TRAVEL domain.';
    END IF;

    -- 2. Validação de Tipo
    IF (p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL) THEN
        RAISE EXCEPTION 'Business Rule Breach: Transfer requires destination account.';
    END IF;

    -- 3. Inserção (Casts removidos para colunas UUID)
    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, destination_account_id, trip_id, 
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, auth.uid(),
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. CORREÇÃO: UPDATE TRANSACTION
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

    -- Update Atômico (Casts removidos)
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
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;
