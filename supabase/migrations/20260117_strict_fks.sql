-- Migration: Strict Foreign Keys
-- Date: 2026-01-17
-- Description: Converts legacy TEXT foreign keys to UUID and enforces strict references.

-- 1. Account ID
ALTER TABLE public.transactions
  ALTER COLUMN account_id TYPE UUID USING CASE WHEN account_id::text = '' THEN NULL ELSE account_id::text::uuid END;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;

ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_account 
  FOREIGN KEY (account_id) 
  REFERENCES public.accounts(id) 
  ON DELETE RESTRICT;

-- 2. Destination Account ID
ALTER TABLE public.transactions
  ALTER COLUMN destination_account_id TYPE UUID USING CASE WHEN destination_account_id::text = '' THEN NULL ELSE destination_account_id::text::uuid END;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;

ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_dest_account 
  FOREIGN KEY (destination_account_id) 
  REFERENCES public.accounts(id) 
  ON DELETE RESTRICT;

-- 3. Trip ID
ALTER TABLE public.transactions
  ALTER COLUMN trip_id TYPE UUID USING CASE WHEN trip_id::text = '' THEN NULL ELSE trip_id::text::uuid END;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_trip;

ALTER TABLE public.transactions
  ADD CONSTRAINT fk_transactions_trip 
  FOREIGN KEY (trip_id) 
  REFERENCES public.trips(id) 
  ON DELETE SET NULL;

-- Notes:
-- 'payer_id' remains TEXT because it can be 'me' or a UUID.
-- 'series_id' remains TEXT/UUID (no FK to another table, just a grouping key).
