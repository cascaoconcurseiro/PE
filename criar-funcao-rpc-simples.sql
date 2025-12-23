-- ==============================================================================
-- FUNÇÃO RPC SIMPLES: create_shared_installment_simple
-- ALTERNATIVA: Função mais simples para criar parcelas compartilhadas
-- ==============================================================================

-- Função simplificada que apenas cria a transação
CREATE OR REPLACE FUNCTION public.create_shared_installment_simple(
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_user_id UUID,
    p_installment_number INTEGER DEFAULT 1,
    p_total_installments INTEGER DEFAULT 1,
    p_series_id UUID DEFAULT NULL
) RETURNS UUID AS $$
DECLARE
    v_transaction_id UUID;
    v_final_series_id UUID;
BEGIN
    -- Validações básicas
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor deve ser positivo';
    END IF;
    
    IF p_user_id IS NULL THEN
        RAISE EXCEPTION 'User ID é obrigatório';
    END IF;
    
    -- Gerar series_id se não fornecido
    v_final_series_id := COALESCE(p_series_id, gen_random_uuid());
    
    -- Criar transação
    INSERT INTO public.transactions (
        user_id,
        description,
        amount,
        type,
        category,
        date,
        account_id,
        currency,
        is_shared,
        is_installment,
        current_installment,
        total_installments,
        series_id,
        domain,
        created_at,
        updated_at,
        deleted
    ) VALUES (
        p_user_id,
        p_description,
        p_amount,
        'DESPESA',
        p_category,
        p_date,
        NULL, -- account_id NULL para compartilhadas
        'BRL',
        true,
        p_total_installments > 1,
        p_installment_number,
        p_total_installments,
        v_final_series_id,
        'SHARED',
        NOW(),
        NOW(),
        false
    ) RETURNING id INTO v_transaction_id;
    
    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.create_shared_installment_simple(TEXT, NUMERIC, TEXT, DATE, UUID, INTEGER, INTEGER, UUID) TO authenticated;

-- Comentário
COMMENT ON FUNCTION public.create_shared_installment_simple IS 'Função simplificada para criar parcelas compartilhadas';

-- Verificar criação
SELECT 'FUNÇÃO SIMPLES CRIADA' as status;