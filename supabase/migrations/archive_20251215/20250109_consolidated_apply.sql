-- ============================================================================
-- CONSOLIDATED MIGRATION SCRIPT (2025-01-09)
-- Includes: Settlement Requests Table + Sync RPCs
-- ============================================================================

-- 1. SETTLEMENT REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.settlement_requests (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    payer_id UUID NOT NULL REFERENCES auth.users(id),
    receiver_id UUID NOT NULL REFERENCES auth.users(id),
    amount NUMERIC NOT NULL,
    date DATE NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'COMPLETED', 'REJECTED')),
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

ALTER TABLE public.settlement_requests ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlement_requests' AND policyname = 'Users can view their settlements') THEN
        CREATE POLICY "Users can view their settlements" ON public.settlement_requests FOR SELECT USING (auth.uid() = payer_id OR auth.uid() = receiver_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlement_requests' AND policyname = 'Users can create settlement requests') THEN
        CREATE POLICY "Users can create settlement requests" ON public.settlement_requests FOR INSERT WITH CHECK (auth.uid() = payer_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlement_requests' AND policyname = 'Receiver can update status') THEN
        CREATE POLICY "Receiver can update status" ON public.settlement_requests FOR UPDATE USING (auth.uid() = receiver_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'settlement_requests' AND policyname = 'Payer can delete pending requests') THEN
        CREATE POLICY "Payer can delete pending requests" ON public.settlement_requests FOR DELETE USING (auth.uid() = payer_id AND status = 'PENDING');
    END IF;
END
$$;

GRANT ALL ON public.settlement_requests TO authenticated;
GRANT ALL ON public.settlement_requests TO service_role;


-- 2. SYNC RPCs (SECURITY DEFINER)

-- Function to handle syncing updates across users
CREATE OR REPLACE FUNCTION sync_shared_transaction(
  original_id UUID, 
  new_amount NUMERIC, 
  new_description TEXT, 
  new_date DATE,
  new_type TEXT,
  new_category TEXT,
  new_currency TEXT
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.transactions
  SET 
    -- We update metadata only as per design decision, BUT we are passing amount here.
    -- The frontend passes 0 or the proper amount. The RPC logic in manual_migration said:
    -- "description = new_description, date = new_date..."
    -- Let's stick to the manual_migration.sql logic exactly?
    -- manual_migration.sql lines 39-47: 
    -- description = new_description, date = new_date, type = new_type, category = new_category, currency = new_currency
    -- AND NOT AMOUNT.
    
    description = new_description,
    date = new_date,
    type = new_type,
    category = new_category,
    currency = new_currency,
    updated_at = NOW()
  WHERE 
    observation ILIKE '%[SYNC:' || original_id || ']%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle deleting shared copies
CREATE OR REPLACE FUNCTION sync_delete_transaction(original_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.transactions
  SET deleted = TRUE, updated_at = NOW()
  WHERE observation ILIKE '%[SYNC:' || original_id || ']%';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. LINKED TRANSACTION COLUMN (Optional but good for future)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;
