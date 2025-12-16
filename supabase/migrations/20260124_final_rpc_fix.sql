-- ==============================================================================
-- FINAL RPC FIX & SETTLEMENT REVERSAL LOGIC
-- DATA: 2026-01-24
-- OBJ: 1. Corrigir tipos '::text' em RPCs críticas.
--      2. Relaxar regra de imutabilidade do Ledger.
--      3. Implementar Lógica de Reversão Automática de Pagamentos (Splits).
-- ==============================================================================

BEGIN;

-- 1. SCHEMA UPDATE: LINK PAYMENT TO SPLIT
-- ------------------------------------------------------------------------------
-- Adiciona rastreamento de qual transação pagou o split.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_splits' AND column_name = 'payment_transaction_id') THEN
        ALTER TABLE public.transaction_splits ADD COLUMN payment_transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL;
    END IF;
END $$;


-- 2. TRIGGER: AUTO REVERT SPLIT
-- ------------------------------------------------------------------------------
-- Se a transação de pagamento for deletada, o FK vira NULL (ON DELETE SET NULL).
-- Este trigger detecta isso e reabre o Split automaticamente.

CREATE OR REPLACE FUNCTION public.handle_settlement_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Se havia um pagamento vinculado e agora não há mais (foi deletado), reverte status.
    IF (OLD.payment_transaction_id IS NOT NULL AND NEW.payment_transaction_id IS NULL) THEN
        NEW.status := 'OPEN';
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_auto_revert_settlement ON public.transaction_splits;
CREATE TRIGGER trg_auto_revert_settlement
    BEFORE UPDATE ON public.transaction_splits
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_settlement_deletion();


-- 3. FIX RPC: SETTLE SPLIT (With Link)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.settle_split(
    p_split_id UUID,
    p_payment_account_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_split RECORD;
    v_transaction_id UUID;
    v_description TEXT;
BEGIN
    -- Busca e Bloqueia Split
    SELECT s.*, t.description as original_desc, t.user_id as payer_user_id 
    INTO v_split
    FROM public.transaction_splits s
    JOIN public.transactions t ON t.id = s.transaction_id
    WHERE s.id = p_split_id
    FOR UPDATE OF s;

    -- Validações
    IF (v_split IS NULL) THEN RAISE EXCEPTION 'Split not found.'; END IF;
    IF (v_split.status != 'OPEN') THEN RAISE EXCEPTION 'Split is already settled or cancelled.'; END IF;
    IF (v_split.debtor_id != auth.uid()) THEN RAISE EXCEPTION 'Access Denied: You can only settle your own debts.'; END IF;

    v_description := 'Pgto Dívida: ' || v_split.original_desc;

    -- Criar Pagamento (Sem cast ::text incorreto)
    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, domain, user_id
    ) VALUES (
        v_description, v_split.assigned_amount, 'TRANSFERÊNCIA', 'Ajuste', CURRENT_DATE,
        p_payment_account_id, 
        'SHARED', auth.uid()
    ) RETURNING id INTO v_transaction_id;

    -- Atualiza Split com Link e Status
    UPDATE public.transaction_splits 
    SET status = 'SETTLED',
        payment_transaction_id = v_transaction_id
    WHERE id = p_split_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 4. FIX RPC: CREATE TRANSACTION (Correct Types)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT, -- RECEITA, DESPESA, TRANSFERÊNCIA
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    -- Extended
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    v_final_domain := COALESCE(p_domain, 'personal');

    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, destination_account_id, trip_id, 
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id 
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with, 
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END
    ) RETURNING id INTO v_new_id;
    
    PERFORM public.sync_shared_transaction(v_new_id);

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 5. FIX RPC: UPDATE TRANSACTION (Correct Types)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_transaction(
    p_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    -- Extended
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT FALSE
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    v_final_domain := COALESCE(p_domain, 'PERSONAL');

    UPDATE public.transactions SET
        description = p_description,
        amount = p_amount,
        type = p_type,
        category = p_category,
        date = p_date,
        account_id = p_account_id,
        destination_account_id = p_destination_account_id,
        trip_id = p_trip_id,
        is_shared = p_is_shared,
        domain = v_final_domain,
        is_installment = p_is_installment,
        current_installment = p_current_installment,
        total_installments = p_total_installments,
        series_id = p_series_id,
        is_recurring = p_is_recurring,
        frequency = p_frequency,
        is_settled = p_is_settled,
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 6. RELAX LEDGER IMMUTABILITY (Enable Updates/Deletes)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.prevent_ledger_tampering()
RETURNS TRIGGER AS $$
BEGIN
    -- Permitir modificações do sistema (WARN instead of BLOCK)
    IF (TG_OP = 'DELETE') THEN
        RETURN OLD; 
    ELSIF (TG_OP = 'UPDATE') THEN
        RETURN NEW;
    END IF;
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

COMMIT;
