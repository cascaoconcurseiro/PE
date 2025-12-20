-- ==============================================================================
-- DELTA DIAGNOSTIC: WESLEY (10) vs FRAN (8)
-- DATA: 2025-12-20
-- ==============================================================================

-- 1. COMPARATIVO LADO A LADO
-- Mostra o que Wesley tem e o status do espelho na Fran
WITH wesley_txs AS (
    SELECT 
        id as orig_id,
        date,
        description,
        amount,
        shared_with
    FROM public.transactions
    WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'
      AND date >= '2026-01-01' AND date <= '2026-01-31'
      AND deleted = false
),
fran_txs AS (
    SELECT 
        id as mirror_id,
        source_transaction_id,
        description as mirror_desc,
        amount as mirror_amount
    FROM public.transactions
    WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6'
      AND date >= '2026-01-01' AND date <= '2026-01-31'
      AND deleted = false
)
SELECT 
    w.date,
    w.description as wesley_item,
    w.amount,
    f.mirror_id IS NOT NULL as sync_ok,
    w.shared_with,
    w.orig_id
FROM wesley_txs w
LEFT JOIN fran_txs f ON f.source_transaction_id = w.orig_id
ORDER BY w.date ASC, w.description ASC;

-- 2. VERIFICAR SE FRAN TEM ALGUM ITEM EXTRA QUE NÃO VEIO DO WESLEY
SELECT 
    id, date, description, amount
FROM public.transactions
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6'
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false
  AND (source_transaction_id IS NULL OR source_transaction_id NOT IN (
      SELECT id FROM public.transactions WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'
  ));

-- 3. VERIFICAR LINKS DE FAMÍLIA (CRÍTICO)
-- Precisamos saber qual o memberId que o Wesley usa para a Fran
SELECT id, name, linked_user_id 
FROM public.family_members 
WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'; -- Membros que o Wesley vê
