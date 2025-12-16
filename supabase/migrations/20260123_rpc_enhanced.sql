-- ==============================================================================
-- MIGRATION: RPC ENHANCEMENT (FIX)
-- DATA: 2026-01-23
-- DESCRIÇÃO: Atualiza create_transaction para suportar campos de parcelamento e recorrência.
-- ==============================================================================

BEGIN;

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

    -- 3. Inserção
    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, destination_account_id, trip_id, 
        is_shared, domain, user_id,
        -- Extended Fields
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id::text, p_destination_account_id::text, p_trip_id::text,
        p_is_shared, v_final_domain, auth.uid(),
        p_is_installment, p_current_installment, p_total_installments, p_series_id::text,
        p_is_recurring, p_frequency
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
