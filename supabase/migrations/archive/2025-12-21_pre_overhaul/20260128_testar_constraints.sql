-- ==============================================================================
-- SCRIPT DE TESTE: Verificar se constraints estão funcionando
-- Execute este script para testar as proteções implementadas
-- ==============================================================================

-- ==============================================================================
-- TESTE 1: Verificar constraint de account.type
-- ==============================================================================

-- Primeiro, obter um user_id válido
DO $$
DECLARE
  test_user_id UUID;
  test_account_id UUID;
BEGIN
  -- Obter primeiro user_id disponível
  SELECT id INTO test_user_id
  FROM auth.users
  LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RAISE NOTICE 'Nenhum usuário encontrado. Testes não podem ser executados.';
    RETURN;
  END IF;
  
  RAISE NOTICE 'Usando user_id: %', test_user_id;
  
  -- TESTE 1: Tentar inserir tipo inválido (deve FALHAR)
  BEGIN
    INSERT INTO accounts (user_id, name, type, balance, currency)
    VALUES (test_user_id, 'Teste Constraint', 'TIPO_INVALIDO', 0, 'BRL');
    
    RAISE EXCEPTION 'ERRO: Constraint não está funcionando! Tipo inválido foi aceito.';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '✅ TESTE 1 PASSOU: Constraint bloqueou tipo inválido corretamente!';
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️ TESTE 1: Erro inesperado - %', SQLERRM;
  END;
  
  -- TESTE 2: Inserir tipo válido (deve FUNCIONAR)
  BEGIN
    INSERT INTO accounts (user_id, name, type, balance, currency)
    VALUES (test_user_id, 'Teste Válido', 'CHECKING', 0, 'BRL')
    RETURNING id INTO test_account_id;
    
    RAISE NOTICE '✅ TESTE 2 PASSOU: Tipo válido foi aceito. Account ID: %', test_account_id;
    
    -- Limpar teste
    DELETE FROM accounts WHERE id = test_account_id;
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ TESTE 2 FALHOU: %', SQLERRM;
  END;
  
END $$;

-- ==============================================================================
-- TESTE 2: Verificar constraint de transaction.type
-- ==============================================================================

DO $$
DECLARE
  test_user_id UUID;
  test_account_id UUID;
BEGIN
  -- Obter user_id e criar conta de teste
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Criar conta de teste
  INSERT INTO accounts (user_id, name, type, balance, currency)
  VALUES (test_user_id, 'Conta Teste', 'CHECKING', 0, 'BRL')
  ON CONFLICT DO NOTHING
  RETURNING id INTO test_account_id;
  
  IF test_account_id IS NULL THEN
    SELECT id INTO test_account_id 
    FROM accounts 
    WHERE user_id = test_user_id 
    LIMIT 1;
  END IF;
  
  -- TESTE 3: Tentar inserir tipo inválido (deve FALHAR)
  BEGIN
    INSERT INTO transactions (user_id, description, amount, date, type, account_id, category)
    VALUES (test_user_id, 'Teste', 100, CURRENT_DATE, 'TIPO_INVALIDO', test_account_id, 'Outros');
    
    RAISE EXCEPTION 'ERRO: Constraint não está funcionando!';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '✅ TESTE 3 PASSOU: Constraint bloqueou tipo inválido corretamente!';
    WHEN OTHERS THEN
      RAISE NOTICE '⚠️ TESTE 3: Erro inesperado - %', SQLERRM;
  END;
  
  -- TESTE 4: Inserir tipo válido (deve FUNCIONAR)
  BEGIN
    INSERT INTO transactions (user_id, description, amount, date, type, account_id, category)
    VALUES (test_user_id, 'Teste Válido', 100, CURRENT_DATE, 'DESPESA', test_account_id, 'Outros');
    
    RAISE NOTICE '✅ TESTE 4 PASSOU: Tipo válido foi aceito.';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ TESTE 4 FALHOU: %', SQLERRM;
  END;
  
  -- Limpar (opcional - comentar se quiser manter dados de teste)
  -- DELETE FROM transactions WHERE user_id = test_user_id AND description = 'Teste Válido';
  -- DELETE FROM accounts WHERE id = test_account_id AND name = 'Conta Teste';
  
END $$;

-- ==============================================================================
-- TESTE 3: Verificar validação de splits
-- ==============================================================================

DO $$
DECLARE
  test_user_id UUID;
  test_account_id UUID;
  test_transaction_id UUID;
  test_member_id UUID;
BEGIN
  -- Obter IDs de teste
  SELECT id INTO test_user_id FROM auth.users LIMIT 1;
  
  IF test_user_id IS NULL THEN
    RETURN;
  END IF;
  
  -- Obter ou criar conta
  SELECT id INTO test_account_id 
  FROM accounts 
  WHERE user_id = test_user_id 
  LIMIT 1;
  
  IF test_account_id IS NULL THEN
    INSERT INTO accounts (user_id, name, type, balance, currency)
    VALUES (test_user_id, 'Conta Teste', 'CHECKING', 0, 'BRL')
    RETURNING id INTO test_account_id;
  END IF;
  
  -- Criar transação de teste (R$ 100,00)
  INSERT INTO transactions (user_id, description, amount, date, type, account_id, category, is_shared)
  VALUES (test_user_id, 'Teste Split', 100.00, CURRENT_DATE, 'DESPESA', test_account_id, 'Outros', true)
  RETURNING id INTO test_transaction_id;
  
  -- Obter ou criar member_id
  SELECT id INTO test_member_id 
  FROM family_members 
  WHERE user_id = test_user_id 
  LIMIT 1;
  
  IF test_member_id IS NULL THEN
    -- Usar user_id como fallback
    test_member_id := test_user_id;
  END IF;
  
  -- TESTE 5: Tentar criar split que excede total (deve FALHAR)
  BEGIN
    INSERT INTO transaction_splits (transaction_id, member_id, user_id, assigned_amount)
    VALUES (test_transaction_id, test_member_id, test_user_id, 150.00);
    
    RAISE EXCEPTION 'ERRO: Validação de split não está funcionando!';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM LIKE '%excede o total%' OR SQLERRM LIKE '%exceeds%' THEN
        RAISE NOTICE '✅ TESTE 5 PASSOU: Validação bloqueou split que excede total!';
      ELSE
        RAISE NOTICE '⚠️ TESTE 5: Erro inesperado - %', SQLERRM;
      END IF;
  END;
  
  -- TESTE 6: Criar split válido (deve FUNCIONAR)
  BEGIN
    INSERT INTO transaction_splits (transaction_id, member_id, user_id, assigned_amount)
    VALUES (test_transaction_id, test_member_id, test_user_id, 50.00);
    
    RAISE NOTICE '✅ TESTE 6 PASSOU: Split válido foi aceito.';
  EXCEPTION
    WHEN OTHERS THEN
      RAISE NOTICE '❌ TESTE 6 FALHOU: %', SQLERRM;
  END;
  
  -- Limpar (opcional)
  -- DELETE FROM transaction_splits WHERE transaction_id = test_transaction_id;
  -- DELETE FROM transactions WHERE id = test_transaction_id;
  
END $$;

-- ==============================================================================
-- RESUMO DOS TESTES
-- ==============================================================================

SELECT 
  '✅ TESTES CONCLUÍDOS' as status,
  'Verifique as mensagens acima para ver resultados' as mensagem;

