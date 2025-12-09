-- 1. Create shared_transaction_requests table
CREATE TABLE IF NOT EXISTS public.shared_transaction_requests (
  id uuid primary key default uuid_generate_v4(),
  transaction_id uuid references public.transactions(id) on delete cascade not null,
  requester_id uuid references auth.users(id) not null,
  invited_email text not null,
  invited_user_id uuid references auth.users(id), -- Nullable initially, populated if user found
  status text not null default 'PENDING', -- PENDING, ACCEPTED, REJECTED
  created_at timestamp with time zone default timezone('utc'::text, now()),
  responded_at timestamp with time zone,
  
  -- Allow re-sending (multiple requests for same tx/email), but maybe we want to quickly find the LATEST
  -- We don't enforce unique constraint here to allow history of rejections
  constraint valid_status check (status in ('PENDING', 'ACCEPTED', 'REJECTED'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_shared_requests_invitee_status ON public.shared_transaction_requests(invited_user_id, status);
CREATE INDEX IF NOT EXISTS idx_shared_requests_tx ON public.shared_transaction_requests(transaction_id);
CREATE INDEX IF NOT EXISTS idx_shared_requests_email ON public.shared_transaction_requests(invited_email);
CREATE INDEX IF NOT EXISTS idx_shared_requests_requester ON public.shared_transaction_requests(requester_id);

-- Enable RLS
ALTER TABLE public.shared_transaction_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for shared_transaction_requests

-- Requester can CRUD their own requests
CREATE POLICY "Requesters can manage their own requests"
ON public.shared_transaction_requests
FOR ALL
USING (auth.uid() = requester_id);

-- Invitee can VIEW requests sent to them (by user_id)
CREATE POLICY "Invitees can view requests sent to them"
ON public.shared_transaction_requests
FOR SELECT
USING (auth.uid() = invited_user_id);

-- Invitee can UPDATE status of requests sent to them
CREATE POLICY "Invitees can update status of requests sent to them"
ON public.shared_transaction_requests
FOR UPDATE
USING (auth.uid() = invited_user_id);

-- 2. Modify Transactions RLS to allow Shared Access
-- We need to allow a user to SELECT a transaction if they have an ACCEPTED request for it

CREATE POLICY "Users can view transactions shared with them"
ON public.transactions
FOR SELECT
USING (
  id IN (
    SELECT transaction_id 
    FROM public.shared_transaction_requests 
    WHERE invited_user_id = auth.uid() 
    AND status = 'ACCEPTED'
  )
);

-- 3. RPC Function to check if user exists by email (Securely)
-- This allows the frontend to check if an email is registered without exposing the user table
CREATE OR REPLACE FUNCTION public.check_user_by_email(email_to_check text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with privileges of creator (postgres) to access auth.users
AS $$
DECLARE
  found_user_id uuid;
BEGIN
  -- Check in auth.users or public.user_profiles
  -- Using user_profiles is safer standard in this schema
  SELECT id INTO found_user_id
  FROM public.user_profiles
  WHERE email = email_to_check
  LIMIT 1;
  
  RETURN found_user_id;
END;
$$;
