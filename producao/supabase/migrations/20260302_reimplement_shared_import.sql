CREATE OR REPLACE FUNCTION public.import_shared_installments(
    p_user_id UUID,
    p_description TEXT,
    p_parcel_amount NUMERIC,
    p_installments INTEGER,
    p_first_due_date DATE,
    p_category TEXT,
    p_account_id UUID,
    p_shared_with_user_id UUID DEFAULT NULL -- Opcional: Se houver compartilhamento
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
        -- Calcular data da parcela (Mês a Mês)
        -- Usando intervalo para garantir progressão correta
        v_current_date := p_first_due_date + ((i - 1) || ' months')::INTERVAL;

        -- 1. Inserir Transação Original (Dono do Cartão)
        INSERT INTO public.transactions (
            user_id,
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
            p_description || ' (' || i || '/' || p_installments || ')',
            p_parcel_amount,
            v_current_date,
            'DESPESA', -- Assume Despesa para fatura de cartão
            p_category,
            p_account_id,
            TRUE,
            i,
            p_installments,
            v_series_id,
            (p_shared_with_user_id IS NOT NULL),
            CASE 
                WHEN p_shared_with_user_id IS NOT NULL THEN jsonb_build_array(jsonb_build_object('user', p_shared_with_user_id, 'percentage', 100)) -- Simplificação: Assumindo 100% ou parametrizável se precisar
                ELSE '[]'::JSONB
            END,
            NOW(),
            NOW()
        ) RETURNING id INTO v_original_id;

        -- 2. Criar Espelho (Mirror) se houver compartilhamento
        IF p_shared_with_user_id IS NOT NULL THEN
            INSERT INTO public.transactions (
                user_id,
                description,
                amount,
                date,
                type,
                category,
                account_id, -- Nota: Mirror geralmente não tem account_id ou tem uma conta "virtual" de dívida? 
                            -- Se null, pode dar erro em query que espera account_id.
                            -- Assumiremos NULL por enquanto e o Frontend trata, ou usamos account_id dummy se existir.
                            -- Pelo schema, account_id é FK para accounts, então NULL é seguro se a coluna permitir.
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
                p_shared_with_user_id,
                p_description || ' (' || i || '/' || p_installments || ')',
                p_parcel_amount,
                v_current_date,
                'DESPESA',
                p_category,
                NULL, -- Mirror não movimenta conta bancária do usuário B imediatamente
                TRUE,
                i,
                p_installments,
                v_series_id,
                TRUE,
                TRUE, -- É mirror
                v_original_id, -- Link para original
                NOW(),
                NOW()
            ) RETURNING id INTO v_mirror_id;

            -- 3. Linkar Original -> Mirror (Bi-direcional soft link via tabela auxiliar ou update)
            -- Atualiza a original com o ID do mirror (se campo existir e for unico)
            UPDATE public.transactions 
            SET mirror_transaction_id = v_mirror_id 
            WHERE id = v_original_id;

            -- Gravar na tabela de relacionamento explicita (se existir no schema ativo)
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
            EXCEPTION WHEN OTHERS THEN
                -- Ignora erro se tabela não existir ou duplicar, foco é na transação
                NULL;
            END;
        END IF;

        v_result := v_result || jsonb_build_object('original_id', v_original_id, 'mirror_id', v_mirror_id);
    END LOOP;

    RETURN v_result;
END;
$$;
