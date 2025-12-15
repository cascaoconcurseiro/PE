-- Notifications for Shared Activities

-- 1. Notify Function
CREATE OR REPLACE FUNCTION public.handle_shared_notification()
RETURNS TRIGGER AS $$
DECLARE
    target_user_id UUID;
    related_name TEXT;
BEGIN
    -- Scenario A: Added to Family Group
    IF TG_TABLE_NAME = 'family_members' THEN
        -- Assuming 'email' matches a registered user.
        -- We need to find the user_id by email if possible, or this only works if invitation system links IDs.
        -- If family_members stores 'email', we try to find the user.
        -- (Ideally, family_members should have a 'linked_user_id' or we rely on invites)
        -- For now, let's assume valid linking logic is handled elsewhere or we skip if no ID.
        
        -- NOTE: FamilyMembers table usually belongs to ONE user (the owner).
        -- The "User being added" doesn't see this table directly unless we have a specific 'shared_access' table.
        -- Based on current schema, 'family_members' is local to a user.
        -- Real sharing happens via 'transactions' mirroring or 'trips' sharing.
        
        RETURN NEW; -- Skipping Family Member notification for now as it requires complex email lookup/auth bridging.
    END IF;

    -- Scenario B: New Shared Transaction (Debt / Credit)
    IF TG_TABLE_NAME = 'transactions' AND NEW.is_shared = true THEN
         -- Iterate through shared_with to notify participants
         -- This requires 'shared_with' to be a JSONB array of objects { memberId, ... }
         -- We need to map memberId (local family member) to a Real User ID if they are linked.
         -- If 'memberId' is just a local ID, we can't notify the other person unless we know *their* UUID.
         
         -- CRITICAL: The system relies on "Mirroring".
         -- When User A creates a tx shared with User B, the system (App or Trigger) creates a MIRROR tx for User B.
         -- WE SHOULD NOTIFY ON THE MIRROR CREATION.
         
         -- Check if this transaction was created by SOMEONE ELSE (payer_id != auth.uid())
         -- Or if it is a mirror.
         
         -- Let's try to notify if I am the target of a new transaction created by someone else.
         IF NEW.created_by != NEW.user_id THEN -- Assuming 'created_by' tracks origin, or we infer from payer_id
             -- Insert Notification
             INSERT INTO public.user_notifications (user_id, title, message, type, metadata)
             VALUES (
                NEW.user_id,
                'Nova Despesa Compartilhada',
                'Você foi incluído em uma nova despesa: ' || NEW.description,
                'TRANSACTION',
                jsonb_build_object('transaction_id', NEW.id)
             );
         END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Trigger
-- We probably need a better trigger on 'shared_transaction_requests' if that exists, or relying on the 'Mirroring' logic.
-- If the app creates "Requests", we notify on Request.
-- If the app creates direct Transactions (Mirror), we notify on Insert.

DROP TRIGGER IF EXISTS trg_shared_notification ON public.transactions;
-- CREATE TRIGGER trg_shared_notification
-- AFTER INSERT ON public.transactions
-- FOR EACH ROW
-- WHEN (NEW.is_shared = true)
-- EXECUTE FUNCTION public.handle_shared_notification();
