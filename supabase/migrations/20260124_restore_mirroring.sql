-- ==============================================================================
-- RESTORE SHARED TRANSACTION MIRRORING (RPC-BASED)
-- DATE: 2026-01-24
-- OBJ: Restore Mirroring Logic via RPC (Backend Centric).
--      Fixes "Shared Transactions not appearing for invited users".
-- ==============================================================================

BEGIN;

-- 1. DEFINE SYNC HELPER FUNCTION
CREATE OR REPLACE FUNCTION public.sync_shared_transaction(p_tx_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_tx_rec RECORD;
    v_split JSONB;
    v_target_member_id UUID;
    v_target_user_id UUID;
    v_target_trip_id UUID;
    v_inviter_name TEXT;
    v_original_trip_rec RECORD;
BEGIN
    -- Fetch Transaction Data
    SELECT * INTO v_tx_rec FROM public.transactions WHERE id = p_tx_id;
    
    -- Validation: Must be Shared, Have Metadata, and Have Splits
    IF (v_tx_rec.is_shared = true) AND (v_tx_rec.shared_with IS NOT NULL) AND (jsonb_array_length(v_tx_rec.shared_with) > 0) THEN
        
        -- Get Sender Name
        SELECT raw_user_meta_data->>'name' INTO v_inviter_name FROM auth.users WHERE id = v_tx_rec.user_id;
        
        -- Loop through participants (Splits)
        FOR v_split IN SELECT * FROM jsonb_array_elements(v_tx_rec.shared_with)
        LOOP
            v_target_member_id := (v_split->>'memberId')::UUID;
            -- Find the REAL user linked to this member
            SELECT linked_user_id INTO v_target_user_id FROM public.family_members WHERE id = v_target_member_id;
            
            -- Only proceed if the member is a real user and NOT the sender (no self-mirroring)
            IF v_target_user_id IS NOT NULL AND v_target_user_id != v_tx_rec.user_id THEN
                
                -- A) MIRROR TRIP (If part of a trip)
                v_target_trip_id := NULL;
                IF v_tx_rec.trip_id IS NOT NULL THEN
                    -- Check if User B already has a mirror
                    SELECT id INTO v_target_trip_id FROM public.trips 
                    WHERE source_trip_id::text = v_tx_rec.trip_id::text AND user_id = v_target_user_id;

                    -- If not, Clone it
                    IF v_target_trip_id IS NULL THEN
                        SELECT * INTO v_original_trip_rec FROM public.trips WHERE id::text = v_tx_rec.trip_id::text;
                        IF v_original_trip_rec.id IS NOT NULL THEN
                            INSERT INTO public.trips (
                                user_id, name, start_date, end_date, budget, image_url, source_trip_id, participants, created_at, updated_at
                            ) VALUES (
                                v_target_user_id, 
                                v_original_trip_rec.name, 
                                v_original_trip_rec.start_date, 
                                v_original_trip_rec.end_date, 
                                v_original_trip_rec.budget,
                                v_original_trip_rec.image_url, 
                                v_original_trip_rec.id, -- Link to Source
                                v_original_trip_rec.participants, 
                                NOW(), 
                                NOW()
                            ) RETURNING id INTO v_target_trip_id;
                        END IF;
                    END IF;
                END IF;

                -- B) MIRROR TRANSACTION
                -- Check for duplicates to avoid spam
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
                        v_tx_rec.description || ' (Comp. por ' || COALESCE(v_inviter_name, 'Alguém') || ')',
                        v_tx_rec.category, -- Keep category context
                        'EXPENSE', 
                        true, 
                        v_tx_rec.user_id::text, 
                        '[]'::jsonb, -- Receiver leaf
                        v_target_trip_id,
                        NOW(), 
                        NOW()
                    );
                    
                    -- Notification
                     INSERT INTO public.user_notifications (
                        user_id, type, title, message, data, is_read, created_at
                    ) VALUES (
                        v_target_user_id, 
                        'TRANSACTION', 
                        'Nova Despesa Compartilhada', 
                        COALESCE(v_inviter_name, 'Alguém') || ' adicionou: ' || v_tx_rec.description, 
                        jsonb_build_object('transactionId', v_tx_rec.id), 
                        false, 
                        NOW()
                    );
                END IF;
                
            END IF;
        END LOOP;
    END IF;
END;
$$;

-- 2. UPDATE CREATE_TRANSACTION RPC (Include p_shared_with and Call SYNC)
CREATE OR REPLACE FUNCTION public.create_transaction(
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
    p_shared_with JSONB DEFAULT '[]'::jsonb -- NEW PARAM
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Determine Domain (Optional)
    v_final_domain := COALESCE(p_domain, 'personal');

    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id -- Save Shared Metadata
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id::text, p_destination_account_id::text, p_trip_id::text,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id::text,
        p_is_recurring, p_frequency,
        p_shared_with, -- Save JSON
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END -- I am the payer
    ) RETURNING id INTO v_new_id;
    
    -- MIRRORING LOGIC (BACKEND CENTRIC)
    PERFORM public.sync_shared_transaction(v_new_id);

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
