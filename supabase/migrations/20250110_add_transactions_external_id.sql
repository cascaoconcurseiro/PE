-- Add external_id column to transactions for tracking import IDs (FITID, etc)
ALTER TABLE transactions 
ADD COLUMN IF NOT EXISTS external_id TEXT;

-- Create a unique constraint to prevent importing the same transaction twice for the same account
-- We include user_id and account_id to scope it correctly.
-- Using 'nulls not distinct' might be useful if we supported multiple nulls, but for unique constraints 
-- we generally only care when external_id IS NOT NULL.
-- Standard UNIQUE allows multiple NULLs, which is what we want (manual transactions have null external_id).

CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_external_id_unique 
ON transactions (user_id, account_id, external_id) 
WHERE external_id IS NOT NULL;

-- Comment
COMMENT ON COLUMN transactions.external_id IS 'External ID from bank (FITID) or import source. Used for strict duplicate prevention.';
