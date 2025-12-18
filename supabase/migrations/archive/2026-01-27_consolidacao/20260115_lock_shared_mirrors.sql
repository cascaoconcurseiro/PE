-- 20260115_lock_shared_mirrors.sql

-- PURPOSE: Prevent recipients (Mirrors) from editing or deleting shared transactions.
-- RULE: If 'source_transaction_id' IS NOT NULL, the row is effectively READ-ONLY for the user.
-- EXCEPTION: 'is_settled' (Payment Status) MIGHT need to be updateable? 
--    - Analysis: Usually 'is_settled' is updated by a separate flow or by the user marking as paid?
--    - If we block UPDATE globally, they can't mark as paid.
--    - REFINEMENT: We should block modification of CORE fields (amount, description, date). 
--    - Payment status ('is_settled') SHOULD probably be allowed if the Recipient pays it?
--    - Or maybe 'is_settled' is handled by the Settlement System?
--    - For safety, let's block CORE fields.

BEGIN;

CREATE OR REPLACE FUNCTION public.enforce_shared_mirror_lock()
RETURNS TRIGGER AS $$
BEGIN
    -- Context: This runs on UPDATE or DELETE.
    -- Condition: The row is a "Mirror" (System Created Copy) because it has a Source.
    IF OLD.source_transaction_id IS NOT NULL THEN
        
        -- CASE 1: DELETE ATTEMPT
        IF (TG_OP = 'DELETE') THEN
            -- Check if this is a cascade action? 
            -- (Hard to detect perfectly in PLPGSQL without using internal flags)
            -- However, our schema says 'ON DELETE SET NULL' for source_transaction_id.
            -- So Parent Deletion -> Sets Child Source to NULL.
            -- Thus, if source_transaction_id IS NOT NULL, the Parent implicitly STILL EXISTS (or was just set).
            -- Therefore, if User tries to DELETE this row, they are trying to delete a connected child.
            -- BLOCK IT.
            RAISE EXCEPTION 'PERMISSION_DENIED: Esta transação é compartilhada. Apenas quem criou pode excluí-la.';
        END IF;

        -- CASE 2: UPDATE ATTEMPT
        IF (TG_OP = 'UPDATE') THEN
            -- We Only want to block changes to the "Contract" (What, When, How Much).
            -- We might allow changing 'category' (local preference?) or 'is_settled'?
            -- Let's be strict based on user request: "Só o dono... pode alterar".
            
            -- Detect if critical fields are changing
            IF (NEW.amount != OLD.amount) OR 
               (NEW.date != OLD.date) OR 
               (NEW.description != OLD.description) OR
               (NEW.type != OLD.type) THEN
                
                RAISE EXCEPTION 'PERMISSION_DENIED: Esta transação é compartilhada. Apenas quem criou pode alterá-la.';
            END IF;
            
            -- If simply updating 'updated_at' or internal flags, we might allow.
        END IF;

    END IF;

    -- Return logic
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
DROP TRIGGER IF EXISTS trg_lock_shared_mirrors ON public.transactions;

CREATE TRIGGER trg_lock_shared_mirrors
BEFORE UPDATE OR DELETE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.enforce_shared_mirror_lock();

COMMIT;
