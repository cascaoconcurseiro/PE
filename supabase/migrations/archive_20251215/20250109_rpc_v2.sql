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
        t.description,
        t.amount,
        t.currency,
        t.date,
        t.category,
        t.observation,
        t.trip_id,
        COALESCE(up.name, 'Usuário Desconhecido'),
        up.email
    FROM 
        public.shared_transaction_requests str
    JOIN 
        public.transactions t ON str.transaction_id = t.id
    LEFT JOIN 
        public.user_profiles up ON str.requester_id = up.id
    WHERE 
        str.invited_user_id = auth.uid() 
        AND str.status = 'PENDING'
    ORDER BY str.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_shared_requests_v2 TO authenticated;
GRANT EXECUTE ON FUNCTION get_shared_requests_v2 TO service_role;
GRANT EXECUTE ON FUNCTION get_shared_requests_v2 TO anon;

NOTIFY pgrst, 'reload config';
