-- ==============================================================================
-- SCRIPT DE DIAGNÓSTICO: Verificar valores de TYPE existentes
-- Execute este script para ver quais valores precisam ser corrigidos
-- ==============================================================================

-- Verificar TODOS os tipos de conta existentes (com contagem)
SELECT 
  type,
  COUNT(*) as quantidade,
  string_agg(DISTINCT name, ', ') FILTER (WHERE name IS NOT NULL) as exemplos_nomes
FROM accounts
GROUP BY type
ORDER BY quantidade DESC;

-- Verificar quais tipos são VÁLIDOS vs INVÁLIDOS
SELECT 
  CASE 
    WHEN type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER') 
    THEN 'VÁLIDO' 
    ELSE 'INVÁLIDO' 
  END as status,
  type,
  COUNT(*) as quantidade
FROM accounts
GROUP BY status, type
ORDER BY status, quantidade DESC;

-- Verificar TODOS os tipos de transação existentes
SELECT 
  type,
  COUNT(*) as quantidade
FROM transactions
GROUP BY type
ORDER BY quantidade DESC;

-- Verificar quais tipos de transação são VÁLIDOS vs INVÁLIDOS
SELECT 
  CASE 
    WHEN type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA') 
    THEN 'VÁLIDO' 
    ELSE 'INVÁLIDO' 
  END as status,
  type,
  COUNT(*) as quantidade
FROM transactions
GROUP BY status, type
ORDER BY status, quantidade DESC;

-- Resumo: Quantos registros precisam ser corrigidos?
SELECT 
  'accounts' as tabela,
  COUNT(*) as registros_invalidos,
  array_agg(DISTINCT type) as tipos_invalidos
FROM accounts
WHERE type NOT IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER')

UNION ALL

SELECT 
  'transactions' as tabela,
  COUNT(*) as registros_invalidos,
  array_agg(DISTINCT type) as tipos_invalidos
FROM transactions
WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA');

