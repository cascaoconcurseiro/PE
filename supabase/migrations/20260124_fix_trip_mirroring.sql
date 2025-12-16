-- ==============================================================================
-- FIX TRIP MIRRORING & SHARED DESCRIPTION
-- DATA: 2026-01-24
-- OBJ: 1. Garantir que Viagens Compartilhadas apareçam para os convidados (Mirroring).
--      2. Garantir formatação correta do nome da transação espelhada.
-- ==============================================================================

BEGIN;

-- 1. TRIP MIRRORING LOGIC
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
    
    -- Validar
    IF v_trip_rec.participants IS NOT NULL AND jsonb_array_length(v_trip_rec.participants) > 0 THEN
        
        -- Nome do dono
        SELECT raw_user_meta_data->>'name' INTO v_inviter_name FROM auth.users WHERE id = v_trip_rec.user_id;

        FOR v_participant IN SELECT * FROM jsonb_array_elements(v_trip_rec.participants)
        LOOP
            v_target_member_id := (v_participant->>'id')::UUID; -- Assuming participants is array of objects with id? Or IDs strings?
            -- Trip participants structure check: usually strings (member_ids) or objects? 
            -- TripForm usually saves 'participants' as Array of Strings (Member IDs).
            -- Let's handle both.
            
            IF (jsonb_typeof(v_participant) = 'string') THEN
                 v_target_member_id := (v_participant#>>'{}')::UUID;
            ELSE
                 v_target_member_id := (v_participant->>'id')::UUID;
            END IF;

            -- Find Real User
            SELECT linked_user_id INTO v_target_user_id FROM public.family_members WHERE id = v_target_member_id;

            IF v_target_user_id IS NOT NULL AND v_target_user_id != v_trip_rec.user_id THEN
                -- Check/Insert Mirror Trip
                IF NOT EXISTS (SELECT 1 FROM public.trips WHERE source_trip_id = v_trip_rec.id AND user_id = v_target_user_id) THEN
                    INSERT INTO public.trips (
                        user_id, name, description, start_date, end_date, budget, currency, 
                        source_trip_id, status, created_at, updated_at
                    ) VALUES (
                        v_target_user_id,
                        v_trip_rec.name || ' (Convite)', -- Visual Cue
                        v_trip_rec.description,
                        v_trip_rec.start_date,
                        v_trip_rec.end_date,
                        v_trip_rec.budget,
                        v_trip_rec.currency,
                        v_trip_rec.id, -- Valid Link
                        v_trip_rec.status,
                        NOW(), NOW()
                    );
                    
                    -- Notification
                    INSERT INTO public.user_notifications (
                        user_id, type, title, message, data, is_read
                    ) VALUES (
                        v_target_user_id, 'TRIP_INVITE', 'Convite de Viagem',
                        COALESCE(v_inviter_name, 'Alguém') || ' te convidou para a viagem: ' || v_trip_rec.name,
                        jsonb_build_object('tripId', v_trip_rec.id),
                        FALSE
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;


-- 2. UPDATE CREATE_TRIP (Call Sync)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_trip(
    p_name TEXT,
    p_description TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_currency TEXT,
    p_status TEXT DEFAULT 'PLANNED',
    p_participants JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    INSERT INTO public.trips (
        user_id, name, description, start_date, end_date, currency, status, participants, created_at, updated_at
    ) VALUES (
        v_user_id, p_name, p_description, p_start_date, p_end_date, p_currency, p_status, p_participants, NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    -- Trigger Mirroring
    PERFORM public.sync_shared_trip(v_new_id);

    RETURN v_new_id;
END;
$$;


-- 3. UPDATE SYNC SHARED TRANSACTION (Fix Description)
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
                
                -- Check/Create Mirror Trip FIRST
                v_target_trip_id := NULL;
                IF v_tx_rec.trip_id IS NOT NULL THEN
                    SELECT id INTO v_target_trip_id FROM public.trips 
                    WHERE source_trip_id = v_tx_rec.trip_id AND user_id = v_target_user_id;
                    
                    -- If Mirror Trip Missing, Create it on the fly (Self-Repair)
                    IF v_target_trip_id IS NULL THEN
                         -- Call Sync Shared Trip
                         PERFORM public.sync_shared_trip(v_tx_rec.trip_id);
                         -- Retry Select
                         SELECT id INTO v_target_trip_id FROM public.trips 
                         WHERE source_trip_id = v_tx_rec.trip_id AND user_id = v_target_user_id;
                    END IF;
                END IF;

                -- Insert Mirror Transaction
                IF NOT EXISTS (
                    SELECT 1 FROM public.transactions 
                    WHERE user_id = v_target_user_id 
                    AND payer_id = v_tx_rec.user_id::text 
                    AND date = v_tx_rec.date
                    AND amount = (v_split->>'assignedAmount')::NUMERIC
                    AND type = 'EXPENSE'
                ) THEN
                    INSERT INTO public.transactions (
                        user_id, 
                        amount, 
                        date, 
                        description, 
                        category, 
                        type, 
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
                        -- FIX FORMATTING:
                        v_tx_rec.description || ' (' || v_inviter_name || ')', 
                        v_tx_rec.category,
                        'EXPENSE', 
                        true, 
                        v_tx_rec.user_id::text, 
                        '[]'::jsonb,
                        v_target_trip_id,
                        NOW(), 
                        NOW()
                    );
                    
                    -- Notification
                    INSERT INTO public.user_notifications (
                        user_id, type, title, message, data, is_read
                    ) VALUES (
                        v_target_user_id, 'TRANSACTION', 'Despesa Compartilhada', 
                        v_inviter_name || ' adicionou: ' || v_tx_rec.description, 
                        jsonb_build_object('transactionId', p_tx_id), 
                        FALSE
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;

COMMIT;
