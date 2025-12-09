-- NEW FUNCTION NAME TO BYPASS CACHE

DROP FUNCTION IF EXISTS get_shared_requests_v2(UUID);
DROP FUNCTION IF EXISTS get_shared_requests_v2();

CREATE OR REPLACE FUNCTION get_shared_requests_v2()
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
BEGIN
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
        str.invited_user_id = auth.uid() 
        AND str.status = 'PENDING';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_shared_requests_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_requests_v2 TO service_role;
GRANT EXECUTE ON FUNCTION get_shared_requests_v2 TO anon;

NOTIFY pgrst, 'reload config';
