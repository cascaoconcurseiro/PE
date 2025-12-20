-- ==============================================================================
-- DEEP DIAGNOSTIC: JANUARY DISCREPANCY (10 vs 9)
-- DATA: 2025-12-20
-- ==============================================================================

-- 1. LISTAR DETALHES DAS 10 TRANSAÇÕES DE JANEIRO DO USUÁRIO A
SELECT 
    t.id, 
    t.date, 
    t.description, 
    t.amount, 
    t.is_shared,
    t.shared_with,
    -- Verificar mirror existente
    (SELECT count(*) FROM public.transactions m WHERE m.source_transaction_id = t.id AND m.deleted = false) as mirror_exists,
    -- Verificar se o membro no split tem link
    ARRAY(
        SELECT fm.name || ' (Pessoa: ' || COALESCE(fm.linked_user_id::text, 'SEM LINK') || ')'
        FROM jsonb_array_elements(t.shared_with) s
        JOIN public.family_members fm ON (s->>'memberId')::UUID = fm.id
    ) as member_links
FROM public.transactions t
WHERE t.user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5' 
  AND t.date >= '2026-01-01' AND t.date <= '2026-01-31'
  AND t.deleted = false
ORDER BY t.date ASC, t.description ASC;

-- 2. VERIFICAR SE EXISTE ALGUMA TRANSAÇÃO EM JANEIRO PARA O USUÁRIO B QUE NÃO VEIO DO A
SELECT 
    id, date, description, amount, source_transaction_id
FROM public.transactions
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' 
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false
  AND source_transaction_id IS NULL;
