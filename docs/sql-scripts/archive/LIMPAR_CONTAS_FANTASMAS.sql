-- =====================================================
-- SCRIPT: Limpar Contas Fantasmas
-- Data: 18/12/2025
-- Objetivo: Identificar e remover contas que não existem mais
-- =====================================================

-- 1. DIAGNÓSTICO: Ver todas as contas do usuário atual
SELECT 
    id,
    name,
    type,
    currency,
    balance,
    created_at,
    updated_at
FROM accounts
WHERE user_id = auth.uid()
ORDER BY name;

-- 2. VERIFICAR: Contas com transações órfãs
-- (transações apontando para contas que não existem)
SELECT DISTINCT 
    t.account_id,
    t.description,
    t.date,
    CASE WHEN a.id IS NULL THEN 'CONTA NÃO EXISTE' ELSE a.name END as conta_status
FROM transactions t
LEFT JOIN accounts a ON t.account_id = a.id
WHERE t.user_id = auth.uid()
  AND t.deleted = false
  AND a.id IS NULL;

-- 3. LISTAR: Contas duplicadas (mesmo nome)
SELECT 
    name,
    COUNT(*) as quantidade,
    STRING_AGG(id::text, ', ') as ids
FROM accounts
WHERE user_id = auth.uid()
GROUP BY name
HAVING COUNT(*) > 1;

-- =====================================================
-- AÇÕES DE LIMPEZA (EXECUTE COM CUIDADO!)
-- =====================================================

-- 4. DELETAR contas específicas por ID
-- Substitua 'ID_DA_CONTA_AQUI' pelo ID real
-- DELETE FROM accounts WHERE id = 'ID_DA_CONTA_AQUI' AND user_id = auth.uid();

-- 5. DELETAR contas duplicadas (manter apenas a mais antiga)
-- CUIDADO: Isso vai deletar contas! Faça backup antes.
/*
WITH duplicates AS (
    SELECT id, name,
           ROW_NUMBER() OVER (PARTITION BY name ORDER BY created_at ASC) as rn
    FROM accounts
    WHERE user_id = auth.uid()
)
DELETE FROM accounts 
WHERE id IN (
    SELECT id FROM duplicates WHERE rn > 1
);
*/

-- 6. LIMPAR transações órfãs (sem conta válida)
/*
UPDATE transactions 
SET deleted = true 
WHERE user_id = auth.uid()
  AND account_id NOT IN (SELECT id FROM accounts WHERE user_id = auth.uid())
  AND deleted = false;
*/

-- 7. RECALCULAR saldos após limpeza
-- SELECT public.recalculate_all_balances();
