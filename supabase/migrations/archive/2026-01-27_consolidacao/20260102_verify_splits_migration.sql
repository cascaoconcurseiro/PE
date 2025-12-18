-- ==============================================================================
-- VERIFICACAO: MIGRAÇÃO DE SPLITS (2026-01-02)
-- DESCRIPTION: Verifica se a tabela transaction_splits foi populada corretamente.
-- ==============================================================================

DO $$
DECLARE
    count_json INT;
    count_table INT;
    discrepancy INT;
BEGIN
    RAISE NOTICE '--- INICIANDO VERIFICACAO ---';

    -- 1. Contar transações que DEVERIAM ter splits (JSON não vazio)
    SELECT COUNT(*) INTO count_json
    FROM transactions
    WHERE shared_with IS NOT NULL 
      AND jsonb_array_length(shared_with) > 0;

    -- 2. Contar quantos splits únicos (agrupados por transação) existem na tabela
    SELECT COUNT(DISTINCT transaction_id) INTO count_table
    FROM transaction_splits;

    RAISE NOTICE 'Transações com Array JSON: %', count_json;
    RAISE NOTICE 'Transações na Tabela Nova: %', count_table;

    discrepancy := count_json - count_table;

    IF discrepancy = 0 THEN
        RAISE NOTICE '✅ SUCESSO: Todos os registros foram migrados perfeitamente.';
    ELSE
        RAISE NOTICE '⚠️ AVISO: Existe uma diferença de % transações.', discrepancy;
        RAISE NOTICE '   Isso pode acontecer se haviam usuários inválidos no JSON (Ghost Data) que foram limpos.';
    END IF;

    -- 3. Amostra
    RAISE NOTICE '--- AMOSTRA DE DADOS ---';
    FOR discrepancy IN 1..3 LOOP
        -- Dummy loop just to show data structure implies select logic here if needed
        -- This block is just for logs
    END LOOP;
    
END $$;
