-- BACKFILL SCRIPT: PROCESS OLD PENDING REQUESTS
-- Objective: "Unstick" old requests by forcing them to ACCEPTED.
-- This will fire the 'on_shared_request_accepted' trigger and create the mirror transactions.

DO $$
DECLARE
    r RECORD;
BEGIN
    -- Loop through all PENDING requests
    FOR r IN 
        SELECT str.id 
        FROM shared_transaction_requests str
        WHERE str.status = 'PENDING'
    LOOP
        -- Update to ACCEPTED
        -- This update will fire the TRIGGER 'on_shared_request_accepted'
        -- The trigger calls 'handle_shared_transaction_mirror()' which creates the transaction.
        
        UPDATE shared_transaction_requests
        SET 
            status = 'ACCEPTED',
            responded_at = NOW()
        WHERE id = r.id;
        
        -- Note: We are blinded updating ALL pending requests here to ensure visibility.
        -- If we wanted to be strict, we'd check family_members link, but user asked for "NOVA REGRA OFICIAL... Não existe mais aceite".
        -- So we assume all current pending requests are valid to be shown.
        
    END LOOP;
END $$;
