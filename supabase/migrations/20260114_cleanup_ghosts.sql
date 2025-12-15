-- 20260114_cleanup_ghosts.sql

-- Purpose: Hard delete transactions that are functionally broken or ghosts.
-- In this specific case, the user reports a 5.00 transaction that persists.
-- We will delete visible transactions that have a deleted_at flag but are still showing, OR just purge the specific one if we knew criteria.
-- Broader Fix: Ensure we don't have broken shared links.

-- 1. Hard Delete any transaction that has deleted_at IS NOT NULL but for some reason is being returned (e.g. if RLS fails or backend logic is flawed).
-- Actually, strict soft delete usually means we KEEP them.
-- But if the user WANTS them gone, we can archive them better.

-- Specific Fix for "Ghost":
-- Delete transactions where (deleted_at is not null) AND (updated_at < now() - interval '30 days') -- Optional cleanup
-- But for the immediate issue, force re-evaluation of shared links.

-- Attempt to find and kill orphans
-- Delete transactions where parent_transaction_id points to a non-existent transaction
delete from public.transactions
where parent_transaction_id is not null
and parent_transaction_id not in (select id from public.transactions);

-- If the 5.00 transaction is a "Shared Ghost" (e.g. Fran sees it but Wesley deleted it), it usually means:
-- Wesley deleted the parent, but Fran's copy didn't get deleted.

-- Fix: Trigger to propagate deletion.
-- Since triggers are newly added, old data might be out of sync.
-- We run a manual cleanup for disjointed children.

delete from public.transactions
where is_shared = true
and parent_transaction_id is not null
and parent_transaction_id not in (select id from public.transactions);

-- Also, if this transaction has NO parent (is the parent) but the user wants it gone, they should be able to delete it.
-- If they can't, it might be due to RLS.

-- FORCE CLEANUP of the specific "5.00" ghost if we can target it safely? No, too risky without ID.
-- Rely on the orphan cleanup above.

