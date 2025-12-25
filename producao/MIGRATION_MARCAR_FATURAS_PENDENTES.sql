-- ============================================================================
-- MIGRATION: Marcar Faturas Importadas como Pendentes
-- ============================================================================
-- Data: 25/12/2024
-- Objetivo: Adicionar isPendingInvoice = true em faturas importadas não pagas
-- 
-- PROBLEMA:
-- Faturas importadas antes da correção não têm o campo isPendingInvoice
-- e aparecem incorretamente na lista de transações
--
-- SOLUÇÃO:
-- Identificar faturas importadas (description LIKE 'Fatura Importada%')
-- que não foram pagas (is_settled = false) e adicionar o campo
-- ============================================================================

-- PASSO 1: Verificar quantas faturas serão afetadas
SELECT 
    id,
    description,
    amount,
    date,
    account_id,
    is_settled,
    (metadata->>'isPendingInvoice')::boolean as current_flag
FROM transactions
WHERE description LIKE 'Fatura Importada%'
  AND is_settled = false
  AND deleted = false
ORDER BY date DESC;

-- PASSO 2: Atualizar as faturas (EXECUTE APENAS SE O PASSO 1 ESTIVER CORRETO)
UPDATE transactions
SET metadata = COALESCE(metadata, '{}'::jsonb) || '{"isPendingInvoice": true}'::jsonb
WHERE description LIKE 'Fatura Importada%'
  AND is_settled = false
  AND deleted = false
  AND (metadata->>'isPendingInvoice') IS NULL;

-- PASSO 3: Verificar resultado
SELECT 
    id,
    description,
    amount,
    date,
    account_id,
    is_settled,
    (metadata->>'isPendingInvoice')::boolean as is_pending_invoice
FROM transactions
WHERE description LIKE 'Fatura Importada%'
  AND is_settled = false
  AND deleted = false
ORDER BY date DESC;

-- ============================================================================
-- NOTAS:
-- 1. Esta migration é SEGURA - apenas adiciona um campo no metadata
-- 2. Não afeta transações já pagas (is_settled = true)
-- 3. Não afeta outras transações
-- 4. Pode ser revertida removendo o campo do metadata se necessário
-- ============================================================================

-- REVERTER (se necessário):
-- UPDATE transactions
-- SET metadata = metadata - 'isPendingInvoice'
-- WHERE description LIKE 'Fatura Importada%';
