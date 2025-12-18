-- ==============================================================================
-- MIGRATION: SOFT DELETE GOVERNANCE (2026-01-11) - REVISED & EXHAUSTIVE
-- DESCRIPTION: 
-- 1. Updates RLS Policies to GLOBALLY HIDE 'deleted=true' records for ALL relevant tables.
--    Reason: "Soft Deleted" data should be invisible to the standard API.
--    Exception: Data recovery tools (admin) or specific "Bin" views would need bypass.
-- ==============================================================================

BEGIN;

-- Helper to safely drop/create policies
-- 1. TRANSACTIONS
DROP POLICY IF EXISTS "Users can see own data" ON public.transactions;
CREATE POLICY "Users can see own data" ON public.transactions 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 2. ACCOUNTS
DROP POLICY IF EXISTS "Users can see own accounts" ON public.accounts;
CREATE POLICY "Users can see own accounts" ON public.accounts 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 3. TRIPS
DROP POLICY IF EXISTS "Users can see own trips" ON public.trips;
CREATE POLICY "Users can see own trips" ON public.trips 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 4. FAMILY MEMBERS
DROP POLICY IF EXISTS "Users can see own family" ON public.family_members;
CREATE POLICY "Users can see own family" ON public.family_members 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 5. ASSETS
DROP POLICY IF EXISTS "Users can see own assets" ON public.assets;
CREATE POLICY "Users can see own assets" ON public.assets 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 6. GOALS
DROP POLICY IF EXISTS "Users can see own goals" ON public.goals;
CREATE POLICY "Users can see own goals" ON public.goals 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 7. BUDGETS
DROP POLICY IF EXISTS "Users can see own budgets" ON public.budgets;
CREATE POLICY "Users can see own budgets" ON public.budgets 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 8. CUSTOM CATEGORIES (Assuming they have 'deleted' column, usually created_by logic)
DROP POLICY IF EXISTS "Users can see own categories" ON public.custom_categories;
CREATE POLICY "Users can see own categories" ON public.custom_categories 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

-- 9. SNAPSHOTS
DROP POLICY IF EXISTS "Users can see own snapshots" ON public.snapshots;
CREATE POLICY "Users can see own snapshots" ON public.snapshots 
    FOR ALL USING (user_id = auth.uid() AND deleted = false);

COMMIT;
