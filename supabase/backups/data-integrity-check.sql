-- Data Integrity Check Script
-- Run this before and after major changes to validate data consistency

-- Create temporary table for integrity report
CREATE TEMP TABLE integrity_report (
    check_name TEXT,
    status TEXT,
    count_found INTEGER,
    details TEXT,
    severity TEXT -- 'INFO', 'WARNING', 'ERROR'
);

-- Check 1: Orphaned transactions (account_id not in accounts)
INSERT INTO integrity_report
SELECT 
    'Orphaned Transactions - Invalid Account ID',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transactions with account_id not found in accounts table',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'ERROR' END
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
WHERE t.account_id IS NOT NULL 
  AND a.id IS NULL 
  AND NOT t.deleted;

-- Check 2: Orphaned transactions (destination_account_id not in accounts)
INSERT INTO integrity_report
SELECT 
    'Orphaned Transactions - Invalid Destination Account ID',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transactions with destination_account_id not found in accounts table',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'ERROR' END
FROM transactions t
LEFT JOIN accounts a ON t.destination_account_id = a.id
WHERE t.destination_account_id IS NOT NULL 
  AND a.id IS NULL 
  AND NOT t.deleted;

-- Check 3: Invalid payer_id references
INSERT INTO integrity_report
SELECT 
    'Invalid Payer References',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transactions with payer_id not found in family_members table',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'WARNING' END
FROM transactions t
LEFT JOIN family_members fm ON t.payer_id = fm.id
WHERE t.payer_id IS NOT NULL 
  AND fm.id IS NULL 
  AND NOT t.deleted;

-- Check 4: Invalid trip_id references
INSERT INTO integrity_report
SELECT 
    'Invalid Trip References',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transactions with trip_id not found in trips table',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'WARNING' END
FROM transactions t
LEFT JOIN trips tr ON t.trip_id = tr.id
WHERE t.trip_id IS NOT NULL 
  AND tr.id IS NULL 
  AND NOT t.deleted;

-- Check 5: Balance consistency (calculated vs stored)
WITH calculated_balances AS (
    SELECT 
        a.id as account_id,
        a.name as account_name,
        a.balance as stored_balance,
        COALESCE(
            SUM(CASE 
                WHEN t.type = 'RECEITA' THEN t.amount
                WHEN t.type = 'DESPESA' THEN -t.amount
                WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = a.id THEN -t.amount
                WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = a.id THEN t.amount
                ELSE 0
            END), 0
        ) as calculated_balance
    FROM accounts a
    LEFT JOIN transactions t ON (t.account_id = a.id OR t.destination_account_id = a.id)
        AND NOT t.deleted
    WHERE NOT a.deleted
    GROUP BY a.id, a.name, a.balance
),
balance_differences AS (
    SELECT 
        account_id,
        account_name,
        stored_balance,
        calculated_balance,
        ABS(stored_balance - calculated_balance) as difference
    FROM calculated_balances
    WHERE ABS(stored_balance - calculated_balance) > 0.01 -- Allow for small rounding differences
)
INSERT INTO integrity_report
SELECT 
    'Balance Inconsistencies',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Accounts where stored balance != calculated balance: ' || 
    COALESCE(STRING_AGG(account_name || ' (diff: ' || difference::TEXT || ')', ', '), 'None'),
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'ERROR' END
FROM balance_differences;

-- Check 6: Duplicate account names per user
INSERT INTO integrity_report
SELECT 
    'Duplicate Account Names',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Users with duplicate account names',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'WARNING' END
FROM (
    SELECT user_id, name, COUNT(*) as count
    FROM accounts
    WHERE NOT deleted
    GROUP BY user_id, name
    HAVING COUNT(*) > 1
) duplicates;

-- Check 7: Transactions with invalid amounts
INSERT INTO integrity_report
SELECT 
    'Invalid Transaction Amounts',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transactions with amount <= 0',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'ERROR' END
FROM transactions
WHERE amount <= 0 AND NOT deleted;

-- Check 8: Transactions with invalid types
INSERT INTO integrity_report
SELECT 
    'Invalid Transaction Types',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transactions with invalid type values',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'ERROR' END
FROM transactions
WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA') AND NOT deleted;

-- Check 9: Transfer transactions missing required fields
INSERT INTO integrity_report
SELECT 
    'Invalid Transfer Transactions',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Transfer transactions missing account_id or destination_account_id',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'ERROR' END
FROM transactions
WHERE type = 'TRANSFERÊNCIA' 
  AND (account_id IS NULL OR destination_account_id IS NULL OR account_id = destination_account_id)
  AND NOT deleted;

-- Check 10: Shared transactions with invalid JSON
INSERT INTO integrity_report
SELECT 
    'Invalid Shared Transaction JSON',
    CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END,
    COUNT(*),
    'Shared transactions with invalid splits JSON',
    CASE WHEN COUNT(*) = 0 THEN 'INFO' ELSE 'WARNING' END
FROM transactions
WHERE is_shared = true 
  AND (splits IS NULL OR NOT jsonb_typeof(splits) = 'array')
  AND NOT deleted;

-- Display the integrity report
SELECT 
    check_name,
    status,
    count_found,
    details,
    severity,
    CASE 
        WHEN severity = 'ERROR' THEN '🔴'
        WHEN severity = 'WARNING' THEN '🟡'
        ELSE '🟢'
    END as icon
FROM integrity_report
ORDER BY 
    CASE severity 
        WHEN 'ERROR' THEN 1 
        WHEN 'WARNING' THEN 2 
        ELSE 3 
    END,
    check_name;

-- Summary
SELECT 
    COUNT(*) as total_checks,
    SUM(CASE WHEN status = 'PASS' THEN 1 ELSE 0 END) as passed,
    SUM(CASE WHEN status = 'FAIL' THEN 1 ELSE 0 END) as failed,
    SUM(CASE WHEN severity = 'ERROR' THEN 1 ELSE 0 END) as errors,
    SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END) as warnings
FROM integrity_report;

-- Recommendations
DO $$
DECLARE
    error_count INTEGER;
    warning_count INTEGER;
BEGIN
    SELECT 
        SUM(CASE WHEN severity = 'ERROR' THEN 1 ELSE 0 END),
        SUM(CASE WHEN severity = 'WARNING' THEN 1 ELSE 0 END)
    INTO error_count, warning_count
    FROM integrity_report;
    
    RAISE NOTICE '=== DATA INTEGRITY REPORT ===';
    
    IF error_count > 0 THEN
        RAISE NOTICE '🔴 CRITICAL: % errors found. DO NOT proceed with migration until fixed!', error_count;
    ELSIF warning_count > 0 THEN
        RAISE NOTICE '🟡 CAUTION: % warnings found. Review before proceeding.', warning_count;
    ELSE
        RAISE NOTICE '🟢 SUCCESS: All integrity checks passed. Safe to proceed.';
    END IF;
    
    RAISE NOTICE 'Run this script again after any data modifications.';
END $$;