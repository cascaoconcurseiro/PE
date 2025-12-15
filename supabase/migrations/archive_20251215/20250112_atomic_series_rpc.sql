-- RPC: ATOMIC SERIES REGENERATION
-- Purpose: Delete old series and insert new series in a SINGLE atomic transaction.
-- This prevents data loss if the network fails between delete and insert.

CREATE OR REPLACE FUNCTION recreate_transaction_series(
    p_old_series_id UUID,
    p_new_transactions JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Get current user ID safely
    v_user_id := auth.uid();
    
    -- 1. DELETE OLD SERIES
    -- Ensure we only delete what belongs to the user
    DELETE FROM public.transactions 
    WHERE series_id = p_old_series_id 
    AND user_id = v_user_id;

    -- 2. INSERT NEW SERIES
    -- We assume the JSONB contains an array of transaction objects
    -- We map the JSON fields to the table columns
    INSERT INTO public.transactions (
        id,
        user_id,
        description,
        amount,
        type,
        category,
        date,
        account_id,
        destination_account_id,
        is_installment,
        current_installment,
        total_installments,
        series_id,
        created_at,
        updated_at,
        currency
    )
    SELECT
        (x->>'id')::UUID,
        v_user_id,
        x->>'description',
        (x->>'amount')::NUMERIC,
        x->>'type',
        x->>'category',
        (x->>'date')::DATE,
        (x->>'account_id')::UUID,
        (x->>'destination_account_id')::UUID,
        (x->>'is_installment')::BOOLEAN,
        (x->>'current_installment')::INTEGER,
        (x->>'total_installments')::INTEGER,
        (x->>'series_id')::UUID,
        COALESCE((x->>'created_at')::TIMESTAMPTZ, now()),
        COALESCE((x->>'updated_at')::TIMESTAMPTZ, now()),
        COALESCE(x->>'currency', 'BRL')
    FROM jsonb_array_elements(p_new_transactions) AS x;

END;
$$;
