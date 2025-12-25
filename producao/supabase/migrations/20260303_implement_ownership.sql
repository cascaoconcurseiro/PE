-- 1. ADD created_by COLUMN
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES auth.users(id);

-- 2. BACKFILL (Assume Owner created it if null)
UPDATE public.transactions 
SET created_by = user_id 
WHERE created_by IS NULL;

-- 3. ENFORCE
ALTER TABLE public.transactions 
ALTER COLUMN created_by SET NOT NULL;

-- 4. DROP OLD POLICIES (Safety Clean)
DROP POLICY IF EXISTS "Users can view own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can insert own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can delete own transactions" ON public.transactions;
-- (And any other variants)
DROP POLICY IF EXISTS "transactions_select_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_insert_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_update_policy" ON public.transactions;
DROP POLICY IF EXISTS "transactions_delete_policy" ON public.transactions;


-- 5. NEW POLICIES (The "Triangle of Truth")

-- VIEW: Author OR Owner
CREATE POLICY "view_author_or_owner"
ON public.transactions
FOR SELECT
USING (
    created_by = auth.uid() 
    OR user_id = auth.uid()
);

-- INSERT: Author MUST be Auth User (Can create for others)
CREATE POLICY "insert_as_author"
ON public.transactions
FOR INSERT
WITH CHECK (
    created_by = auth.uid()
);

-- UPDATE: Only Author (Original Creator)
CREATE POLICY "update_by_author"
ON public.transactions
FOR UPDATE
USING (
    created_by = auth.uid()
);

-- DELETE: Only Author
CREATE POLICY "delete_by_author"
ON public.transactions
FOR DELETE
USING (
    created_by = auth.uid()
);

-- 6. GRANT PERMISSIONS (Just in case)
GRANT ALL ON public.transactions TO authenticated;
