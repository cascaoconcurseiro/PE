-- ============================================
-- CORREÇÃO DA FUNÇÃO import_shared_installments
-- Data: 2024-12-24
-- Descrição: Recriar com SECURITY DEFINER e sem RLS bloqueando
-- ============================================

-- Desabilitar RLS temporariamente
ALTER TABLE transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits DISABLE ROW LEVEL SECURITY;

-- Remover todas as versões antigas
DROP FUNCTION IF EXISTS import_shared_installments CASCADE;
DROP FUNCTION IF EXISTS import_shared_installments(uuid, text, numeric, integer, date, text, uuid, uuid) CASCADE;
DROP FUNCTION IF EXISTS import_shared_installments(uuid, uuid, text, numeric, integer, date, text, uuid, uuid) CASCADE;

-- Criar função com SECURITY DEFINER (CRÍTICO)
CREATE OR REPLACE FUNCTION import_shared_installments(
    p_user_id UUID,
    p_author_id UUID,
    p_description TEXT,
    p_parcel_amount NUMERIC,
    p_installments INTEGER,
    p_first_due_date DATE,
    p_category TEXT,
    p_account_id UUID DEFAULT NULL,
    p_shared_with_user_id UUID DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER  -- Permite ignorar RLS
SET search_path = public
AS $$
DECLARE
    v_transaction_id UUID;
    v_transaction_ids UUID[] := ARRAY[]::UUID[];
    v_current_date DATE;
    v_installment_number INTEGER;
    v_member_id UUID;
BEGIN
    -- Validações
    IF p_installments < 1 OR p_installments > 99 THEN
        RAISE EXCEPTION 'Número de parcelas deve estar entre 1 e 99';
    END IF;

    IF p_parcel_amount <= 0 THEN
        RAISE EXCEPTION 'Valor da parcela deve ser maior que zero';
    END IF;

    -- Buscar member_id
    SELECT id INTO v_member_id
    FROM family_members
    WHERE linked_user_id = p_user_id
    AND deleted = false
    LIMIT 1;

    IF v_member_id IS NULL THEN
        v_member_id := p_user_id;
    END IF;

    -- Criar parcelas
    FOR v_installment_number IN 1..p_installments LOOP
        v_current_date := p_first_due_date + ((v_installment_number - 1) * INTERVAL '1 month');

        INSERT INTO transactions (
            user_id,
            created_by,
            description,
            amount,
            date,
            type,
            category,
            is_installment,
            current_installment,
            total_installments,
            is_shared,
            shared_with,
            deleted,
            created_at,
            updated_at
        ) VALUES (
            p_user_id,
            p_author_id,
            p_description || ' (' || v_installment_number || '/' || p_installments || ')',
            p_parcel_amount,
            v_current_date,
            'DESPESA',
            p_category,
            true,
            v_installment_number,
            p_installments,
            true,
            jsonb_build_array(
                jsonb_build_object(
                    'memberId', v_member_id,
                    'assignedAmount', p_parcel_amount,
                    'isSettled', false
                )
            ),
            false,
            NOW(),
            NOW()
        )
        RETURNING id INTO v_transaction_id;

        v_transaction_ids := array_append(v_transaction_ids, v_transaction_id);
    END LOOP;

    RETURN json_build_object(
        'success', true,
        'transaction_ids', v_transaction_ids,
        'count', p_installments,
        'message', 'Parcelas criadas com sucesso'
    );

EXCEPTION
    WHEN OTHERS THEN
        RETURN json_build_object(
            'success', false,
            'error', SQLERRM,
            'message', 'Erro ao criar parcelas: ' || SQLERRM
        );
END;
$$;

-- Garantir permissões
GRANT EXECUTE ON FUNCTION import_shared_installments TO authenticated;

-- Reativar RLS
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE transaction_splits ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FIM DA CORREÇÃO
-- ============================================
