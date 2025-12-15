-- ==============================================================================
-- MIGRATION: NUCLEAR WIPE ALL (GLOBAL RESET)
-- DATE: 2025-12-15
-- DESCRIPTION: DELETES ALL DATA from ALL application tables.
--              Does NOT delete users from Auth, but clears ALL their data.
-- ==============================================================================

DO $$
DECLARE
    count_tx INT;
BEGIN
    RAISE NOTICE '⚠️ INITIATING NUCLEAR WIPE...';

    -- 1. Truncate Transactional Tables (Cascade handles Foreign Keys)
    -- Added tables that were missing from hard_reset.sql (accounts, credit_cards, etc)
    -- We use dynamic sql or just plain truncate inside the block.
    
    -- NOTE: If any table does not exist, this block will fail. 
    -- Verify table names before running if you have a custom schema.
    
    TRUNCATE TABLE 
        public.shared_transaction_requests,
        public.settlement_requests,
        public.user_notifications,
        public.transactions, 
        public.trips,
        public.family_members,
        public.accounts,
        public.credit_cards
    RESTART IDENTITY CASCADE;

    -- Optional tables (comment out if they don't exist)
    -- TRUNCATE TABLE public.goals RESTART IDENTITY CASCADE;
    -- TRUNCATE TABLE public.budgets RESTART IDENTITY CASCADE;

    -- 2. Verify Cleanup
    SELECT COUNT(*) INTO count_tx FROM public.transactions;
    RAISE NOTICE 'Nuclear Wipe Complete. Transactions remaining: %', count_tx;

END $$;
