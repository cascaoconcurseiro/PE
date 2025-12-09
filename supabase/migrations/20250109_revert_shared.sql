-- REVERT SCRIPT: CLEAN UP SHARED/SYNC FEATURES
-- As requested: Deletes tables, functions, and triggers related to "Appearing for other person" and "Settlements".

-- 1. DROP TABLES
DROP TABLE IF EXISTS public.shared_transaction_requests CASCADE;
DROP TABLE IF EXISTS public.settlement_requests CASCADE;

-- 2. DROP TRIGGERS
DROP TRIGGER IF EXISTS on_shared_request_accepted ON shared_transaction_requests;
DROP TRIGGER IF EXISTS force_auto_accept_linked_members ON shared_transaction_requests;
DROP TRIGGER IF EXISTS on_transaction_update_sync ON transactions;
DROP TRIGGER IF EXISTS on_transaction_soft_delete_sync ON transactions;

-- 3. DROP FUNCTIONS (RPCs & Trigger Functions)
DROP FUNCTION IF EXISTS get_shared_requests_v3();
DROP FUNCTION IF EXISTS get_shared_requests_v2();
DROP FUNCTION IF EXISTS respond_to_shared_request(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS resend_shared_request(UUID, UUID);
DROP FUNCTION IF EXISTS create_settlement(UUID, UUID, NUMERIC, TEXT);
DROP FUNCTION IF EXISTS respond_to_settlement(UUID, TEXT);
DROP FUNCTION IF EXISTS handle_shared_transaction_mirror();
DROP FUNCTION IF EXISTS enforce_auto_accept_for_linked();
DROP FUNCTION IF EXISTS propagate_transaction_updates();
DROP FUNCTION IF EXISTS propagate_transaction_deletes();
DROP FUNCTION IF EXISTS sync_shared_transaction(UUID, NUMERIC, TEXT, DATE, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS sync_delete_transaction(UUID);

-- 4. CLEANUP (Optional)
-- We keep 'linked_transaction_id' column in transactions to avoid locking/rewriting the large table unless necessary.
-- It will just be null for future transactions.
