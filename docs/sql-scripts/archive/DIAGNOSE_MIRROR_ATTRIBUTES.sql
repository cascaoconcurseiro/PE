-- ==========================================================
-- DIAGNÓSTICO DETALHADO: COMPARAÇÃO ATRIBUTOS MIRROR
-- ==========================================================

WITH original_txs AS (
    SELECT 
        id as original_id,
        description,
        amount,
        date,
        type,
        is_shared,
        trip_id,
        jsonb_array_length(shared_with) as splits_count
    FROM public.transactions
    WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5' -- Wesley
      AND date = '2026-01-05'
      AND is_shared = true
      AND deleted = false
)
SELECT 
    o.original_id,
    o.description,
    o.amount as orig_amount,
    o.type as orig_type,
    o.is_shared as orig_shared,
    o.trip_id as orig_trip,
    m.id as mirror_id,
    m.type as mirror_type,
    m.is_shared as mirror_shared,
    m.trip_id as mirror_trip,
    m.payer_id as mirror_payer,
    m.deleted as mirror_deleted
FROM original_txs o
LEFT JOIN public.transactions m ON (
    m.source_transaction_id = o.original_id 
    OR (
        m.user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' -- Fran
        AND m.date = o.date 
        AND ABS(m.amount - (o.amount / o.splits_count)) < 0.01 -- Heurística se o split for igual (ajustar se necessário)
        AND m.payer_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'
    )
)
WHERE m.user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' OR m.id IS NULL;
