-- DIAGNOSTIC SCRIPT: CHECK ACTIVE TRIGGERS AND FUNCTION SOURCE
-- DATE: 2025-01-09
-- Run this in Supabase SQL Editor and check the results.

-- 1. List ALL Triggers on 'trips' and 'transactions'
SELECT 
    event_object_table AS table_name, 
    trigger_name, 
    action_timing, 
    event_manipulation AS event, 
    action_statement AS function_call
FROM information_schema.triggers 
WHERE event_object_table IN ('trips', 'transactions') 
ORDER BY event_object_table, trigger_name;

-- 2. Show the SOURCE CODE of the vital functions
-- Check if 'jsonb_array_elements' (OLD) or 'jsonb_array_length' (NEW V4) is there.
SELECT 
    routine_name, 
    routine_definition 
FROM information_schema.routines 
WHERE routine_name IN ('handle_trip_sharing', 'handle_mirror_shared_transaction');
