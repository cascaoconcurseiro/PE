-- ============================================================================
-- TESTE DO FACTORY RESET - Execute com seu user_id
-- ============================================================================
-- Substitua 'SEU_USER_ID_AQUI' pelo seu UUID real
-- ============================================================================

-- 1. Primeiro, descubra seu user_id
SELECT id, email FROM auth.users LIMIT 10;

-- 2. Teste a função (substitua o UUID)
-- SELECT * FROM fn_smart_factory_reset('SEU_USER_ID_AQUI'::uuid, false);

-- ============================================================================
-- DIAGNÓSTICO MANUAL - Execute cada DELETE separadamente para achar o erro
-- ============================================================================

-- Substitua pelo seu user_id real
DO $$
DECLARE
    v_user_id uuid := 'SEU_USER_ID_AQUI'; -- SUBSTITUA AQUI!
    v_tx_ids uuid[];
    v_acc_ids uuid[];
BEGIN
    -- Coletar IDs
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_tx_ids
    FROM public.transactions WHERE user_id = v_user_id;
    
    SELECT COALESCE(array_agg(id), ARRAY[]::uuid[]) INTO v_acc_ids
    FROM public.accounts WHERE user_id = v_user_id;
    
    RAISE NOTICE 'Transações encontradas: %', array_length(v_tx_ids, 1);
    RAISE NOTICE 'Contas encontradas: %', array_length(v_acc_ids, 1);
    
    -- Testar cada delete
    RAISE NOTICE 'Testando DELETE transaction_splits...';
    DELETE FROM public.transaction_splits WHERE transaction_id = ANY(v_tx_ids);
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'Testando DELETE ledger_entries...';
    DELETE FROM public.ledger_entries WHERE transaction_id = ANY(v_tx_ids);
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'Testando UPDATE source_transaction_id...';
    UPDATE public.transactions SET source_transaction_id = NULL WHERE source_transaction_id = ANY(v_tx_ids);
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'Testando UPDATE settled_by_tx_id...';
    UPDATE public.transactions SET settled_by_tx_id = NULL WHERE settled_by_tx_id = ANY(v_tx_ids);
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'Testando DELETE transactions...';
    DELETE FROM public.transactions WHERE user_id = v_user_id;
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'Testando DELETE bank_statements...';
    DELETE FROM public.bank_statements WHERE account_id = ANY(v_acc_ids);
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'Testando DELETE accounts...';
    DELETE FROM public.accounts WHERE user_id = v_user_id;
    RAISE NOTICE 'OK!';
    
    RAISE NOTICE 'TODOS OS TESTES PASSARAM!';
    
    -- ROLLBACK para não apagar de verdade
    RAISE EXCEPTION 'ROLLBACK INTENCIONAL - Nenhum dado foi apagado';
END $$;

-- ============================================================================
-- VERIFICAR TRANSAÇÕES DE OUTROS USUÁRIOS QUE REFERENCIAM MINHAS CONTAS
-- ============================================================================
-- Isso pode ser o problema! Transações de OUTROS usuários usando minhas contas

SELECT 
    t.id,
    t.user_id as tx_owner,
    t.account_id,
    a.user_id as account_owner,
    t.description
FROM transactions t
JOIN accounts a ON t.account_id = a.id
WHERE t.user_id != a.user_id
LIMIT 20;

-- Verificar destination_account_id também
SELECT 
    t.id,
    t.user_id as tx_owner,
    t.destination_account_id,
    a.user_id as account_owner,
    t.description
FROM transactions t
JOIN accounts a ON t.destination_account_id = a.id
WHERE t.user_id != a.user_id
  AND t.destination_account_id IS NOT NULL
LIMIT 20;
