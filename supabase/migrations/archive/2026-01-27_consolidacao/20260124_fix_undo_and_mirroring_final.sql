-- ==============================================================================
-- FIX UNDO SETTLEMENT & RE-APPLY TRIP MIRRORING
-- DATA: 2026-01-24
-- OBJ: 1. Corrigir 'update_transaction' para aceitar alterações em compartilhamentos (Desfazer).
--      2. Reaplicar lógica de Espelhamento de Viagem (garantia).
-- ==============================================================================

BEGIN;

-- 1. RE-APPLY TRIP MIRRORING LOGIC (For Safety)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_shared_trip(p_trip_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_trip_rec RECORD;
    v_participant JSONB;
    v_target_member_id UUID;
    v_target_user_id UUID;
    v_inviter_name TEXT;
BEGIN
    SELECT * INTO v_trip_rec FROM public.trips WHERE id = p_trip_id;
    IF v_trip_rec.participants IS NOT NULL AND jsonb_array_length(v_trip_rec.participants) > 0 THEN
        SELECT raw_user_meta_data->>'name' INTO v_inviter_name FROM auth.users WHERE id = v_trip_rec.user_id;
        
        FOR v_participant IN SELECT * FROM jsonb_array_elements(v_trip_rec.participants)
        LOOP
            IF (jsonb_typeof(v_participant) = 'string') THEN
                 v_target_member_id := (v_participant#>>'{}')::UUID;
            ELSE
                 v_target_member_id := (v_participant->>'id')::UUID;
            END IF;

            SELECT linked_user_id INTO v_target_user_id FROM public.family_members WHERE id = v_target_member_id;

            IF v_target_user_id IS NOT NULL AND v_target_user_id != v_trip_rec.user_id THEN
                IF NOT EXISTS (SELECT 1 FROM public.trips WHERE source_trip_id = v_trip_rec.id AND user_id = v_target_user_id) THEN
                    INSERT INTO public.trips (
                        user_id, name, description, start_date, end_date, budget, currency, 
                        source_trip_id, status, created_at, updated_at
                    ) VALUES (
                        v_target_user_id,
                        v_trip_rec.name || ' (Convite)', 
                        v_trip_rec.description,
                        v_trip_rec.start_date,
                        v_trip_rec.end_date,
                        v_trip_rec.budget,
                        v_trip_rec.currency,
                        v_trip_rec.id, 
                        v_trip_rec.status,
                        NOW(), NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;


-- 2. UPDATE TRANSACTION (ACEITAR SHARED_WITH E SINCRONIZAR SPLITS)
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
    p_is_settled BOOLEAN DEFAULT FALSE,
    p_shared_with JSONB DEFAULT NULL -- NOVO: Aceita atualização de splits!
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
    v_split_json JSONB;
    v_member_id UUID;
    v_split_is_settled BOOLEAN;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    v_final_domain := COALESCE(p_domain, 'PERSONAL');

    -- Atualiza Transação (Incluindo shared_with se fornecido)
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
        shared_with = COALESCE(p_shared_with, shared_with), -- Atualiza JSON
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
    
    -- SINCRONIZA STATUS DOS SPLITS (Correção para "Desfazer")
    IF p_shared_with IS NOT NULL THEN
        FOR v_split_json IN SELECT * FROM jsonb_array_elements(p_shared_with)
        LOOP
            -- Tenta extrair ID do membro
            v_member_id := (v_split_json->>'memberId')::UUID;
            v_split_is_settled := COALESCE((v_split_json->>'isSettled')::BOOLEAN, FALSE);
            
            -- Atualiza Tabela de Splits Real
            -- Se v_is_settled = FALSE -> Status OPEN.
            -- Se v_is_settled = TRUE -> Status SETTLED.
            
            UPDATE public.transaction_splits
            SET status = CASE WHEN v_split_is_settled THEN 'SETTLED' ELSE 'OPEN' END,
                -- Se reabrir, remove o link de pagamento para evitar inconsistência
                payment_transaction_id = CASE WHEN v_split_is_settled THEN payment_transaction_id ELSE NULL END
            WHERE transaction_id = p_id 
            -- Busca o split correto pelo member_id (que está no JSON)
            AND (
                -- Opção 1: O split tem debtor_id linkado ao membro
                debtor_id = (SELECT linked_user_id FROM public.family_members WHERE id = v_member_id)
                OR 
                -- Opção 2: (Fallback) Se a lógica anterior usava member_id direto em alguma coluna
                transaction_id = p_id -- Refinar busca se possível, mas debtor_id é o mais seguro
            );
        END LOOP;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
