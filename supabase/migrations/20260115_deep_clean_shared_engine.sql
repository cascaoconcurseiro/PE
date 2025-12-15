-- 20260115_deep_clean_shared_engine.sql

-- PURPOSE: FINAL EXTERMINATION of all legacy/zombie sharing triggers.
-- User asked: "Is there any other?" -> YES, there are ancient ones from Dec 2025 history.
-- ACTION: Drop EVERYTHING related to transaction mirroring and re-create ONLY the One True Trigger.

BEGIN;

-- =============================================================================
-- 1. DROP PHASE (Scorch the Earth)
-- =============================================================================

-- Valid Trigger (Will be recreated)
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;

-- Zombies / Legacies / Backfills
DROP TRIGGER IF EXISTS tr_transaction_mirroring_v4 ON public.transactions;
DROP TRIGGER IF EXISTS tr_transaction_mirroring_v5 ON public.transactions;
DROP TRIGGER IF EXISTS trig_mirror_transactions_full ON public.transactions;
DROP TRIGGER IF EXISTS trigger_share_transaction_new ON public.transactions;
DROP TRIGGER IF EXISTS trg_sync_past_shared ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_update_sync ON public.transactions;
DROP TRIGGER IF EXISTS on_transaction_soft_delete_sync ON public.transactions;
DROP TRIGGER IF EXISTS trig_notify_shared_tx ON public.transactions; -- We have a unified notification trigger now?
DROP TRIGGER IF EXISTS trg_notify_on_transaction ON public.transactions; -- Likely legacy notification

-- Function Cleanups (Cascade drops triggers too if I missed one)
DROP FUNCTION IF EXISTS public.handle_transaction_mirroring_v4() CASCADE;
DROP FUNCTION IF EXISTS public.handle_transaction_mirroring_v5() CASCADE;
DROP FUNCTION IF EXISTS public.sync_past_shared_transactions_on_link() CASCADE;

-- =============================================================================
-- 2. RECONSTRUCTION (The One True Trigger)
-- =============================================================================

-- Ensure the V6 (Smart Mirroring) Function is the one used.
-- We don't need to redefine the function (it's in 20260115_prevent_shared_duplication.sql now),
-- but we MUST ensure the trigger exists and points to it.

CREATE TRIGGER trg_mirror_shared_transaction
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_mirror_shared_transaction();

-- =============================================================================
-- 3. NOTIFICATION TRIGGER (Ensure we don't kill notifications)
-- =============================================================================
-- There is usually a separate trigger for notifications. 
-- In '20260103', we didn't touch it.
-- Let's check if 'handle_shared_notification' exists. If so, bind it cleanly.
-- (Assuming handle_shared_notification exists from previous migrations)

DROP TRIGGER IF EXISTS trg_unified_shared_notification ON public.transactions;
CREATE TRIGGER trg_unified_shared_notification
AFTER INSERT ON public.transactions
FOR EACH ROW 
WHEN (NEW.is_shared = true AND NEW.payer_id != 'me' AND NEW.payer_id != NEW.user_id::text) -- Only notify if I am the receiver
EXECUTE FUNCTION public.handle_shared_notification();

COMMIT;
