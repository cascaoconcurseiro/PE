-- FIX RLS POLICIES FOR SHARED TRANSACTION REQUESTS
-- Objective: Ensure users can create requests and view/respond to requests sent to them.

-- 1. Enable RLS
ALTER TABLE shared_transaction_requests ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view their own requests" ON shared_transaction_requests;
DROP POLICY IF EXISTS "Users can create requests" ON shared_transaction_requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON shared_transaction_requests;
-- Also drop any potentially old named policies
DROP POLICY IF EXISTS "Enable read access for all users" ON shared_transaction_requests;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON shared_transaction_requests;

-- 3. Create Precise Policies

-- VIEW: Requester OR Invitee can see the request
CREATE POLICY "Users can view relevant requests"
ON shared_transaction_requests
FOR SELECT
USING (
    auth.uid() = requester_id 
    OR 
    auth.uid() = invited_user_id
);

-- INSERT: Authenticated users can create requests (requester_id must match auth.uid())
CREATE POLICY "Users can create requests"
ON shared_transaction_requests
FOR INSERT
WITH CHECK (
    auth.uid() = requester_id
);

-- UPDATE: Invitee can update status (Accept/Reject), Requester can update? (Maybe to cancel, but logic uses resend)
-- For now, allow both to update if involved. 
-- Important: The RPC 'respond_to_shared_request' usually bypasses RLS if it's SECURITY DEFINER, 
-- but if we do direct updates from frontend (not currently used for responding), we need this.
-- However, 'resend_shared_request' is also an RPC.
-- So strict RLS on UPDATE might not be needed if we ONLY use RPCs.
-- But let's allow it for safety if we change logic later.
CREATE POLICY "Users can update relevant requests"
ON shared_transaction_requests
FOR UPDATE
USING (
    auth.uid() = requester_id 
    OR 
    auth.uid() = invited_user_id
);
