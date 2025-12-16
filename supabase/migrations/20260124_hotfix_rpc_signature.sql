-- ==============================================================================
-- HOTFIX: DOMAIN CONSTRAINT + RPC SIGNATURE
-- DATE: 2026-01-24
-- OBJ: Fix two critical bugs:
--      1. sync_shared_transaction INSERT missing 'domain' column -> NULL violates constraint
--      2. update_transaction RPC must accept 'p_shared_with' for Undo to work
-- ==============================================================================

BEGIN;

-- ============================================================================
-- PART 1: FIX sync_shared_transaction (ADD DOMAIN TO INSERT)
-- ============================================================================
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

                -- Insert Mirror Transaction WITH DOMAIN
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
                        domain, -- ✅ FIX: ADD DOMAIN COLUMN
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
                        'DESPESA', -- PT-BR Type
                        CASE WHEN v_target_trip_id IS NOT NULL THEN 'TRAVEL' ELSE 'SHARED' END, -- ✅ FIX: DYNAMIC DOMAIN
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



-- ============================================================================
-- PART 2: ENSURE update_transaction RPC accepts p_shared_with
-- ============================================================================
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
    p_shared_with JSONB DEFAULT NULL
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
    -- 1. Validate Access
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transaction not found or access denied.';
    END IF;

    -- 2. Determine Valid Domain (Constraint Safe)
    v_final_domain := CASE 
        WHEN p_domain IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS') THEN p_domain
        ELSE 'PERSONAL' -- Default if null or invalid
    END;

    -- 3. Update Transaction
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
        shared_with = COALESCE(p_shared_with, shared_with),
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;

    -- 4. Sync Splits (Undo Logic)
    IF p_shared_with IS NOT NULL THEN
        FOR v_split_json IN SELECT * FROM jsonb_array_elements(p_shared_with)
        LOOP
            v_member_id := (v_split_json->>'memberId')::UUID;
            v_split_is_settled := COALESCE((v_split_json->>'isSettled')::BOOLEAN, FALSE);
            
            SELECT linked_user_id INTO v_linked_user_id FROM public.family_members WHERE id = v_member_id;
            
            IF v_linked_user_id IS NOT NULL THEN
                UPDATE public.transaction_splits
                SET status = CASE WHEN v_split_is_settled THEN 'SETTLED' ELSE 'OPEN' END,
                    payment_transaction_id = CASE WHEN v_split_is_settled THEN payment_transaction_id ELSE NULL END
                WHERE transaction_id = p_id AND debtor_id = v_linked_user_id;
            END IF;
        END LOOP;
    END IF;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
