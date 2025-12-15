-- ============================================================================
-- FIX SHARED VISIBILITY & NOTIFICATIONS
-- ============================================================================

-- 0. Ensure Table and Safe Policies Exist
CREATE TABLE IF NOT EXISTS public.shared_transaction_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID NOT NULL REFERENCES public.transactions(id),
    requester_id UUID NOT NULL REFERENCES auth.users(id),
    invited_user_id UUID NOT NULL REFERENCES auth.users(id),
    invited_email TEXT,
    status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED')),
    assigned_amount NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

ALTER TABLE public.shared_transaction_requests ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_transaction_requests' AND policyname = 'Users can view their shared requests') THEN
        CREATE POLICY "Users can view their shared requests" ON public.shared_transaction_requests FOR SELECT USING (auth.uid() = requester_id OR auth.uid() = invited_user_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_transaction_requests' AND policyname = 'Requester can insert') THEN
        CREATE POLICY "Requester can insert" ON public.shared_transaction_requests FOR INSERT WITH CHECK (auth.uid() = requester_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'shared_transaction_requests' AND policyname = 'Users can update their requests') THEN
        CREATE POLICY "Users can update their requests" ON public.shared_transaction_requests FOR UPDATE USING (auth.uid() = invited_user_id OR auth.uid() = requester_id);
    END IF;
END $$;

-- 1. RPC to fetch pending shared requests with transaction details (Bypassing RLS)
-- This allows the Invited User to see the transaction details (description, amount) 
-- even if they don't have direct RLS access to the Sharer's transaction row yet.
CREATE OR REPLACE FUNCTION get_pending_shared_requests(p_user_id UUID)
RETURNS TABLE (
    id UUID,
    transaction_id UUID,
    requester_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    assigned_amount NUMERIC,
    -- Transaction Details
    tx_description TEXT,
    tx_amount NUMERIC,
    tx_currency TEXT,
    tx_date DATE,
    tx_category TEXT,
    tx_observation TEXT,
    tx_trip_id UUID,
    -- Requester Details
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
        up.name AS requester_name,
        up.email AS requester_email
    FROM 
        public.shared_transaction_requests str
    JOIN 
        public.transactions t ON str.transaction_id = t.id
    LEFT JOIN 
        public.user_profiles up ON str.requester_id = up.id
    WHERE 
        str.invited_user_id = p_user_id 
        AND str.status = 'PENDING';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Grant access
GRANT EXECUTE ON FUNCTION get_pending_shared_requests TO authenticated;
GRANT EXECUTE ON FUNCTION get_pending_shared_requests TO service_role;
