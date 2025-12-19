-- ==============================================================================
-- REMOVER VERSÃO DUPLICADA DE create_transaction COM UUID
-- ==============================================================================

-- A versão problemática tem p_user_id como primeiro parâmetro e p_series_id/p_payer_id como UUID
DROP FUNCTION IF EXISTS public.create_transaction(
    uuid,  -- p_user_id
    text,  -- p_description
    numeric,  -- p_amount
    text,  -- p_type
    text,  -- p_category
    date,  -- p_date
    uuid,  -- p_account_id
    uuid,  -- p_destination_account_id
    uuid,  -- p_trip_id
    boolean,  -- p_is_shared
    text,  -- p_domain
    boolean,  -- p_is_installment
    integer,  -- p_current_installment
    integer,  -- p_total_installments
    uuid,  -- p_series_id (PROBLEMA!)
    boolean,  -- p_is_recurring
    text,  -- p_frequency
    jsonb,  -- p_shared_with
    uuid,  -- p_payer_id (PROBLEMA!)
    text   -- p_currency
);

-- Verificar se foi removida
SELECT proname, pg_get_function_arguments(oid) 
FROM pg_proc 
WHERE proname = 'create_transaction' AND pronamespace = 'public'::regnamespace;
