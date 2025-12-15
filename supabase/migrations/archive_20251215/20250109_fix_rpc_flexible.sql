-- FLEXIBLE RPC FIX
-- Handles both parameterized and parameter-less calls to avoid 400/404 errors during transition

-- Drop all variants to be sure
DROP FUNCTION IF EXISTS get_pending_shared_requests(UUID);
DROP FUNCTION IF EXISTS get_pending_shared_requests();

-- Create flexible version with DEFAULT NULL
CREATE OR REPLACE FUNCTION get_pending_shared_requests(p_user_id UUID DEFAULT NULL)
RETURNS TABLE (
    id UUID,
    transaction_id UUID,
    requester_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    assigned_amount NUMERIC,
    tx_description TEXT,
    tx_amount NUMERIC,
    tx_currency TEXT,
    tx_date DATE,
    tx_category TEXT,
    tx_observation TEXT,
    tx_trip_id UUID,
    requester_name TEXT,
    requester_email TEXT
) AS $$
DECLARE
    target_user_id UUID;
BEGIN
    -- Use passed ID or fallback to authenticated user
    target_user_id := COALESCE(p_user_id, auth.uid());

    RETURN QUERY
    SELECT 
        str.id,
        str.transaction_id,
        str.requester_id,
        str.status,
        str.created_at,
        str.assigned_amount,
        t.description AS tx_description,
        t.amount AS tx_amount,
        t.currency AS tx_currency,
        t.date AS tx_date,
        t.category AS tx_category,
        t.observation AS tx_observation,
        t.trip_id AS tx_trip_id,
        COALESCE(up.name, 'Usuário Desconhecido') AS requester_name,
        up.email AS requester_email
    FROM 
        public.shared_transaction_requests str
    JOIN 
        public.transactions t ON str.transaction_id = t.id
    LEFT JOIN 
        public.user_profiles up ON str.requester_id = up.id
    WHERE 
        str.invited_user_id = target_user_id 
        AND str.status = 'PENDING';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Explicit Grants
GRANT EXECUTE ON FUNCTION get_pending_shared_requests(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_shared_requests(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION get_pending_shared_requests(UUID) TO anon;

-- NOTIFY PostgREST to reload schema (Works if executed via Dashboard SQL Editor)
NOTIFY pgrst, 'reload config';
