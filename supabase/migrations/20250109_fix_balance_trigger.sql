
-- 1. DROP old/broken triggers if any (cleanup)
DROP TRIGGER IF EXISTS tr_update_account_balance ON transactions;
DROP FUNCTION IF EXISTS update_account_balance();
DROP FUNCTION IF EXISTS update_account_balance_v2();
DROP FUNCTION IF EXISTS update_account_balance_v3();

-- 2. CREATE FUNCTION to Calculate Balance Delta
CREATE OR REPLACE FUNCTION update_account_balance_v4()
RETURNS TRIGGER AS $$
DECLARE
    v_diff numeric;
    v_dest_diff numeric;
BEGIN
    -- HANDLE INSERTS
    IF (TG_OP = 'INSERT') THEN
        -- Main Account Logic
        IF NEW.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'TRANSFERÊNCIA' THEN
            -- Source: Debit
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
            -- Destination: Credit (if exists)
            IF NEW.destination_account_id IS NOT NULL THEN
                 UPDATE accounts SET balance = balance + NEW.amount WHERE id::text = NEW.destination_account_id::text;
            END IF;
        END IF;
        RETURN NEW;

    -- HANDLE DELETES
    ELSIF (TG_OP = 'DELETE') THEN
        -- Reverse Logic
        IF OLD.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
            IF OLD.destination_account_id IS NOT NULL THEN
                 UPDATE accounts SET balance = balance - OLD.amount WHERE id::text = OLD.destination_account_id::text;
            END IF;
        END IF;
        RETURN OLD;

    -- HANDLE UPDATES (The most complex part)
    ELSIF (TG_OP = 'UPDATE') THEN
        -- 1. Reverse OLD
        IF OLD.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance - OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
        ELSIF OLD.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance + OLD.amount WHERE id::text = OLD.account_id::text;
            IF OLD.destination_account_id IS NOT NULL THEN
                 UPDATE accounts SET balance = balance - OLD.amount WHERE id::text = OLD.destination_account_id::text;
            END IF;
        END IF;

        -- 2. Apply NEW
        IF NEW.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance + NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
        ELSIF NEW.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance - NEW.amount WHERE id::text = NEW.account_id::text;
            IF NEW.destination_account_id IS NOT NULL THEN
                 UPDATE accounts SET balance = balance + NEW.amount WHERE id::text = NEW.destination_account_id::text;
            END IF;
        END IF;
        
        RETURN NEW;
    END IF;
    
    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CREATE TRIGGER
CREATE TRIGGER tr_update_account_balance_v4
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION update_account_balance_v4();

-- 4. RECALCULATE ALL BALANCES (Migration)
-- Reset balances to initial_balance first (or 0 if null)
UPDATE accounts SET balance = COALESCE(initial_balance, 0);

-- Apply all existing transactions
DO $$
DECLARE
    r record;
BEGIN
    FOR r IN SELECT * FROM transactions WHERE deleted = false ORDER BY date ASC LOOP
        -- Simulate Insert Logic for Recalculation
        IF r.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance + r.amount WHERE id::text = r.account_id::text;
        ELSIF r.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance - r.amount WHERE id::text = r.account_id::text;
        ELSIF r.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance - r.amount WHERE id::text = r.account_id::text;
            IF r.destination_account_id IS NOT NULL THEN
                 UPDATE accounts SET balance = balance + r.amount WHERE id::text = r.destination_account_id::text;
            END IF;
        END IF;
    END LOOP;
END;
$$;
