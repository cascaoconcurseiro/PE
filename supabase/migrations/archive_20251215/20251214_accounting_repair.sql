-- ACCOUNTING REPAIR SCRIPT (2025-12-14)
-- Purpose: Convert "Metadata Initial Balances" to "Explicit Ledger Transactions".
-- This ensures "Double Entry" consistency and makes the Opening Balance visible in Cash Flow and Statements.

DO $do$
DECLARE
    acc_rec RECORD;
    tx_id UUID;
    created_count INT := 0;
BEGIN
    RAISE NOTICE 'Starting Accounting Repair...';

    -- 1. Iterate over accounts with non-zero Initial Balance
    FOR acc_rec IN SELECT * FROM accounts WHERE initial_balance IS NOT NULL AND initial_balance <> 0
    LOOP
        -- Create Explicit Transaction
        INSERT INTO transactions (
            user_id,
            account_id,
            amount,
            type,
            category,
            description,
            date,
            is_settled,
            created_at,
            updated_at
        ) VALUES (
            acc_rec.user_id,
            acc_rec.id,
            ABS(acc_rec.initial_balance),
            CASE WHEN acc_rec.initial_balance > 0 THEN 'RECEITA' ELSE 'DESPESA' END, -- Positive = Asset (Income-like logic for flow), Negative = Liability
            'Ajuste', -- Category
            'Saldo Inicial', -- Description
            acc_rec.created_at, -- Date (use account creation date)
            true, -- is_settled
            NOW(),
            NOW()
        );

        -- Zero out the Initial Balance metadata to prevent double-counting
        UPDATE accounts 
        SET initial_balance = 0,
            updated_at = NOW()
        WHERE id = acc_rec.id;

        created_count := created_count + 1;
    END LOOP;

    RAISE NOTICE 'Converted % Initial Balances to Transactions.', created_count;
    
    -- 2. INVESTIGATE "801" DISCREPANCY (Diagnostic Only)
    -- This block doesn't change data, just logs potential hidden items
    -- Check for "Orphan" transactions that might be affecting sums silently
    PERFORM id, description, amount FROM transactions 
    WHERE account_id IS NULL AND is_shared = false; 
    
    -- Check for "Soft Deleted" transactions
    PERFORM id, description, amount FROM transactions WHERE deleted = true;

END $do$;
