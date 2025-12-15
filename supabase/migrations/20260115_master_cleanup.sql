-- 20260115_master_cleanup.sql

-- PURPOSE: System-wide cleanup of legacy/zombie database objects.
-- SCOPE: Transactions, Accounts, Trips, Notifications, Auth.
-- RISK: Managed Use of DROP IF EXISTS and CASCADE.

BEGIN;

-- =============================================================================
-- DOMAIN 1: SHARED ENGINE & MIRRORING (Double-Tap)
-- =============================================================================
DROP TRIGGER IF EXISTS tr_transaction_mirroring_v4 ON public.transactions;
DROP TRIGGER IF EXISTS tr_transaction_mirroring_v5 ON public.transactions;
DROP TRIGGER IF EXISTS trig_mirror_transactions_full ON public.transactions;
DROP TRIGGER IF EXISTS trigger_share_transaction_new ON public.transactions;
DROP TRIGGER IF EXISTS trg_sync_past_shared ON public.transactions;
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction_v5 ON public.transactions;

DROP FUNCTION IF EXISTS public.handle_transaction_mirroring_v4() CASCADE;
DROP FUNCTION IF EXISTS public.handle_transaction_mirroring_v5() CASCADE;
DROP FUNCTION IF EXISTS public.sync_past_shared_transactions_on_link() CASCADE;

-- =============================================================================
-- DOMAIN 2: TRIPS (Legacy Sharing Logic)
-- =============================================================================
-- V5 Logic was renamed/refactored.
DROP TRIGGER IF EXISTS on_trip_change_v5 ON public.trips;
DROP FUNCTION IF EXISTS public.handle_trip_sharing_v5() CASCADE;

-- Legacy Trip Cascades (Replaced by `fn_smart_factory_reset` or standard FKs)
DROP TRIGGER IF EXISTS on_trip_delete_cascade ON public.trips;
DROP FUNCTION IF EXISTS public.delete_trip_cascade() CASCADE;

-- =============================================================================
-- DOMAIN 3: ACCOUNT BALANCE (Legacy Logic)
-- =============================================================================
-- The current standard is 'trg_update_account_balance' -> 'fn_update_account_balance'
-- We must kill v4 and others.

DROP TRIGGER IF EXISTS tr_update_account_balance_v4 ON public.transactions;
DROP FUNCTION IF EXISTS public.update_account_balance_v4() CASCADE;

DROP FUNCTION IF EXISTS public.update_account_balance() CASCADE; -- Potentially ambiguous old name

-- =============================================================================
-- DOMAIN 4: NOTIFICATIONS (Legacy Triggers)
-- =============================================================================
-- We consolidated to 'trg_unified_shared_notification'.

DROP TRIGGER IF EXISTS trig_notify_shared_tx ON public.transactions;
DROP TRIGGER IF EXISTS trg_notify_on_transaction ON public.transactions;
DROP TRIGGER IF EXISTS trig_notify_trip_invite ON public.family_members;
DROP TRIGGER IF EXISTS trg_notify_on_invite ON public.family_members;

DROP FUNCTION IF EXISTS public.notify_new_shared_transaction() CASCADE;
DROP FUNCTION IF EXISTS public.notify_trip_invite() CASCADE;

-- =============================================================================
-- DOMAIN 5: AUTH & MEMBERS (Legacy Auto-Connect & Requests)
-- =============================================================================
-- We are cleaning up the "Request-Response" flow if it conflicts with "Direct Mirroring".
-- 2026 Logic prefers direct insertion or specific RPCs.
-- The old 'shared_transaction_requests' triggers are likely obsolete or causing double-fires.

DROP TRIGGER IF EXISTS force_auto_accept_linked_members ON public.shared_transaction_requests;
DROP TRIGGER IF EXISTS on_shared_request_accepted ON public.shared_transaction_requests;
DROP FUNCTION IF EXISTS public.enforce_auto_accept_for_linked() CASCADE;
DROP FUNCTION IF EXISTS public.handle_shared_transaction_mirror() CASCADE; -- Mirrors are handled by 'transactions' trigger now.

-- Legacy Auto-Connect on Family Members
DROP TRIGGER IF EXISTS trig_auto_connect_members ON public.family_members;
DROP FUNCTION IF EXISTS public.handle_auto_connection_lifecycle() CASCADE;

-- =============================================================================
-- DOMAIN 6: UTILS & RPCS
-- =============================================================================
-- 'reset_own_data()' is the old reset. We now use 'fn_smart_factory_reset()'
DROP FUNCTION IF EXISTS public.reset_own_data() CASCADE;

-- Clean up any 'updated_at' duplicates if they exist (standardize on one)
-- Usually these are fine, but let's drop specific old ones if we are sure.
-- (Keeping generic 'update_updated_at_column' is fine, but dropping specific named triggers if they duplicate)
-- DROP TRIGGER IF EXISTS update_accounts_updated_at ON public.accounts; -- Risky if no replacement. Keeping for safety.

COMMIT;
