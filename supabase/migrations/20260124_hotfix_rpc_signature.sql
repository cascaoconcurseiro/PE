-- ==============================================================================
-- HOTFIX: RPC SIGNATURE MISMATCH
-- DATA: 2026-01-24
-- OBJ: Redefinir 'update_transaction' para aceitar explicitamente 'p_shared_with'.
--      O erro "Could not find the function" indica que o banco ainda está com a versão antiga.
-- ==============================================================================

BEGIN;

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
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT FALSE,
    p_shared_with JSONB DEFAULT NULL -- PARÂMETRO CRÍTICO
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
    v_split_json JSONB;
    v_member_id UUID;
    v_linked_user_id UUID;
    v_split_is_settled BOOLEAN;
BEGIN
    -- 1. Validar Acesso
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    v_final_domain := COALESCE(p_domain, 'PERSONAL');

    -- 2. Atualizar Transação
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
        shared_with = COALESCE(p_shared_with, shared_with), -- Atualiza o JSON
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;

    -- 3. Sincronizar Splits (Lógica do "Desfazer")
    IF p_shared_with IS NOT NULL THEN
        FOR v_split_json IN SELECT * FROM jsonb_array_elements(p_shared_with)
        LOOP
            v_member_id := (v_split_json->>'memberId')::UUID;
            v_split_is_settled := COALESCE((v_split_json->>'isSettled')::BOOLEAN, FALSE);
            
            -- Tenta achar o usuário linkado (debtor)
            SELECT linked_user_id INTO v_linked_user_id FROM public.family_members WHERE id = v_member_id;
            
            -- Se nao achar linked_user, tenta usar o member_id se a tabela splits usar member_id (mas ela usa debtor_id/UUID)
            -- Assumindo que o sistema de splits usa linked_user_id do family member.
            
            IF v_linked_user_id IS NOT NULL THEN
                UPDATE public.transaction_splits
                SET status = CASE WHEN v_split_is_settled THEN 'SETTLED' ELSE 'OPEN' END,
                    payment_transaction_id = CASE WHEN v_split_is_settled THEN payment_transaction_id ELSE NULL END
                WHERE transaction_id = p_id 
                AND debtor_id = v_linked_user_id;
            END IF;
        END LOOP;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
