-- FIX PHANTOM TRANSACTIONS with Defensive Casting
DO $$
DECLARE
    deleted_count INT;
BEGIN
    -- Delete phantom 'uu' transactions
    DELETE FROM transactions 
    WHERE description = 'uu' OR description = 'UU';
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    RAISE NOTICE 'Deleted % phantom transactions.', deleted_count;

    -- Recalculate Account Balances
    UPDATE accounts 
    SET balance = (
        SELECT COALESCE(SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE -amount END), 0)
        FROM transactions 
        WHERE account_id::text = accounts.id::text -- Force Text Comparison
          AND deleted = false
    ) + COALESCE(initial_balance, 0)
    WHERE name LIKE '%Nubank%';

END $$;
