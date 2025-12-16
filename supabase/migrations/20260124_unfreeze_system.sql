-- ==============================================================================
-- UNFREEZE SYSTEM & FIX VISIBILITY
-- DATE: 2026-01-24
-- PROBLEM: Maintenance Mode is ON, blocking ALL operations (including SELECT).
--          Users cannot see Transactions, Trips, or Shared items.
-- SOLUTION: 1. Disable Maintenance Mode.
--           2. Update RLS policies to ALWAYS allow SELECT (Read-Only) even in Freeze.
-- ==============================================================================

BEGIN;

-- 1. DISABLE MAINTENANCE MODE (Restores Write Access via normal channels if needed, but we rely on RPCs)
--    Actually, we want to allow normal usage now.
UPDATE public.system_flags 
SET is_enabled = false, updated_at = NOW() 
WHERE flag_key = 'maintenance_mode';

-- 2. REFINE RLS POLICIES (Safety Net)
--    Modify policies to allow SELECT even if Maintenance Mode is TRUE.
--    This prevents "Invisible Data" panic if we ever freeze again.

-- Transactions
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.transactions;
CREATE POLICY "System Freeze - Maintenance Mode - Modifiers" ON public.transactions
    FOR ALL -- INSERT/UPDATE/DELETE (and SELECT if not separated?)
    -- Use USING for Filter (Select/Update/Delete visibility) and WITH CHECK for Insert/Update
    -- Wait, FOR ALL includes SELECT.
    -- We want to BLOCK writes, ALLOW reads.
    USING (
        -- ALLOW if it is a SELECT
        (current_setting('request.method', true) = 'GET') 
        OR 
        -- OR if Maintenance Mode is OFF
        (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false))
    );
    -- Ideally, we split policies.
    
-- CLEANER APPROACH: Split Policies
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode - Modifiers" ON public.transactions;

-- Allow READS always (subject to User Ownership Policy which is separate)
-- We don't need a specific freeze policy for SELECT if the default is permitted by "Users can view own...".
-- So we only need to restrict MODIFICATIONS during freeze.

CREATE POLICY "System Freeze - Block Writes" ON public.transactions
    FOR INSERT 
    WITH CHECK (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false));

CREATE POLICY "System Freeze - Block Updates" ON public.transactions
    FOR UPDATE
    USING (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false));

CREATE POLICY "System Freeze - Block Deletes" ON public.transactions
    FOR DELETE
    USING (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false));

-- Repeat for Trips
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.trips;
CREATE POLICY "System Freeze - Block Writes" ON public.trips
    FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false));
CREATE POLICY "System Freeze - Block Updates" ON public.trips
    FOR UPDATE USING (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false));
CREATE POLICY "System Freeze - Block Deletes" ON public.trips
    FOR DELETE USING (EXISTS (SELECT 1 FROM system_flags WHERE flag_key = 'maintenance_mode' AND is_enabled = false));

-- Repeat for Shared Transaction Requests
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.shared_transaction_requests;
-- (Similar block logic or simply remove since low risk)
-- Let's just remove the Freeze policy from shared_requests to fix the "Shared items not appearing" issue quickly, relying on standard ownership policies.

NOTIFY pgrst, 'reload schema';

COMMIT;
