-- ==============================================================================
-- HOTFIX: FIX HISTORICAL DOMAIN INCONSISTENCIES
-- DATE: 2026-01-24
-- OBJ: Corrigir transações existentes que têm trip_id mas domain != 'TRAVEL'
--      Isso desbloqueia o trigger trg_validate_domain que bloqueia updates.
-- ==============================================================================

BEGIN;

-- 1. DESABILITAR TRIGGER TEMPORARIAMENTE
-- (Permite a correção em massa sem erros)
ALTER TABLE public.transactions DISABLE TRIGGER trg_validate_domain;

-- 2. CORRIGIR TRANSAÇÕES COM TRIP_ID MAS DOMAIN ERRADO
UPDATE public.transactions
SET domain = 'TRAVEL'
WHERE trip_id IS NOT NULL AND domain != 'TRAVEL';

-- 3. CORRIGIR TRANSAÇÕES SHARED SEM TRIP_ID MAS SEM DOMAIN
UPDATE public.transactions
SET domain = 'SHARED'
WHERE is_shared = true AND trip_id IS NULL AND (domain IS NULL OR domain = '');

-- 4. CORRIGIR TRANSAÇÕES NORMAIS SEM DOMAIN
UPDATE public.transactions
SET domain = 'PERSONAL'
WHERE domain IS NULL OR domain = '';

-- 5. REABILITAR TRIGGER
ALTER TABLE public.transactions ENABLE TRIGGER trg_validate_domain;

-- 6. REDEFINE sync_shared_transaction COM LOGICA DINAMICA
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

                -- Insert Mirror Transaction
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
                        NOW(), 
                        NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;

COMMIT;
