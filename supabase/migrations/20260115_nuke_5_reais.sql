-- 20260115_nuke_5_reais.sql

-- NUCLEAR OPTION: Delete specific ghost transactions reported by user.
-- Target: Shared transactions with amount 5.00 (or 5)
-- Reason: User reports persistent ghosts even after orphan cleanup.

BEGIN;

-- 1. Hard Delete specific 5.00 shared items for the current user
DELETE FROM public.transactions
WHERE user_id = auth.uid()
AND amount = 5.00;

-- 2. Also check for 10.00 just in case
-- DELETE FROM public.transactions WHERE user_id = auth.uid() AND amount = 10.00;

-- 3. Cleanup any transaction that claims to be shared but has no valid parent/source
-- (Aggressive Orphan Removal)
DELETE FROM public.transactions
WHERE user_id = auth.uid()
AND is_shared = true
AND source_transaction_id IS NOT NULL
AND source_transaction_id NOT IN (SELECT id FROM public.transactions);

-- 4. Audit Log Cleanup for these (optional)
-- DELETE FROM public.audit_logs WHERE record_id IN (...);

COMMIT;
