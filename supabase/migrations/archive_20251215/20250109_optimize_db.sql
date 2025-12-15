-- OPTIMIZATION SCRIPT
-- Addresses Linter warnings about RLS performance (auth.uid re-evaluation) 
-- and Multiple Permissive Policies/Unindexed FKs.

-- 1. SETTLEMENT REQUESTS
-- Drop duplicate/old policies identified by linter
DROP POLICY IF EXISTS "Payer can delete pending requests" ON public.settlement_requests;
DROP POLICY IF EXISTS "Users can create settlement requests" ON public.settlement_requests;
DROP POLICY IF EXISTS "Users can delete own pending requests" ON public.settlement_requests;
DROP POLICY IF EXISTS "Participants can update status" ON public.settlement_requests;
DROP POLICY IF EXISTS "Receiver can update status" ON public.settlement_requests;
DROP POLICY IF EXISTS "Users can view their settlements" ON public.settlement_requests;

-- Re-create optimized policies using (select auth.uid()) to cache user ID
CREATE POLICY "Users can create settlement requests" ON public.settlement_requests 
FOR INSERT WITH CHECK (
    (select auth.uid()) = payer_id OR (select auth.uid()) = receiver_id
);

CREATE POLICY "Users can delete own pending requests" ON public.settlement_requests
FOR DELETE USING (
    ((select auth.uid()) = payer_id AND type = 'PAYMENT' AND status = 'PENDING') OR 
    ((select auth.uid()) = receiver_id AND type = 'CHARGE' AND status = 'PENDING')
);

CREATE POLICY "Participants can update status" ON public.settlement_requests
FOR UPDATE USING (
    (select auth.uid()) = receiver_id OR (select auth.uid()) = payer_id
);

CREATE POLICY "Users can view their settlements" ON public.settlement_requests
FOR SELECT USING (
    (select auth.uid()) = payer_id OR (select auth.uid()) = receiver_id
);


-- 2. SHARED TRANSACTION REQUESTS
-- Consolidate duplicate policies and optimize
DROP POLICY IF EXISTS "Requesters can manage their own requests" ON public.shared_transaction_requests;
DROP POLICY IF EXISTS "Requester can insert" ON public.shared_transaction_requests;
DROP POLICY IF EXISTS "Invitees can view requests sent to them" ON public.shared_transaction_requests;
DROP POLICY IF EXISTS "Invitees can update status of requests sent to them" ON public.shared_transaction_requests;
DROP POLICY IF EXISTS "Users can view their shared requests" ON public.shared_transaction_requests;
DROP POLICY IF EXISTS "Users can update their requests" ON public.shared_transaction_requests;

CREATE POLICY "Users can view relevant shared requests" ON public.shared_transaction_requests
FOR SELECT USING (
    (select auth.uid()) = requester_id OR (select auth.uid()) = invited_user_id
);

CREATE POLICY "Requesters can insert requests" ON public.shared_transaction_requests
FOR INSERT WITH CHECK (
    (select auth.uid()) = requester_id
);

CREATE POLICY "Participants can update requests" ON public.shared_transaction_requests
FOR UPDATE USING (
    (select auth.uid()) = requester_id OR (select auth.uid()) = invited_user_id
);

CREATE POLICY "Requesters can delete requests" ON public.shared_transaction_requests
FOR DELETE USING (
    (select auth.uid()) = requester_id
);


-- 3. ADD MISSING INDEXES (Performance)
CREATE INDEX IF NOT EXISTS idx_settlement_requests_payer_id ON public.settlement_requests(payer_id);
CREATE INDEX IF NOT EXISTS idx_settlement_requests_receiver_id ON public.settlement_requests(receiver_id);
CREATE INDEX IF NOT EXISTS idx_shared_requests_requester_id ON public.shared_transaction_requests(requester_id);
CREATE INDEX IF NOT EXISTS idx_shared_requests_invited_user_id ON public.shared_transaction_requests(invited_user_id);

-- Other tables flagged by linter
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_budgets_user_id ON public.budgets(user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user_id ON public.goals(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_linked_tx_id ON public.transactions(linked_transaction_id);
