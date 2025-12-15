-- ARCHITECT REFACTOR: SHARED EXPENSES V2 (AUTO-SHARE)
-- Objective: Enforce automatic sharing for linked family members at the Database level.

-- 1. CLEANUP & PREPERATION
-- Drop old triggers/functions to ensure clean slate for this logic
DROP TRIGGER IF EXISTS on_shared_request_accepted ON shared_transaction_requests;
DROP TRIGGER IF EXISTS force_auto_accept_linked_members ON shared_transaction_requests;
DROP FUNCTION IF EXISTS handle_shared_transaction_mirror();
DROP FUNCTION IF EXISTS enforce_auto_accept_for_linked();

-- 2. TRIGGER 1: FORCE ACCEPTANCE (The "Business Rule")
-- Before a request is saved, check if we should auto-accept it based on Family Link.

CREATE OR REPLACE FUNCTION enforce_auto_accept_for_linked()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_is_linked BOOLEAN;
BEGIN
    -- Check if the invited user is linked in the requester's family_members
    -- We match based on email or direct ID if available
    -- Note: family_members table has 'user_id' (owner) and 'linked_user_id' (the member's real account)
    
    SELECT EXISTS (
        SELECT 1 FROM family_members fm
        LEFT JOIN user_profiles up ON up.email = fm.email
        WHERE fm.user_id = NEW.requester_id
        AND (
            fm.linked_user_id = NEW.invited_user_id -- Best match
            OR 
            up.id = NEW.invited_user_id -- Match by resolved user ID from email
        )
    ) INTO v_is_linked;

    -- If linked, FORCE status to ACCEPTED
    IF v_is_linked THEN
        NEW.status := 'ACCEPTED';
        NEW.responded_at := NOW(); -- Mark as responded instantly
    END IF;

    RETURN NEW;
END;
$$;

CREATE TRIGGER force_auto_accept_linked_members
BEFORE INSERT ON shared_transaction_requests
FOR EACH ROW
EXECUTE FUNCTION enforce_auto_accept_for_linked();


-- 3. TRIGGER 2: EXECUTE MIRROR (The "Action")
-- If a request is ACCEPTED (whether by force or update), create the mirror transaction.

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
        
        -- Idempotency Check: Don't create if already exists
        SELECT EXISTS (
            SELECT 1 FROM transactions 
            WHERE user_id = NEW.invited_user_id 
            AND observation LIKE '%[SYNC:' || NEW.transaction_id || ']%'
        ) INTO v_mirror_exists;

        IF v_mirror_exists THEN
            RETURN NEW;
        END IF;

        -- Get Original Transaction
        SELECT * INTO v_original_tx FROM transactions WHERE id = NEW.transaction_id;
        
        IF v_original_tx IS NULL THEN
            RETURN NEW;
        END IF;

        -- Find Account for Invitee
        -- Logic: Try to find an account with same currency, or just the first one found.
        SELECT id INTO v_account_id 
        FROM accounts 
        WHERE user_id = NEW.invited_user_id 
        ORDER BY updated_at DESC -- Use most recently active account
        LIMIT 1;

        IF v_account_id IS NULL THEN
            -- No account found. We can't insert a transaction without an account.
            -- Soft fail: The request is accepted, but no tx created.
            RETURN NEW; 
        END IF;

        -- Insert Mirror Transaction
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
            COALESCE(NEW.assigned_amount, v_original_tx.amount),
            'EXPENSE', -- Always EXPENSE for now (shared cost)
            v_original_tx.date,
            v_original_tx.category,
            v_account_id,
            NEW.invited_user_id,
            true, -- is_shared
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

CREATE TRIGGER on_shared_request_accepted
AFTER INSERT OR UPDATE OF status
ON shared_transaction_requests
FOR EACH ROW
WHEN (NEW.status = 'ACCEPTED')
EXECUTE FUNCTION handle_shared_transaction_mirror();

-- 4. CLEANUP LEGACY
-- We ensure settlement_requests are untouched as requested.
-- shared_transaction_requests is now just a trigger mechanism + history.
