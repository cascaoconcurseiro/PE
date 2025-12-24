-- Migration: Cleanup Legacy and Duplicate Triggers
-- Date: 2026-03-01
-- Description: Removes old, disabled, or duplicate triggers to clean up the database schema.

-- 1. Remove Legacy Cache Sync Trigger (Explicitly named legacy)
DROP TRIGGER IF EXISTS trg_sync_legacy_cache ON ledger_accounts;
DROP FUNCTION IF EXISTS sync_ledger_to_legacy_cache();

-- 2. Remove Old Transaction Split Notification (Likely replaced by new Shared Manager)
DROP TRIGGER IF EXISTS trg_notify_new_split ON transaction_splits;
DROP FUNCTION IF EXISTS notify_new_split_debt();

-- 3. Remove Old Shared Transaction Notification (Duplicate of new logic?)
-- If we are moving to RPCs and Client-Side events, this might be redundant spam.
DROP TRIGGER IF EXISTS trigger_notify_shared_transaction ON transactions;
DROP FUNCTION IF EXISTS notify_shared_transaction();

-- 4. Remove Settlement Auto-Revert (If strictly moving to Ledger, reverting a split via trigger is dangerous)
-- It's better to handle reversals via explicit Ledger Reversal transactions.
DROP TRIGGER IF EXISTS trg_auto_revert_settlement ON transaction_splits;
DROP FUNCTION IF EXISTS handle_settlement_deletion();

-- 5. Remove any other potential duplicates if found (Safety check)
-- (Add more here if identified during analysis)

-- 6. Log Cleanup
INSERT INTO audit_logs (
    entity, 
    entity_id, 
    action, 
    changes, 
    user_id
) VALUES (
    'SYSTEM', 
    'SCHEMA_CLEANUP', 
    'DELETE', 
    '{"description": "Removed legacy triggers: trg_sync_legacy_cache, trg_notify_new_split, trigger_notify_shared_transaction, trg_auto_revert_settlement"}', 
    auth.uid()
);
