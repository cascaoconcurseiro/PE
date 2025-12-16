-- ==============================================================================
-- UNFREEZE SYSTEM & FIX VISIBILITY (CORRECTED)
-- DATE: 2026-01-24
-- PROBLEM: Maintenance Mode blocked SELECTs. Script had wrong column names.
-- SOLUTION: 1. Fix column usage (`key` vs `flag_key`).
--           2. disable maintenance mode (`value='false'`).
--           3. Replace "FOR ALL" Freeze Policy with "FOR WRITE" policies only.
-- ==============================================================================

BEGIN;

-- 1. DISABLE MAINTENANCE MODE
-- Correct table schema: key (primary), value (text)
UPDATE public.system_flags 
SET value = 'false', updated_at = NOW() 
WHERE key = 'maintenance_mode';

-- 2. REMOVE BROKEN "FOR ALL" POLICIES
-- These blocked SELECTs when maintenance_mode was true.
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.transactions;
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.transaction_splits;
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.trips;
DROP POLICY IF EXISTS "System Freeze - Maintenance Mode" ON public.shared_transaction_requests;

-- 3. RECREATE GRANULAR POLICIES (BLOCK WRITES ONLY)
-- We use AS RESTRICTIVE so they act as a safety net on top of existing permissive policies.
-- SELECTs are intentionally OMITTED so they always work (ReadOnly Access).

-- A) Transactions
CREATE POLICY "System Freeze - Block Inserts" ON public.transactions
    AS RESTRICTIVE FOR INSERT 
    WITH CHECK (public.is_system_active());

CREATE POLICY "System Freeze - Block Updates" ON public.transactions
    AS RESTRICTIVE FOR UPDATE 
    USING (public.is_system_active());

CREATE POLICY "System Freeze - Block Deletes" ON public.transactions
    AS RESTRICTIVE FOR DELETE 
    USING (public.is_system_active());

-- B) Trips
CREATE POLICY "System Freeze - Block Inserts" ON public.trips
    AS RESTRICTIVE FOR INSERT 
    WITH CHECK (public.is_system_active());

CREATE POLICY "System Freeze - Block Updates" ON public.trips
    AS RESTRICTIVE FOR UPDATE 
    USING (public.is_system_active());

CREATE POLICY "System Freeze - Block Deletes" ON public.trips
    AS RESTRICTIVE FOR DELETE 
    USING (public.is_system_active());

-- C) Splits
CREATE POLICY "System Freeze - Block Inserts" ON public.transaction_splits
    AS RESTRICTIVE FOR INSERT 
    WITH CHECK (public.is_system_active());

CREATE POLICY "System Freeze - Block Updates" ON public.transaction_splits
    AS RESTRICTIVE FOR UPDATE 
    USING (public.is_system_active());

CREATE POLICY "System Freeze - Block Deletes" ON public.transaction_splits
    AS RESTRICTIVE FOR DELETE 
    USING (public.is_system_active());

-- 4. ENSURE CACHE RELOAD
NOTIFY pgrst, 'reload schema';

COMMIT;
