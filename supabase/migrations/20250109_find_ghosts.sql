-- DIAGNOSTIC: FIND GHOST TRANSACTIONS
-- DATE: 2025-01-09
-- Run this in Supabase SQL Editor.

-- 1. Find the specific 105.00 transaction (or anything close)
SELECT 
    id, 
    description, 
    amount, 
    date, 
    type, 
    trip_id, 
    category,
    is_shared,
    deleted
FROM transactions
WHERE amount = 105.00
OR (amount > 104.99 AND amount < 105.01);

-- 2. Check for ANY transaction with a Zombie Trip ID (still!)
-- This verifies if V8 actually worked or if type casting issues persisted.
SELECT 
    t.id, 
    t.description, 
    t.amount, 
    t.trip_id
FROM transactions t
LEFT JOIN trips tr ON t.trip_id::text = tr.id::text
WHERE t.trip_id IS NOT NULL 
AND tr.id IS NULL;
