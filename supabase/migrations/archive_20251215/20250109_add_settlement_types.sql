-- Add 'type' column to settlement_requests to distinguish between 
-- "I paid you" (PAYMENT) and "Pay me" (CHARGE)

ALTER TABLE public.settlement_requests 
ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'PAYMENT' CHECK (type IN ('PAYMENT', 'CHARGE'));

-- Update Policies?
-- Existing policies rely on payer_id/receiver_id.
-- "Users can create..." (auth = payer_id).
-- If I create a CHARGE, I am the RECEIVER (requesting money), but I insert a row where Payer=Target.
-- So I (auth) != Payer (Target).
-- I need to update the INSERT policy to allow creating if I am the Receiver (Charging) OR Payer (Paying).

DROP POLICY IF EXISTS "Users can create settlement requests" ON public.settlement_requests;
CREATE POLICY "Users can create settlement requests" ON public.settlement_requests 
FOR INSERT WITH CHECK (
    auth.uid() = payer_id OR auth.uid() = receiver_id
);

-- "Payer can delete pending" -> If I charged someone (Receiver), I should be able to cancel it.
DROP POLICY IF EXISTS "Users can delete pending requests" ON public.settlement_requests;
-- Rename/Replace policy
CREATE POLICY "Users can delete own pending requests" ON public.settlement_requests
FOR DELETE USING (
    (auth.uid() = payer_id AND type = 'PAYMENT' AND status = 'PENDING') OR 
    (auth.uid() = receiver_id AND type = 'CHARGE' AND status = 'PENDING')
);
-- Basically: Creator can delete.
-- Payment: Creator is Payer. Charge: Creator is Receiver.

-- Receiver can update status?
-- Payment: Receiver (You) updates status to Completed. Correct.
-- Charge: Payer (You) updates status to Completed (Paid). Correct.
-- So existing update policy might work if it covers both IDs?
-- Current: "Receiver can update status" USING (auth.uid() = receiver_id).
-- We need to allow Payer to update too (for Charges).

DROP POLICY IF EXISTS "Receiver can update status" ON public.settlement_requests;
CREATE POLICY "Participants can update status" ON public.settlement_requests
FOR UPDATE USING (
    auth.uid() = receiver_id OR auth.uid() = payer_id
);
