-- Allow users to view transactions they are invited to (PENDING or ACCEPTED)
-- Drop existing policy if it conflicts (or create new if none specific to this exists)
-- Assuming "transactions_select_policy" or similar exists.

DROP POLICY IF EXISTS "Users can view their own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view shared transactions" ON public.transactions;

-- Re-create consolidated policy
CREATE POLICY "Users can view their own or shared transactions"
ON public.transactions
FOR SELECT
USING (
  auth.uid() = user_id -- Owner
  OR
  exists (
    select 1 from public.shared_transaction_requests
    where transaction_id = public.transactions.id
    and invited_user_id = auth.uid()
    and status IN ('PENDING', 'ACCEPTED')
  )
);
