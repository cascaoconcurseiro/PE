-- FINAL ARCHITECTURE FIX: v3
-- 1. Create v3 RPC with explicit aliases to avoid 400 Ambiguity
CREATE OR REPLACE FUNCTION get_shared_requests_v3()
RETURNS TABLE (
    id UUID,
    transaction_id UUID,
    requester_id UUID,
    status TEXT,
    created_at TIMESTAMPTZ,
    assigned_amount NUMERIC,
    tx_description TEXT,
    tx_amount NUMERIC,
    tx_currency TEXT,
    tx_date DATE,
    tx_category TEXT,
    tx_observation TEXT,
    tx_trip_id UUID,
    requester_name TEXT,
    requester_email TEXT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        str.id,
        str.transaction_id,
        str.requester_id,
        str.status,
        str.created_at,
        str.assigned_amount,
        t.description AS tx_description,
        t.amount AS tx_amount,
        t.currency AS tx_currency,
        t.date AS tx_date,
        t.category AS tx_category,
        t.observation AS tx_observation,
        t.trip_id AS tx_trip_id,
        COALESCE(up.name, 'Usuário Desconhecido') AS requester_name,
        up.email AS requester_email
    FROM 
        public.shared_transaction_requests str
    JOIN 
        public.transactions t ON str.transaction_id = t.id
    LEFT JOIN 
        public.user_profiles up ON str.requester_id = up.id
    WHERE 
        str.invited_user_id = auth.uid() 
        AND str.status = 'PENDING'
    ORDER BY str.created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION get_shared_requests_v3 TO authenticated;

-- 2. ENSURE TRIGGERS EXIST (Auto-Share)
CREATE OR REPLACE FUNCTION enforce_auto_accept_for_linked()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_is_linked BOOLEAN;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM family_members fm
        LEFT JOIN user_profiles up ON up.email = fm.email
        WHERE fm.user_id = NEW.requester_id AND (fm.linked_user_id = NEW.invited_user_id OR up.id = NEW.invited_user_id)
    ) INTO v_is_linked;
    IF v_is_linked THEN NEW.status := 'ACCEPTED'; NEW.responded_at := NOW(); END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS force_auto_accept_linked_members ON shared_transaction_requests;
CREATE TRIGGER force_auto_accept_linked_members BEFORE INSERT ON shared_transaction_requests FOR EACH ROW EXECUTE FUNCTION enforce_auto_accept_for_linked();

CREATE OR REPLACE FUNCTION handle_shared_transaction_mirror()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE v_original_tx RECORD; v_account_id UUID; v_mirror_exists BOOLEAN;
BEGIN
    IF NEW.status = 'ACCEPTED' THEN
        SELECT EXISTS (SELECT 1 FROM transactions WHERE user_id = NEW.invited_user_id AND observation LIKE '%[SYNC:' || NEW.transaction_id || ']%') INTO v_mirror_exists;
        IF v_mirror_exists THEN RETURN NEW; END IF;
        SELECT * INTO v_original_tx FROM transactions WHERE id = NEW.transaction_id;
        IF v_original_tx IS NULL THEN RETURN NEW; END IF;
        SELECT id INTO v_account_id FROM accounts WHERE user_id = NEW.invited_user_id ORDER BY updated_at DESC LIMIT 1;
        IF v_account_id IS NULL THEN RETURN NEW; END IF;
        INSERT INTO transactions (description, amount, type, date, category, account_id, user_id, is_shared, trip_id, observation, currency, exchange_rate, created_at, updated_at)
        VALUES (v_original_tx.description, COALESCE(NEW.assigned_amount, v_original_tx.amount), 'EXPENSE', v_original_tx.date, v_original_tx.category, v_account_id, NEW.invited_user_id, true, v_original_tx.trip_id, TRIM('[SYNC:' || NEW.transaction_id || '] ' || COALESCE(v_original_tx.observation, '')), v_original_tx.currency, v_original_tx.exchange_rate, NOW(), NOW());
    END IF;
    RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_shared_request_accepted ON shared_transaction_requests;
CREATE TRIGGER on_shared_request_accepted AFTER INSERT OR UPDATE OF status ON shared_transaction_requests FOR EACH ROW WHEN (NEW.status = 'ACCEPTED') EXECUTE FUNCTION handle_shared_transaction_mirror();
