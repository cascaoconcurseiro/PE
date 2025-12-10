
WITH calculated_balances AS (
    SELECT 
        account_id,
        SUM(
            CASE 
                WHEN type = 'RECEITA' THEN amount 
                WHEN type = 'DESPESA' THEN -amount 
                WHEN type = 'TRANSFERÊNCIA' AND destination_account_id IS NOT NULL THEN -amount -- Outgoing
                ELSE 0 
            END
        ) as balance_change
    FROM transactions 
    WHERE deleted = false
    GROUP BY account_id
),
incoming_transfers AS (
    SELECT 
        destination_account_id as account_id,
        SUM(amount) as balance_change
    FROM transactions
    WHERE type = 'TRANSFERÊNCIA' 
    AND destination_account_id IS NOT NULL 
    AND deleted = false
    GROUP BY destination_account_id
)
SELECT 
    a.name, 
    a.balance as stored_balance,
    COALESCE(cb.balance_change, 0) + COALESCE(it.balance_change, 0) + COALESCE(a.initial_balance, 0) as calculated_balance,
    (a.balance - (COALESCE(cb.balance_change, 0) + COALESCE(it.balance_change, 0) + COALESCE(a.initial_balance, 0))) as difference
FROM accounts a
LEFT JOIN calculated_balances cb ON a.id::text = cb.account_id::text
LEFT JOIN incoming_transfers it ON a.id::text = it.account_id::text;
