-- ==============================================================================
-- HOTFIX: RESYNC WITH PT-BR TYPES
-- DATA: 2026-01-24
-- OBJ: Corrigir erro de Constraint 'chk_transaction_type'. 
--      O banco exige 'DESPESA' (Português), mas o script estava enviando 'EXPENSE'.
-- ==============================================================================

BEGIN;

-- 1. CORRIGIR FUNÇÃO SYNC (USAR 'DESPESA')
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_shared_transaction(p_tx_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tx_rec RECORD;
    v_split JSONB;
    v_target_member_id UUID;
    v_target_user_id UUID;
    v_target_trip_id UUID;
    v_inviter_name TEXT;
BEGIN
    SELECT * INTO v_tx_rec FROM public.transactions WHERE id = p_tx_id;
    
    IF (v_tx_rec.is_shared = true) AND (v_tx_rec.shared_with IS NOT NULL) AND (jsonb_array_length(v_tx_rec.shared_with) > 0) THEN
        
        -- Get Name
        SELECT raw_user_meta_data->>'name' INTO v_inviter_name FROM auth.users WHERE id = v_tx_rec.user_id;
        v_inviter_name := COALESCE(NULLIF(v_inviter_name, ''), 'Alguém');

        FOR v_split IN SELECT * FROM jsonb_array_elements(v_tx_rec.shared_with)
        LOOP
            v_target_member_id := (v_split->>'memberId')::UUID;
            SELECT linked_user_id INTO v_target_user_id FROM public.family_members WHERE id = v_target_member_id;
            
            IF v_target_user_id IS NOT NULL AND v_target_user_id != v_tx_rec.user_id THEN
                
                -- Check Trip Mirror
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

                -- Insert Mirror Transaction (VALIDANDO TIPO 'DESPESA')
                IF NOT EXISTS (
                    SELECT 1 FROM public.transactions 
                    WHERE user_id = v_target_user_id 
                    AND payer_id = v_tx_rec.user_id::text 
                    AND date = v_tx_rec.date
                    AND amount = (v_split->>'assignedAmount')::NUMERIC
                    -- Verifique tipos (Pode ser DESPESA ou EXPENSE no histórico, mas buscamos 'DESPESA' no novo padrão)
                    AND type IN ('DESPESA', 'EXPENSE') 
                ) THEN
                    INSERT INTO public.transactions (
                        user_id, 
                        amount, 
                        date, 
                        description, 
                        category, 
                        type, -- HERE WAS THE BUG
                        is_shared, 
                        payer_id, 
                        shared_with, 
                        trip_id, 
                        created_at, 
                        updated_at
                    ) VALUES (
                        v_target_user_id, 
                        (v_split->>'assignedAmount')::NUMERIC, 
                        v_tx_rec.date, 
                        v_tx_rec.description || ' (' || v_inviter_name || ')', 
                        v_tx_rec.category,
                        'DESPESA', -- FIX: FORCE PT-BR
                        true, 
                        v_tx_rec.user_id::text, 
                        '[]'::jsonb,
                        v_target_trip_id,
                        NOW(), 
                        NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;


-- 2. RE-DUMP LOOPS (MESMA LÓGICA DO ANTERIOR, AGORA COM A FUNÇÃO CORRIGIDA)
-- ------------------------------------------------------------------------------

-- Reparo Viagens (Garantia)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.trips WHERE participants IS NOT NULL AND jsonb_array_length(participants) > 0 LOOP
        PERFORM public.sync_shared_trip(r.id);
    END LOOP;
END $$;

-- Reparo Transações (Sync com Type 'DESPESA' correto)
DO $$
DECLARE r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.transactions WHERE is_shared = true LOOP
        PERFORM public.sync_shared_transaction(r.id);
    END LOOP;
END $$;

-- Reparo Splits Status (Undo Fix - Mantém lógica anterior que estava correta)
DO $$
DECLARE
    t RECORD;
    v_split_json JSONB;
    v_linked_user_id UUID;
    v_is_settled BOOLEAN;
BEGIN
    FOR t IN SELECT id, shared_with FROM public.transactions WHERE is_shared = true AND shared_with IS NOT NULL LOOP
        FOR v_split_json IN SELECT * FROM jsonb_array_elements(t.shared_with)
        LOOP
            v_is_settled := COALESCE((v_split_json->>'isSettled')::BOOLEAN, FALSE);
            SELECT linked_user_id INTO v_linked_user_id FROM public.family_members WHERE id = (v_split_json->>'memberId')::UUID;

            IF v_linked_user_id IS NOT NULL THEN
                IF v_is_settled = FALSE THEN
                    UPDATE public.transaction_splits
                    SET status = 'OPEN', payment_transaction_id = NULL
                    WHERE transaction_id = t.id AND debtor_id = v_linked_user_id AND status = 'SETTLED';
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;

COMMIT;
