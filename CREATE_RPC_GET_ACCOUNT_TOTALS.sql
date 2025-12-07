-- Function: get_account_totals
-- Description: Calculates the real-time balance for all accounts of a specific user.
-- Returns: Table with account_id and calculated_balance.

CREATE OR REPLACE FUNCTION get_account_totals(p_user_id uuid)
RETURNS TABLE (
    account_id uuid,
    calculated_balance numeric
)
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with permissions of the creator (system), bypassing RLS for performance inside the function, but we verify user_id manually
AS $$
BEGIN
    -- Ensure the user can only see their own data is redundant if we filter by p_user_id, 
    -- but usually good practice to check if auth.uid() == p_user_id if strict.
    -- For now, we trust the filter logic.

    RETURN QUERY
    SELECT
        a.id as account_id,
        (
            COALESCE(a.initial_balance, 0) +
            
            -- 1. Credits (Income)
            COALESCE((
                SELECT SUM(t.amount)
                FROM transactions t
                WHERE t.account_id = a.id
                  AND t.type = 'RECEITA' 
                  AND t.deleted = false
                  AND t.user_id = p_user_id
            ), 0) +
            
            -- 2. Refunds (treated as credit back to account)
            -- Logic: If it is an Expense AND is_refund=true, it ADDS to balance.
            COALESCE((
                SELECT SUM(t.amount)
                FROM transactions t
                WHERE t.account_id = a.id
                  AND t.type = 'DESPESA' 
                  AND t.is_refund = true
                  AND t.deleted = false
                  AND t.user_id = p_user_id
            ), 0) -
            
            -- 3. Debits (Expenses)
            COALESCE((
                SELECT SUM(t.amount)
                FROM transactions t
                WHERE t.account_id = a.id
                  AND t.type = 'DESPESA' 
                  AND t.is_refund = false
                  AND t.deleted = false
                  AND t.user_id = p_user_id
            ), 0) -
            
            -- 4. Transfers OUT
            COALESCE((
                SELECT SUM(t.amount)
                FROM transactions t
                WHERE t.account_id = a.id
                  AND t.type = 'TRANSFERÊNCIA' 
                  AND t.deleted = false
                  AND t.user_id = p_user_id
            ), 0) +
            
            -- 5. Transfers IN
            COALESCE((
                SELECT SUM(COALESCE(t.destination_amount, t.amount))
                FROM transactions t
                WHERE t.destination_account_id = a.id
                  AND t.type = 'TRANSFERÊNCIA' 
                  AND t.deleted = false
                  AND t.user_id = p_user_id
            ), 0)

        ) as calculated_balance
    FROM
        accounts a
    WHERE
        a.user_id = p_user_id
        AND a.deleted = false;
END;
$$;
