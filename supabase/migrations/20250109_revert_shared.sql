-- REVERT SCRIPT (CORRECTED)
-- 1. DROP TABLES (CASCADE drops associated triggers automatically)
DROP TABLE IF EXISTS public.shared_transaction_requests CASCADE;
DROP TABLE IF EXISTS public.settlement_requests CASCADE;

-- 2. DROP TRIGGERS ON SURVIVING TABLES (transactions)
-- Triggers on dropped tables (shared_transaction_requests) are already gone via CASCADE above.
DROP TRIGGER IF EXISTS on_transaction_update_sync ON transactions;
DROP TRIGGER IF EXISTS on_transaction_soft_delete_sync ON transactions;

-- 3. DROP FUNCTIONS
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
