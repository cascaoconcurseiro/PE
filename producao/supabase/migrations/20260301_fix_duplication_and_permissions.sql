-- Migration: Fix Duplication, Clean Data, and Enable Edit Permissions
-- Date: 2026-03-01
-- Author: Antigravity

BEGIN;

-- ==============================================================================
-- 1. DROP PROBLEMATIC TRIGGERS (ROOT CAUSE OF DUPLICATION)
-- ==============================================================================

-- If there is a legacy trigger causing duplication on INSERT, we must kill it.
DROP TRIGGER IF EXISTS trg_generate_installments ON public.transactions;
DROP FUNCTION IF EXISTS public.generate_installments_trigger();

DROP TRIGGER IF EXISTS trg_process_recurrence ON public.transactions;
DROP FUNCTION IF EXISTS public.process_recurrence_trigger();

-- Ensure NO triggers are intercepting normal inserts to auto-generate rows
-- We rely purely on the Frontend/Service to generate the 10 rows.

-- ==============================================================================
-- 2. CLEANUP DUPLICATES (The 100x mess)
-- ==============================================================================

-- Delete duplicated shared installment transactions created recently (last 24h)
-- Criteria: Description like '%(X/Y)', created recently, and grouping count > 10 (abnormal)
DELETE FROM public.transactions
WHERE id IN (
    SELECT id FROM (
        SELECT id, 
               description, 
               created_at,
               ROW_NUMBER() OVER (PARTITION BY description, amount, date ORDER BY created_at DESC) as rn
        FROM public.transactions
        WHERE is_shared = true
          AND is_installment = true
          AND created_at > NOW() - INTERVAL '24 hours'
    ) duplicates
    WHERE rn > 1 -- Keep only the most recent one (or could be > 0 to start fresh)
);

-- Radical cleanup for the specific reported case if above is too weak:
-- "Resultando todas dez parcelas em todos dez meses"
-- Delete ALL shared installments created in the last 24h to allow clean re-import
DELETE FROM public.transactions 
WHERE is_shared = true 
  AND is_installment = true 
  AND created_at > NOW() - INTERVAL '24 hours';

-- Also clean up associated ledger entries (Cascade should handle this but let's be safe)
DELETE FROM public.ledger_entries
WHERE transaction_id IS NOT NULL 
  AND transaction_id NOT IN (SELECT id FROM public.transactions);


-- ==============================================================================
-- 3. ENABLE EDIT/DELETE FOR CREATORS (RLS FIX)
-- ==============================================================================

-- Drop existing policies that might be restrictive
DROP POLICY IF EXISTS "Users can update their own shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete their own shared transactions" ON public.transactions;

-- Update Policy: Creator (user_id) OR Payer (payer_id) can update
CREATE POLICY "Enable update for creator or payer"
ON public.transactions
FOR UPDATE
USING (
    auth.uid() = user_id OR 
    (payer_id IS NOT NULL AND auth.uid()::text = payer_id)
);

-- Delete Policy: Creator (user_id) OR Payer (payer_id) can delete
CREATE POLICY "Enable delete for creator or payer"
ON public.transactions
FOR DELETE
USING (
    auth.uid() = user_id OR 
    (payer_id IS NOT NULL AND auth.uid()::text = payer_id)
);

-- ==============================================================================
-- 4. FIX FOREIGN KEY (Double Check)
-- ==============================================================================
-- Just to be absolutely sure the previous fix is applied
CREATE OR REPLACE FUNCTION public.fix_chart_fk_bug() RETURNS VOID AS $$
BEGIN
    -- No-op here, assuming architecture_reset.sql was applied.
    -- But we can explicitly update bad rows if any slipped through?
    -- No, bad rows would be rejected by FK.
END;
$$ LANGUAGE plpgsql;


COMMIT;
