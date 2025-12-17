-- ==============================================================================
-- HOTFIX: ADD CURRENCY TO MIRROR TRANSACTIONS
-- DATE: 2026-01-25
-- OBJ: Corrigir sync_shared_transaction para copiar o campo currency da transação original
--      Isso garante que faturas de viagem em moeda estrangeira apareçam corretamente
-- ==============================================================================

BEGIN;

-- 1. CORRIGIR FUNÇÃO sync_shared_transaction PARA INCLUIR CURRENCY
CREATE OR REPLACE FUNCTION public.sync_shared_transaction(p_tx_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tx_rec RECORD;
    v_split JSONB;
    v_target_member_id UUID;
    v_target_user_id UUID;
    v_target_trip_id UUID;
    v_inviter_name TEXT;
    v_dynamic_domain TEXT;
BEGIN
    SELECT * INTO v_tx_rec FROM public.transactions WHERE id = p_tx_id;
    
    IF (v_tx_rec.is_shared = true) AND (v_tx_rec.shared_with IS NOT NULL) AND (jsonb_array_length(v_tx_rec.shared_with) > 0) THEN
        
        -- Get Inviter Name
        SELECT raw_user_meta_data->>'name' INTO v_inviter_name FROM auth.users WHERE id = v_tx_rec.user_id;
        v_inviter_name := COALESCE(NULLIF(v_inviter_name, ''), 'Alguém');

        FOR v_split IN SELECT * FROM jsonb_array_elements(v_tx_rec.shared_with)
        LOOP
            v_target_member_id := (v_split->>'memberId')::UUID;
            SELECT linked_user_id INTO v_target_user_id FROM public.family_members WHERE id = v_target_member_id;
            
            IF v_target_user_id IS NOT NULL AND v_target_user_id != v_tx_rec.user_id THEN
                
                -- Check/Create Trip Mirror
                v_target_trip_id := NULL;
                IF v_tx_rec.trip_id IS NOT NULL THEN
                    SELECT id INTO v_target_trip_id FROM public.trips 
                    WHERE source_trip_id = v_tx_rec.trip_id AND user_id = v_target_user_id;
                    
                    IF v_target_trip_id IS NULL THEN
                         PERFORM public.sync_shared_trip(v_tx_rec.trip_id);
                         SELECT id INTO v_target_trip_id FROM public.trips 
                         WHERE source_trip_id = v_tx_rec.trip_id AND user_id = v_target_user_id;
                    END IF;
                END IF;

                -- DYNAMIC DOMAIN: TRAVEL if trip_id, SHARED otherwise
                v_dynamic_domain := CASE WHEN v_target_trip_id IS NOT NULL THEN 'TRAVEL' ELSE 'SHARED' END;

                -- Insert Mirror Transaction (NOW WITH CURRENCY!)
                IF NOT EXISTS (
                    SELECT 1 FROM public.transactions 
                    WHERE user_id = v_target_user_id 
                    AND payer_id = v_tx_rec.user_id::text 
                    AND date = v_tx_rec.date
                    AND amount = (v_split->>'assignedAmount')::NUMERIC
                    AND type IN ('DESPESA', 'EXPENSE') 
                ) THEN
                    INSERT INTO public.transactions (
                        user_id, 
                        amount, 
                        date, 
                        description, 
                        category, 
                        type,
                        domain,
                        is_shared, 
                        payer_id, 
                        shared_with, 
                        trip_id,
                        currency,  -- FIX: Added currency field
                        exchange_rate,  -- FIX: Added exchange_rate field
                        created_at, 
                        updated_at
                    ) VALUES (
                        v_target_user_id, 
                        (v_split->>'assignedAmount')::NUMERIC, 
                        v_tx_rec.date, 
                        v_tx_rec.description || ' (' || v_inviter_name || ')', 
                        v_tx_rec.category,
                        'DESPESA',
                        v_dynamic_domain,
                        true, 
                        v_tx_rec.user_id::text, 
                        '[]'::jsonb,
                        v_target_trip_id,
                        v_tx_rec.currency,  -- FIX: Copy currency from original
                        v_tx_rec.exchange_rate,  -- FIX: Copy exchange_rate from original
                        NOW(), 
                        NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- 2. CORRIGIR TRANSAÇÕES ESPELHADAS EXISTENTES QUE ESTÃO SEM CURRENCY
-- Atualiza transações espelhadas (com payer_id) para herdar a moeda da viagem associada
UPDATE public.transactions t
SET currency = trip.currency
FROM public.trips trip
WHERE t.trip_id = trip.id
  AND t.payer_id IS NOT NULL
  AND (t.currency IS NULL OR t.currency = 'BRL')
  AND trip.currency IS NOT NULL
  AND trip.currency != 'BRL';

COMMIT;
