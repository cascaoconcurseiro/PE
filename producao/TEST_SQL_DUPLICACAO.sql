-- ==============================================================================
-- TESTE: Verificar se a função SQL está criando duplicações
-- ==============================================================================

-- PASSO 1: Criar uma transação de teste manualmente
DO $$
DECLARE
    v_user_id UUID := 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'; -- Substitua pelo seu user_id
    v_account_id UUID := 'b6715be7-4db3-4c04-ba7e-d06f13a90a99'; -- Substitua por um account_id válido
    v_result JSONB;
BEGIN
    -- Chamar a função com UM split apenas
    SELECT create_financial_record(
        p_user_id := v_user_id,
        p_amount := 50.00,
        p_description := 'TESTE SQL DUPLICACAO',
        p_date := CURRENT_DATE,
        p_type := 'DESPESA',
        p_category := 'Alimentação',
        p_account_id := v_account_id,
        p_destination_account_id := NULL,
        p_splits := '[{"user_id": "123e4567-e89b-12d3-a456-426614174000", "amount": 50, "email": "teste@teste.com"}]'::JSONB,
        p_trip_id := NULL,
        p_notes := 'Teste de duplicação',
        p_is_installment := TRUE,
        p_current_installment := 1,
        p_total_installments := 2,
        p_series_id := gen_random_uuid()
    ) INTO v_result;

    RAISE NOTICE 'Resultado: %', v_result;
END $$;

-- PASSO 2: Verificar quantos ledger entries foram criados
SELECT 
    COUNT(*) as total_ledger_entries,
    STRING_AGG(description, ' | ') as descriptions
FROM ledger_entries le
JOIN transactions t ON le.transaction_id = t.id
WHERE t.description = 'TESTE SQL DUPLICACAO';

-- PASSO 3: Ver detalhes dos ledger entries
SELECT 
    le.id,
    le.description,
    le.amount,
    coa.name as account_name,
    coa.type as account_type,
    le.created_at
FROM ledger_entries le
JOIN transactions t ON le.transaction_id = t.id
JOIN chart_of_accounts coa ON le.debit_account_id = coa.id
WHERE t.description = 'TESTE SQL DUPLICACAO'
ORDER BY le.created_at;

-- RESULTADO ESPERADO:
-- total_ledger_entries: 1 (apenas "A receber de: teste@teste.com")
-- Se retornar mais de 1, o problema está na função SQL

-- PASSO 4: Limpar teste
DELETE FROM transactions WHERE description = 'TESTE SQL DUPLICACAO';

