-- 1. Add linked_transaction_id to transactions table
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS linked_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;

-- 2. Function to handle ACCEPTED shared requests (Create Copy)
CREATE OR REPLACE FUNCTION public.handle_shared_request_acceptance()
RETURNS TRIGGER AS $$
DECLARE
    original_tx public.transactions%ROWTYPE;
BEGIN
    -- Only run if status changed to ACCEPTED
    IF NEW.status = 'ACCEPTED' AND OLD.status != 'ACCEPTED' THEN
        
        -- Fetch original transaction
        SELECT * INTO original_tx FROM public.transactions WHERE id = NEW.transaction_id;
        
        IF FOUND THEN
            -- Insert COPY for the invited user
            INSERT INTO public.transactions (
                user_id,
                description,
                amount,
                date,
                type,
                category,
                account_id, -- Will be null or need to be set by user later? For now, 'EXTERNAL' concept or NULL.
                currency,
                is_recurring,
                frequency,
                recurrence_day,
                is_installment,
                current_installment,
                total_installments,
                original_amount,
                series_id,
                is_shared,
                payer_id,
                linked_transaction_id,  -- LINK HERE
                created_at,
                updated_at
            ) VALUES (
                NEW.invited_user_id,
                original_tx.description,
                original_tx.amount, -- Full amount? Or split amount? Usually user wants full visibility, then splits. Let's copy full.
                original_tx.date,
                original_tx.type,
                original_tx.category,
                NULL, -- No account assigned yet
                original_tx.currency,
                original_tx.is_recurring,
                original_tx.frequency,
                original_tx.recurrence_day,
                original_tx.is_installment,
                original_tx.current_installment,
                original_tx.total_installments,
                original_tx.original_amount,
                original_tx.series_id, -- Keep series ID? Might cause collision if unique constraint. Usually series_id is just string.
                TRUE, -- is_shared
                original_tx.payer_id, -- Keep payer info
                NEW.transaction_id, -- The Link
                NOW(),
                NOW()
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Acceptance
DROP TRIGGER IF EXISTS on_shared_request_accepted ON public.shared_transaction_requests;
CREATE TRIGGER on_shared_request_accepted
    AFTER UPDATE ON public.shared_transaction_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_shared_request_acceptance();


-- 3. Function to propagate UPDATES from Original to Copies
CREATE OR REPLACE FUNCTION public.propagate_transaction_updates()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent infinite loops: Only propagate if this is NOT a linked transaction itself acting as original
    -- (Actually, logic is: IF this transaction has copies pointing to it, update them.)
    
    -- Check if it's a "Local Edit" on a copy (has linked_id). If so, DO NOT propagate to original (User decided strict ownership).
    IF NEW.linked_transaction_id IS NOT NULL THEN
        RETURN NEW; 
    END IF;

    -- Update all transactions that link to this one
    UPDATE public.transactions
    SET 
        description = NEW.description,
        amount = NEW.amount,
        date = NEW.date,
        type = NEW.type,
        category = NEW.category,
        currency = NEW.currency,
        -- specific fields to sync
        updated_at = NOW()
    WHERE linked_transaction_id = NEW.id
    AND deleted = FALSE; -- Only update active copies

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Updates
DROP TRIGGER IF EXISTS on_transaction_update_sync ON public.transactions;
CREATE TRIGGER on_transaction_update_sync
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.propagate_transaction_updates();


-- 4. Function to propagate DELETES (Soft Delete) from Original to Copies
CREATE OR REPLACE FUNCTION public.propagate_transaction_deletes()
RETURNS TRIGGER AS $$
BEGIN
    -- Only handle Soft Deletes (update deleted=true)
    IF NEW.deleted = TRUE AND OLD.deleted = FALSE THEN
        -- Mark copies as deleted too
        UPDATE public.transactions
        SET deleted = TRUE, updated_at = NOW()
        WHERE linked_transaction_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for Deletes (hooked to UPDATE because it's soft delete)
DROP TRIGGER IF EXISTS on_transaction_soft_delete_sync ON public.transactions;
CREATE TRIGGER on_transaction_soft_delete_sync
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.propagate_transaction_deletes();
