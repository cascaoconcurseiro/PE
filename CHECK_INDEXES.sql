-- Check existing indexes on key tables
SELECT 
    tablename, 
    indexname, 
    indexdef 
FROM 
    pg_indexes 
WHERE 
    schemaname = 'public' 
ORDER BY 
    tablename, 
    indexname;
