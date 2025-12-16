-- DIAGNOSTIC QUERY: Orphaned Foreign Keys
-- Run this to check if your data is ready for Strict UUID Migration.

WITH orphaned_accounts AS (
    SELECT id, description, account_id, date 
    FROM public.transactions 
    WHERE account_id IS NOT NULL 
    AND account_id::text <> ''
    AND account_id::text NOT IN (SELECT id::text FROM public.accounts)
),
orphaned_dest_accounts AS (
    SELECT id, description, destination_account_id, date 
    FROM public.transactions 
    WHERE destination_account_id IS NOT NULL 
    AND destination_account_id::text <> ''
    AND destination_account_id::text NOT IN (SELECT id::text FROM public.accounts)
),
orphaned_trips AS (
    SELECT id, description, trip_id, date 
    FROM public.transactions 
    WHERE trip_id IS NOT NULL 
    AND trip_id::text <> ''
    AND trip_id::text NOT IN (SELECT id::text FROM public.trips)
)
SELECT 
    'Orphaned Account IDs' as check_type, 
    COUNT(*) as count, 
    json_agg(t) as details 
FROM orphaned_accounts t
UNION ALL
SELECT 
    'Orphaned Dest Account IDs', 
    COUNT(*), 
    json_agg(t) 
FROM orphaned_dest_accounts t
UNION ALL
SELECT 
    'Orphaned Trip IDs', 
    COUNT(*), 
    json_agg(t) 
FROM orphaned_trips t;
