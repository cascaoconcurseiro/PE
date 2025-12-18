-- 20260114_cleanup_ghosts.sql

-- Purpose: Hard delete transactions that are functionally broken or ghosts.
-- Corrected to use 'source_transaction_id' instead of non-existent 'parent_transaction_id'.

-- 1. Delete Orphans (Children pointing to non-existent Parents)
DELETE FROM public.transactions
WHERE source_transaction_id IS NOT NULL
AND source_transaction_id NOT IN (SELECT id FROM public.transactions);

-- 2. Delete Broken Shared Links
-- (Same logic, just being explicit about shared ones)
DELETE FROM public.transactions
WHERE is_shared = true
AND source_transaction_id IS NOT NULL
AND source_transaction_id NOT IN (SELECT id FROM public.transactions);

-- 3. Cleanup "Ghost" 5.00 transaction specifically if needed?
-- The above should catch it if it's an orphan.
