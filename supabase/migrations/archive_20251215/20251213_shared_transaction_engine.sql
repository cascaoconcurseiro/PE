-- 20251213_shared_transaction_engine.sql
-- MIRROR ENGINE: Automatically creates copies of shared transactions for other users.

CREATE OR REPLACE FUNCTION public.handle_mirror_shared_transaction()
RETURNS TRIGGER AS $$
DECLARE
    split JSONB;
    target_member_id UUID;
    target_user_id UUID;
    inviter_name TEXT;
BEGIN
    -- Only proceed if it is a Shared Transaction created by a user (not a system mirror)
    -- We detect "System Mirror" by checking if 'is_mirror' metadata exists (if using JSONB)
    -- Or simpler: If I am creating a transaction for MYSELF (auth.uid = user_id) and it is SHARED.
    
    IF (TG_OP = 'INSERT') AND (auth.uid() = NEW.user_id) AND (NEW.is_shared = true) AND (NEW.shared_with IS NOT NULL) AND (jsonb_array_length(NEW.shared_with) > 0) THEN
        
        -- Get Inviter Name for notification context
        SELECT raw_user_meta_data->>'name' INTO inviter_name FROM auth.users WHERE id = auth.uid();
        
        -- Iterate over splits
        FOR split IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            target_member_id := (split->>'memberId')::UUID;
            
            -- Resolve Linked User ID from Family Members table
            SELECT linked_user_id INTO target_user_id 
            FROM public.family_members 
            WHERE id = target_member_id;
            
            -- If linked user exists, create the mirror transaction
            IF target_user_id IS NOT NULL THEN
                INSERT INTO public.transactions (
                    user_id,
                    account_id, -- NULL for shared mirror (it's a debt/receivable, not a bank record on THEIR side yet)
                    amount,     -- Their share
                    date,
                    description,
                    category,
                    type,
                    is_shared,
                    payer_id,   -- Who paid? Me (auth.uid)
                    shared_with, -- Empty for the mirror? Or keep context? Keep empty to avoid infinite loops.
                    created_at,
                    updated_at
                ) VALUES (
                    target_user_id,
                    NULL, -- No Account ID implies "Pending Settlement" or "External"
                    (split->>'assignedAmount')::NUMERIC,
                    NEW.date,
                    NEW.description || ' (Compartilhado por ' || COALESCE(inviter_name, 'Alguém') || ')',
                    NEW.category,
                    'DESPESA', -- Always Expense for them? Or depends? Assume Expense for now.
                    true,
                    auth.uid(), -- Payer is ME
                    '[]'::jsonb, -- No further splits
                    NOW(),
                    NOW()
                );
                
                -- Notification is handled by 'handle_shared_notification' trigger which detects (auth.uid <> NEW.user_id)
            END IF;
        END LOOP;
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Apply Trigger
DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
CREATE TRIGGER trg_mirror_shared_transaction
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_mirror_shared_transaction();
