-- ==============================================================================
-- MIGRATION: REFACTOR SPLITS TO RELATIONAL (2026-01-02)
-- DESCRIPTION: Moves shared expense data from JSONB to 'transaction_splits' table.
-- ==============================================================================

BEGIN;

-- 1. Create the Table
CREATE TABLE IF NOT EXISTS public.transaction_splits (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    transaction_id UUID REFERENCES public.transactions(id) ON DELETE CASCADE NOT NULL,
    member_id UUID, -- Keep member_id for traceability to family_members table
    user_id UUID REFERENCES auth.users(id), -- Resolved Real User ID (for mirroring)
    assigned_amount NUMERIC NOT NULL,
    percentage NUMERIC,
    is_settled BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.transaction_splits ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see splits of their own transactions OR splits where they are the target
DROP POLICY IF EXISTS "access_own_splits" ON public.transaction_splits;
CREATE POLICY "access_own_splits" ON public.transaction_splits 
    FOR ALL USING (
        EXISTS (SELECT 1 FROM transactions t WHERE t.id = transaction_splits.transaction_id AND t.user_id = auth.uid()) 
        OR 
        user_id = auth.uid()
    );

-- 2. Backfill Data (JSONB -> Table)
-- We parse the 'shared_with' JSON array and insert into the table.
-- shared_with structure: [{ "memberId": "uuid", "assignedAmount": 100, "isSettled": false }]
INSERT INTO public.transaction_splits (transaction_id, member_id, user_id, assigned_amount, is_settled)
SELECT 
    t.id,
    (split->>'memberId')::UUID,
    fm.linked_user_id, -- Resolve the Real User ID immediately via FamilyMembers
    (split->>'assignedAmount')::NUMERIC,
    COALESCE((split->>'isSettled')::BOOLEAN, false)
FROM 
    public.transactions t
CROSS JOIN LATERAL 
    jsonb_array_elements(t.shared_with) as split
LEFT JOIN 
    public.family_members fm ON fm.id = (split->>'memberId')::UUID
WHERE 
    t.shared_with IS NOT NULL 
    AND jsonb_array_length(t.shared_with) > 0
ON CONFLICT DO NOTHING;

-- 3. Trigger to Keep Sync (Bridge Mode)
-- When a Transaction is inserted/updated with JSONB, we update the Table.
CREATE OR REPLACE FUNCTION sync_shared_json_to_table()
RETURNS TRIGGER AS $$
DECLARE
    split JSONB;
    resolved_user_id UUID;
BEGIN
    -- Only run if shared_with changed or is new
    IF (TG_OP = 'INSERT') OR (TG_OP = 'UPDATE' AND NEW.shared_with IS DISTINCT FROM OLD.shared_with) THEN
        
        -- Clear old splits for this transaction (Simple Replace Strategy)
        DELETE FROM public.transaction_splits WHERE transaction_id = NEW.id;

        -- Insert new splits
        IF NEW.shared_with IS NOT NULL AND jsonb_array_length(NEW.shared_with) > 0 THEN
            FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
            LOOP
                -- Resolve User ID
                SELECT linked_user_id INTO resolved_user_id 
                FROM public.family_members 
                WHERE id = (split->>'memberId')::UUID;

                INSERT INTO public.transaction_splits (
                    transaction_id, member_id, user_id, assigned_amount, is_settled
                ) VALUES (
                    NEW.id,
                    (split->>'memberId')::UUID,
                    resolved_user_id,
                    (split->>'assignedAmount')::NUMERIC,
                    COALESCE((split->>'isSettled')::BOOLEAN, false)
                );
            END LOOP;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_sync_json_splits ON public.transactions;
CREATE TRIGGER trg_sync_json_splits
    AFTER INSERT OR UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION sync_shared_json_to_table();

COMMIT;
