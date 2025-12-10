
-- List triggers on transactions table
SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'transactions';

-- List Functions that might be managing balance
SELECT 
    routine_name, 
    routine_definition 
FROM information_schema.routines 
WHERE routine_schema = 'public'
AND routine_definition LIKE '%accounts%';
