-- ARCHITECTURAL INTEGRITY MIGRATION
-- Purpose: Enforce data consistency at the database level to prevent 'Frontend Logic' failures.

-- 1. CLEANUP INVALID DATA (Soft Delete Orphans)
UPDATE public.transactions
SET deleted = true, updated_at = now()
WHERE account_id IS NOT NULL 
  AND account_id NOT IN (SELECT id FROM public.accounts);

-- 2. APPLY CONSTRAINTS

-- Ensure Non-Negative Amounts (Business Logic: Amounts are absolute, Type determines sign)
ALTER TABLE public.transactions
CONSTRAINT check_amount_positive CHECK (amount >= 0);

-- Ensure Valid Types
ALTER TABLE public.transactions
CONSTRAINT check_valid_type CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA'));

-- Ensure Transfer Consistency
-- If type is TRANSFER, destination_account_id should ideally be present (but we allow NULL for external/cash withdrawals in some legacy app logic, trying to tighten this).
-- Let's enforcing that if it is a TRANSFER, and it is NOT deleted, it implies moving money.
-- Complex check, maybe skip for now to avoid breaking legacy 'withdrawals'.

-- 3. INDEXING FOR PERFORMANCE (Optimizing the O(N) fetches)
-- Index foreign keys
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_destination_account_id ON public.transactions(destination_account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_user_id_date ON public.transactions(user_id, date DESC);

-- 4. ENSURE DEFAULT CURRENCY
ALTER TABLE public.transactions 
ALTER COLUMN currency SET DEFAULT 'BRL';

ALTER TABLE public.accounts
ALTER COLUMN currency SET DEFAULT 'BRL';
