CREATE OR REPLACE FUNCTION public.import_shared_installments(
    p_user_id UUID,          -- OWNER (Quem paga)
    p_author_id UUID,        -- AUTHOR (Quem cria/importa)
    p_description TEXT,
    p_parcel_amount NUMERIC,
    p_installments INTEGER,
    p_first_due_date DATE,
    p_category TEXT,
    p_account_id UUID DEFAULT NULL,
    p_shared_with_user_id UUID DEFAULT NULL -- Espelho (O outro)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_series_id TEXT := gen_random_uuid()::TEXT;
    v_current_date DATE;
    v_original_id UUID;
    v_mirror_id UUID;
    i INTEGER;
    v_result JSONB := '[]'::JSONB;
BEGIN
    -- Loop para criar as N parcelas
    FOR i IN 1..p_installments LOOP
        v_current_date := p_first_due_date + ((i - 1) || ' months')::INTERVAL;

        -- 1. Inserir Transação Original (Dono/Pagador)
        INSERT INTO public.transactions (
            user_id,          -- B (Se B paga)
            created_by,       -- A (Quem importou)
            description,
            amount,
            date,
            type,
            category,
            account_id,
            is_installment,
            current_installment,
            total_installments,
            series_id,
            is_shared,
            shared_with,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_author_id,
            p_description || ' (' || i || '/' || p_installments || ')',
            p_parcel_amount,
            v_current_date,
            'DESPESA',
            p_category,
            p_account_id,
            TRUE,
            i,
            p_installments,
            v_series_id,
            (p_shared_with_user_id IS NOT NULL),
            CASE 
                 -- Metadata simples indicando com quem foi compartilhado
                WHEN p_shared_with_user_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object('user', p_shared_with_user_id, 'percentage', 100))
                ELSE '[]'::JSONB
            END,
            NOW(),
            NOW()
        ) RETURNING id INTO v_original_id;

        -- 2. Criar Espelho (Mirror) para o Outro
        IF p_shared_with_user_id IS NOT NULL THEN
            INSERT INTO public.transactions (
                user_id,           -- A (O outro)
                created_by,        -- A (Quem importou)
                description,
                amount,
                date,
                type,
                category,
                account_id,
                is_installment,
                current_installment,
                total_installments,
                series_id,
                is_shared,
                is_mirror,
                source_transaction_id,
                created_at,
                updated_at
            ) VALUES (
                p_shared_with_user_id, -- Espelho pertence a quem? Ao outro.
                p_author_id,           -- Mas foi criado por A.
                p_description || ' (' || i || '/' || p_installments || ')',
                p_parcel_amount,
                v_current_date,
                'DESPESA',
                p_category,
                NULL, 
                TRUE,
                i,
                p_installments,
                v_series_id,
                TRUE,
                TRUE, -- Mirror
                v_original_id, -- Link
                NOW(),
                NOW()
            ) RETURNING id INTO v_mirror_id;

            -- Link Reverso
            UPDATE public.transactions 
            SET mirror_transaction_id = v_mirror_id 
            WHERE id = v_original_id;

            -- Opcional: Mirrors table
            BEGIN
                INSERT INTO public.shared_transaction_mirrors (
                    original_transaction_id,
                    mirror_transaction_id,
                    mirror_user_id
                ) VALUES (
                    v_original_id,
                    v_mirror_id,
                    p_shared_with_user_id
                );
            EXCEPTION WHEN OTHERS THEN NULL; END;
        END IF;

        v_result := v_result || jsonb_build_object('original_id', v_original_id, 'mirror_id', v_mirror_id);
    END LOOP;

    RETURN v_result;
END;
$$;
