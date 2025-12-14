-- MIGRATION: HARD RESET (CLEAN SLATE)
-- DATE: 2025-01-09
-- DESCRIPTION: Truncates all transactional data tables to reset the system state.
--              Do NOT run this if you want to keep data!

BEGIN;

-- 1. Truncate Tables (Cascade handles dependencies)
TRUNCATE TABLE 
    public.shared_transaction_requests,
    public.user_notifications,
    public.ledger_entries, 
    public.transactions, 
    public.trips 
CASCADE;

-- 2. Optional: Reset sequences if IDs were Serial (Supabase uses UUIDs usually, so no need for sequence reset)

COMMIT;
