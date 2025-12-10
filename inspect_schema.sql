
-- Check table constraints and structure
SELECT 
    tc.table_schema, 
    tc.table_name, 
    kcu.column_name, 
    tc.constraint_name, 
    tc.constraint_type
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu 
    ON tc.constraint_name = kcu.constraint_name 
    AND tc.table_schema = kcu.table_schema
WHERE tc.table_schema = 'public' 
ORDER BY tc.table_name, tc.constraint_type;
