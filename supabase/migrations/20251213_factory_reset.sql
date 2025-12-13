-- DANGEROUS: Factory Reset Script
-- Clears ALL user data but preserves schema and constraints.

BEGIN;

-- 1. Disable triggers temporarily to avoid cascades/logs during reset (optional, but cleaner)
-- Actually, TRUNCATE CASCADE handles dependencies.

-- 2. Truncate Tables (Order matters slightly if we didn't use CASCADE, but with CASCADE it's easier)
-- Nuke everything related to financial data.
TRUNCATE TABLE 
    "transactions", 
    "accounts", 
    "goals", 
    "budgets", 
    "trips",
    "family_members", 
    "custom_categories",
    "user_notifications",
    "settlement_requests",
    "audit_logs",
    "assets",
    "trade_history",
    "snapshots",
    "transaction_splits"
RESTART IDENTITY CASCADE;

-- 3. Cleanup specialized tables that might be missed
-- (e.g. if we have specific join tables not covered by cascade, though standard FKs clear them)

-- 4. Re-Initialize Default Data (Optional)
-- If we need to re-create a default "Wallet" account or similar, do it here.
-- usually the frontend handles new user setup.

COMMIT;

-- Verification
SELECT count(*) as tx_count FROM transactions;
SELECT count(*) as acc_count FROM accounts;
