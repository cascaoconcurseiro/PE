-- ==============================================================================
-- SCRIPT DE DIAGNÓSTICO: Verificar tipos existentes
-- Execute este script ANTES da migration de consolidação
-- ==============================================================================

-- Verificar tipos de conta existentes
SELECT 
  type,
  COUNT(*) as quantidade,
  array_agg(DISTINCT name) FILTER (WHERE name IS NOT NULL) as exemplos
FROM accounts
GROUP BY type
ORDER BY quantidade DESC;

-- Verificar tipos de transação existentes
SELECT 
  type,
  COUNT(*) as quantidade
FROM transactions
GROUP BY type
ORDER BY quantidade DESC;

-- Verificar se há valores NULL
SELECT 
  'accounts.type NULL' as campo,
  COUNT(*) as quantidade
FROM accounts
WHERE type IS NULL

UNION ALL

SELECT 
  'transactions.type NULL' as campo,
  COUNT(*) as quantidade
FROM transactions
WHERE type IS NULL;

