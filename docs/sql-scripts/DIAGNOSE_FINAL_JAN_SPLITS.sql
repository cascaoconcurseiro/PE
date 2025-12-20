-- ==============================================================================
-- FINAL CHECK: WESLEY'S JANUARY SPLITS
-- DATA: 2025-12-20
-- ==============================================================================

SELECT 
    id, 
    date, 
    description, 
    amount, 
    is_shared,
    shared_with,
    payer_id,
    domain
FROM public.transactions
WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false
ORDER BY date ASC;
