-- ==============================================================================
-- MIGRATION: FIX SAFE RESET RPC (ADD FAMILY MEMBERS)
-- DATE: 2025-12-15
-- DESCRIPTION: Updates reset_own_data() to DELETE family_members as well.
-- ==============================================================================

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

    -- 2. Delete Trips
    DELETE FROM public.trips WHERE user_id = v_user_id;

    -- 3. Delete Notifications
    DELETE FROM public.user_notifications WHERE user_id = v_user_id;
    
    -- 4. Delete Shared Requests
    DELETE FROM public.shared_transaction_requests WHERE requester_id = v_user_id OR invited_user_id = v_user_id;
    
    -- 5. Delete Accounts
    DELETE FROM public.accounts WHERE user_id = v_user_id;

    -- 6. Delete Categories
    DELETE FROM public.custom_categories WHERE user_id = v_user_id;

    -- 7. Delete Goals/Budgets
    DELETE FROM public.goals WHERE user_id = v_user_id;
    DELETE FROM public.budgets WHERE user_id = v_user_id;
    
    -- 8. Ledger Entries
    DELETE FROM public.ledger_entries WHERE user_id = v_user_id;
    
    -- 9. Assets
    DELETE FROM public.assets WHERE user_id = v_user_id;

    -- 10. Credit Cards
    DELETE FROM public.credit_cards WHERE user_id = v_user_id;

    -- 11. Family Members (ADDED AS PER REQUEST)
    DELETE FROM public.family_members WHERE user_id = v_user_id;

END $$;
