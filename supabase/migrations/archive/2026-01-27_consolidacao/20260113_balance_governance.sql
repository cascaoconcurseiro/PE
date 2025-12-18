-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║               MIGRATION: BALANCE GOVERNANCE (SCALABILITY)                    ║
-- ║               Data: 2026-01-13                                               ║
-- ║               Objetivo: Automatizar cálculo de saldo no DB.                  ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- 1. DROP OLD TRIGGERS (IF ANY) TO AVOID CONFLICTS
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.transactions;
DROP FUNCTION IF EXISTS public.fn_update_account_balance();

-- 2. CREATE THE BALANCE UPDATE FUNCTION
CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
    v_diff_amount NUMERIC;
    v_diff_dest_amount NUMERIC;
BEGIN
    -- =========================================================================
    -- LOGIC:
    -- 1. DELETE: Reverse the effect of OLD transaction.
    -- 2. INSERT: Apply the effect of NEW transaction.
    -- 3. UPDATE: Reverse OLD, then Apply NEW.
    -- =========================================================================

    -- -------------------------------------------------------------------------
    -- BLOCK A: REVERSE OLD (For Update or Delete)
    -- -------------------------------------------------------------------------
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Skip logic if it was a Shared Debt (I didn't pay)
        -- Logic: If it is shared AND has a payer_id != 'me', it logicially didn't affect my wallet balance.
        -- Assumption: If record exists on my 'transactions' table but payer is not me, it's a debt record.
        IF (OLD.is_shared IS TRUE AND OLD.payer_id IS NOT NULL AND OLD.payer_id != 'me' AND OLD.payer_id != OLD.user_id::text) THEN
            -- Do nothing for balance
        ELSE 
            -- REVERSE EFFECT
            IF (OLD.type = 'RECEITA') THEN
                UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id::uuid;
            ELSIF (OLD.type = 'DESPESA') THEN
                UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
            ELSIF (OLD.type = 'TRANSFERÊNCIA') THEN
                -- Reverse Source (Give money back)
                UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                -- Reverse Dest (Take money back)
                UPDATE public.accounts 
                SET balance = balance - COALESCE(OLD.destination_amount, OLD.amount) -- Use destination amount if exists (multicurrency)
                WHERE id = OLD.destination_account_id::uuid;
            END IF;
        END IF;
    END IF;

    -- -------------------------------------------------------------------------
    -- BLOCK B: APPLY NEW (For Insert or Update)
    -- -------------------------------------------------------------------------
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
         -- Skip logic if it is a Shared Debt (I didn't pay)
        IF (NEW.is_shared IS TRUE AND NEW.payer_id IS NOT NULL AND NEW.payer_id != 'me' AND NEW.payer_id != NEW.user_id::text) THEN
            -- Do nothing for balance
        ELSE
            -- APPLY EFFECT
            IF (NEW.type = 'RECEITA') THEN
                UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id::uuid;
            ELSIF (NEW.type = 'DESPESA') THEN
                UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
            ELSIF (NEW.type = 'TRANSFERÊNCIA') THEN
                -- Deduct Source
                UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                -- Add to Dest
                UPDATE public.accounts 
                SET balance = balance + COALESCE(NEW.destination_amount, NEW.amount)
                WHERE id = NEW.destination_account_id::uuid;
            END IF;
        END IF;
    END IF;

    RETURN NULL; -- After trigger, return value ignored
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE THE TRIGGER
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_update_account_balance();


-- 4. FUNCTION TO RECALCULATE EVERYTHING (BACKFILL)
-- IMPORTANT: This function must be run ONCE to sync everything.
CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void AS $$
DECLARE
    r_account RECORD;
    v_calc_balance NUMERIC;
BEGIN
    -- Loop through all accounts
    FOR r_account IN SELECT id, initial_balance, user_id FROM public.accounts LOOP
        
        -- Start with Initial Balance
        v_calc_balance := COALESCE(r_account.initial_balance, 0);

        -- 1. Add Incomes
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'RECEITA'
            AND deleted = FALSE
        );

        -- 2. Subtract Expenses (Excluding Shared Debts I didn't pay)
        v_calc_balance := v_calc_balance - (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'DESPESA'
            AND deleted = FALSE
            AND NOT (is_shared = TRUE AND payer_id IS NOT NULL AND payer_id != 'me' AND payer_id != user_id::text)
        );

        -- 3. TRANSFERS (Source - Outgoing)
        v_calc_balance := v_calc_balance - (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'TRANSFERÊNCIA'
            AND deleted = FALSE
        );

        -- 4. TRANSFERS (Destination - Incoming)
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(COALESCE(destination_amount, amount)), 0)
            FROM public.transactions
            WHERE destination_account_id::uuid = r_account.id 
            AND type = 'TRANSFERÊNCIA'
            AND deleted = FALSE
        );

        -- UPDATE ACCOUNT
        UPDATE public.accounts 
        SET balance = v_calc_balance 
        WHERE id = r_account.id;
        
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- 5. EXECUTE BACKFILL IMMEDIATELY
-- WARNING: This will reset balances based on current history.
SELECT public.recalculate_all_balances();
