-- AUTO-SHARE TRIGGER & LOGIC
-- Objective: Automatically create the 'mirror' expense transaction when a shared request becomes ACCEPTED.
-- This supports both Manual Acceptance (Update Status) and Auto-Share (Insert as ACCEPTED).

-- 1. Create the Trigger Function
CREATE OR REPLACE FUNCTION handle_shared_transaction_mirror()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_original_tx RECORD;
    v_account_id UUID;
    v_mirror_exists BOOLEAN;
BEGIN
    -- Only proceed if status is ACCEPTED
    IF NEW.status = 'ACCEPTED' THEN
        
        -- Check if mirror already exists (idempotency)
        -- We look for a transaction in the invited_user's account with the SYNC tag
        SELECT EXISTS (
            SELECT 1 FROM transactions 
            WHERE user_id = NEW.invited_user_id 
            AND observation LIKE '%[SYNC:' || NEW.transaction_id || ']%'
        ) INTO v_mirror_exists;

        IF v_mirror_exists THEN
            RETURN NEW; -- Already handled (maybe by the old RPC or duplicate firing)
        END IF;

        -- Get Original Transaction
        SELECT * INTO v_original_tx FROM transactions WHERE id = NEW.transaction_id;
        
        IF v_original_tx IS NULL THEN
            -- Original transaction deleted? Should probably cleanup request, but for now just exit.
            RETURN NEW;
        END IF;

        -- Find a Default Account for the Invitee
        -- Priority: 1. Account passed in input (not available in trigger)
        --           2. Most recently used account
        --           3. Any account
        SELECT id INTO v_account_id 
        FROM accounts 
        WHERE user_id = NEW.invited_user_id 
        LIMIT 1;

        IF v_account_id IS NULL THEN
            -- User has no accounts? Cannot mirror.
            -- Maybe log error or just fail silently? 
            -- Failsafe: Do nothing. Expense won't appear, but won't crash DB.
            RETURN NEW;
        END IF;

        -- Create Mirror Transaction
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
            v_original_tx.description,
            COALESCE(NEW.assigned_amount, v_original_tx.amount), -- Use specific amount if assigned
            'EXPENSE', -- Mirror is always an expense (User B owes/paid share)
            v_original_tx.date,
            v_original_tx.category,
            v_account_id,
            NEW.invited_user_id,
            true, -- Mark as shared
            v_original_tx.trip_id,
            TRIM('[SYNC:' || NEW.transaction_id || '] ' || COALESCE(v_original_tx.observation, '')),
            v_original_tx.currency,
            v_original_tx.exchange_rate,
            NOW(),
            NOW()
        );
        
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. Create the Trigger
DROP TRIGGER IF EXISTS on_shared_request_accepted ON shared_transaction_requests;

CREATE TRIGGER on_shared_request_accepted
AFTER INSERT OR UPDATE OF status
ON shared_transaction_requests
FOR EACH ROW
WHEN (NEW.status = 'ACCEPTED')
EXECUTE FUNCTION handle_shared_transaction_mirror();

-- 3. Cleanup the old RPC to avoid Double Insert
-- We redefine respond_to_shared_request to ONLY update status.
-- The Trigger will handle the insertion.
CREATE OR REPLACE FUNCTION respond_to_shared_request(
    p_request_id UUID,
    p_status TEXT, -- 'ACCEPTED' or 'REJECTED'
    p_account_id UUID DEFAULT NULL -- Deprecated used by trigger now, but kept for signature
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
    v_req RECORD;
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

    -- Update Status - THIS WILL FIRE THE TRIGGER
    UPDATE shared_transaction_requests 
    SET status = p_status, responded_at = NOW() 
    WHERE id = p_request_id;

    RETURN jsonb_build_object('success', true);
END;
$$;
