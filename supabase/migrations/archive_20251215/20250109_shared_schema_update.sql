-- EXPANDED SHARED EXPENSES LOGIC
-- Supports: Re-sending requests, History of rejections, Atomic Acceptance with Transaction Creation

-- 1. Update Constraints on shared_transaction_requests
-- We want to allow multiple rows for the same transaction/user pair (History), 
-- but ONLY ONE PENDING request at a time.

-- Drop old strict unique constraint if it exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM pg_indexes WHERE indexname = 'shared_transaction_requests_transaction_id_invited_user_id_key') THEN
        DROP INDEX shared_transaction_requests_transaction_id_invited_user_id_key;
    END IF;
    -- Also check for constraint name
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shared_transaction_requests_transaction_id_invited_user_id_key') THEN
        ALTER TABLE shared_transaction_requests DROP CONSTRAINT shared_transaction_requests_transaction_id_invited_user_id_key;
    END IF;
END $$;

-- Add Partial Unique Index: Only one PENDING request per pair
CREATE UNIQUE INDEX IF NOT EXISTS unique_pending_request 
ON public.shared_transaction_requests (transaction_id, invited_user_id) 
WHERE status = 'PENDING';

-- 2. RPC: Resend Request
CREATE OR REPLACE FUNCTION resend_shared_request(
    p_transaction_id UUID,
    p_invited_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_requester_id UUID;
    v_new_id UUID;
BEGIN
    v_requester_id := auth.uid();

    -- Check if there is already a PENDING request
    IF EXISTS (
        SELECT 1 FROM shared_transaction_requests 
        WHERE transaction_id = p_transaction_id 
        AND invited_user_id = p_invited_user_id 
        AND status = 'PENDING'
    ) THEN
        RETURN jsonb_build_object('success', false, 'message', 'Já existe uma solicitação pendente para este usuário.');
    END IF;

    -- Insert new request
    INSERT INTO shared_transaction_requests (
        transaction_id, 
        requester_id, 
        invited_user_id, 
        status,
        created_at
    ) VALUES (
        p_transaction_id,
        v_requester_id,
        p_invited_user_id,
        'PENDING',
        NOW()
    ) RETURNING id INTO v_new_id;

    RETURN jsonb_build_object('success', true, 'id', v_new_id);
END;
$$;

-- 3. RPC: Respond to Request (Atomic Accept/Reject)
CREATE OR REPLACE FUNCTION respond_to_shared_request(
    p_request_id UUID,
    p_status TEXT, -- 'ACCEPTED' or 'REJECTED'
    p_account_id UUID DEFAULT NULL -- Required if ACCEPTED
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
    v_tx RECORD;
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();

    -- Get Request
    SELECT * INTO v_req FROM shared_transaction_requests WHERE id = p_request_id;

    IF v_req IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Solicitação não encontrada.');
    END IF;

    IF v_req.invited_user_id != v_user_id THEN
         RETURN jsonb_build_object('success', false, 'message', 'Não autorizado.');
    END IF;

    IF v_req.status != 'PENDING' THEN
         RETURN jsonb_build_object('success', false, 'message', 'Solicitação já respondida.');
    END IF;

    -- Update Status
    UPDATE shared_transaction_requests 
    SET status = p_status, responded_at = NOW() 
    WHERE id = p_request_id;

    -- IF ACCEPTED, Create Transaction Clone
    IF p_status = 'ACCEPTED' THEN
        IF p_account_id IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 'Conta é obrigatória para aceitar.');
        END IF;

        -- Get Original Transaction
        SELECT * INTO v_tx FROM transactions WHERE id = v_req.transaction_id;

        IF v_tx IS NULL THEN
             RETURN jsonb_build_object('success', false, 'message', 'Transação original não encontrada.');
        END IF;

        -- Insert Copy
        INSERT INTO transactions (
            description,
            amount,
            type,
            date,
            category,
            account_id,
            user_id,
            is_shared,
            trip_id,
            observation,
            currency,
            exchange_rate,
            created_at,
            updated_at
        ) VALUES (
            v_tx.description,
            COALESCE(v_req.assigned_amount, v_tx.amount), -- Use assigned amount if specific, else full amount
            'EXPENSE', -- Always expense for payer? Assuming shared cost.
            v_tx.date,
            v_tx.category,
            p_account_id,
            v_user_id,
            true, -- Marked as shared
            v_tx.trip_id,
            TRIM('[SYNC:' || v_req.transaction_id || '] ' || COALESCE(v_tx.observation, '')),
            v_tx.currency,
            v_tx.exchange_rate,
            NOW(),
            NOW()
        );
    END IF;

    RETURN jsonb_build_object('success', true);
END;
$$;

-- Grants
GRANT EXECUTE ON FUNCTION resend_shared_request TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_shared_request TO authenticated;
