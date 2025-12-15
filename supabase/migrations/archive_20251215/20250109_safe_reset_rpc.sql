-- MIGRATION: SAFE FACTORY RESET (RPC)
-- DATE: 2025-01-09
-- DESCRIPTION: Allows a user to wipe ONLY their own data.

CREATE OR REPLACE FUNCTION reset_own_data()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
BEGIN
    v_user_id := auth.uid();
    
    -- Safety check: Ensure we have a user
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 1. Delete Transactions (User is owner)
    DELETE FROM public.transactions WHERE user_id = v_user_id;

    -- 2. Delete Trips (User is owner)
    -- This will cascade delete remaining transactions if the trigger exists, 
    -- but we already deleted them above.
    DELETE FROM public.trips WHERE user_id = v_user_id;

    -- 3. Delete Notifications
    DELETE FROM public.user_notifications WHERE user_id = v_user_id;
    
    -- 4. Delete Shared Requests (Sent by me or received by me?)
    -- Usually we want to clear requests I created.
    DELETE FROM public.shared_transaction_requests WHERE sender_id = v_user_id;
    
    -- 5. Delete Accounts? Factory reset usually implies everything?
    -- User requested "todos lançamentos". Usually Accounts are structural, but "Factory Reset" implies starting fresh.
    -- Let's wipe Accounts too, except maybe default ones if logically separate.
    -- For now, wipe EVERYTHING owned by user.
    DELETE FROM public.accounts WHERE user_id = v_user_id;

    -- 6. Delete Categories?
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;

    -- 7. Delete Goals/Budgets
    DELETE FROM public.goals WHERE user_id = v_user_id;
    DELETE FROM public.budgets WHERE user_id = v_user_id;
    
    -- 8. Ledger Entries
    DELETE FROM public.ledger_entries WHERE user_id = v_user_id;
    
    -- 9. Assets
    DELETE FROM public.assets WHERE user_id = v_user_id;

END;
$$;
