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

-- 4. VERIFICAR TRANSAÇÕES FANTASMAS (MANTIDAS NA FRAN MAS DELETADAS NO WESLEY)
SELECT 
    t_mirror.id as mirror_id,
    t_mirror.date,
    t_mirror.description,
    t_mirror.amount,
    t_mirror.source_transaction_id,
    CASE 
        WHEN t_orig.id IS NULL THEN 'Original Não Existe (Hard Delete)'
        WHEN t_orig.deleted = true THEN 'Original Está Deletado (Soft Delete)'
        ELSE 'Ok'
    END as status_no_dono
FROM public.transactions t_mirror
LEFT JOIN public.transactions t_orig ON t_mirror.source_transaction_id = t_orig.id
WHERE t_mirror.user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' -- ID da Fran
  AND t_mirror.source_transaction_id IS NOT NULL
  AND (t_orig.id IS NULL OR t_orig.deleted = true)
  AND t_mirror.deleted = false;
-- 5. INSPEÇÃO BRUTA: POR QUE ELA NÃO SUMIU?
-- Vamos ver TUDO dessa transação na conta da Fran
SELECT 
    id, 
    date, 
    description, 
    amount, 
    type,
    category,
    account_id,
    destination_account_id,
    source_transaction_id,
    is_shared,
    payer_id,
    deleted,
    is_installment,
    current_installment,
    total_installments
FROM public.transactions
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' -- ID da Fran
  AND description ILIKE '%Seguro - carro%'
  AND deleted = false;

-- 6. VERIFICAR SE EXISTE ALGUM VALOR NULL CRÍTICO QUE CAUSA NaN
SELECT count(*) as null_amounts 
FROM transactions 
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' 
  AND amount IS NULL;
