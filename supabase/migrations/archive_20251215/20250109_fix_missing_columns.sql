-- FIX MISSING COLUMNS IN shared_transaction_requests
-- Objective: Ensure columns requested by frontend actually exist.

DO $$
BEGIN
    -- 1. Check/Add invited_email
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transaction_requests' 
        AND column_name = 'invited_email'
    ) THEN
        ALTER TABLE public.shared_transaction_requests
        ADD COLUMN invited_email TEXT;
    END IF;

    -- 2. Check/Add assigned_amount
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transaction_requests' 
        AND column_name = 'assigned_amount'
    ) THEN
        ALTER TABLE public.shared_transaction_requests
        ADD COLUMN assigned_amount NUMERIC;
    END IF;

    -- 3. Check/Add responded_at
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'shared_transaction_requests' 
        AND column_name = 'responded_at'
    ) THEN
        ALTER TABLE public.shared_transaction_requests
        ADD COLUMN responded_at TIMESTAMP WITH TIME ZONE;
    END IF;

END $$;
