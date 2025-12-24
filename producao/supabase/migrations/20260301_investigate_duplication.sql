-- INVESTIGATE DUPLICATION PATTERN
-- RUN THIS IN SUPABASE SQL EDITOR

WITH recent_tx AS (
    SELECT 
        id,
        description,
        amount,
        to_char(date, 'YYYY-MM') as month_year,
        created_at
    FROM transactions
    WHERE created_at > (NOW() - INTERVAL '12 hours')
      AND description LIKE '%(%)%' -- Filter for installments like (1/10)
)
SELECT 
    month_year,
    description,
    count(*) as quantity,
    sum(amount) as total_amount
FROM recent_tx
GROUP BY month_year, description
ORDER BY month_year, description;

-- LIST ALL TRIGGERS ON TRANSACTIONS TABLE (AGAIN, WITH DEFINITION)
SELECT 
    trigger_name,
    event_manipulation,
    action_statement
FROM information_schema.triggers
WHERE event_object_table = 'transactions';
