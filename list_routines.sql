
-- List all public functions
SELECT routine_name 
FROM information_schema.routines 
WHERE routine_schema = 'public';
