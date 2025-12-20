-- ==============================================================================
-- DIAGNÓSTICO DE DISCREPÂNCIA: TRANSAÇÕES SEM ESPELHAMENTO
-- OBJETIVO: Listar todas as transações onde is_shared = true mas falta o mirror
-- ==============================================================================

WITH shared_txs AS (
    -- Busca todas as transações compartilhadas originais (payer_id é null ou 'me')
    SELECT 
        t.id as tx_id,
        t.description,
        t.amount,
        t.date,
        t.user_id as owner_id,
        up.name as owner_name,
        (split->>'memberId')::UUID as target_member_id,
        (split->>'assignedAmount')::NUMERIC as assigned_amount
    FROM public.transactions t
    JOIN public.user_profiles up ON t.user_id = up.id
    CROSS JOIN LATERAL jsonb_array_elements(t.shared_with) as split
    WHERE t.is_shared = true
      AND t.deleted = false
      AND t.shared_with IS NOT NULL
      AND jsonb_array_length(t.shared_with) > 0
      AND (t.payer_id IS NULL OR t.payer_id = 'me')
),
members_to_sync AS (
    -- Vincula o membro ao usuário real para verificar o espelhamento
    SELECT 
        st.*,
        fm.linked_user_id,
        fm.name as member_name
    FROM shared_txs st
    JOIN public.family_members fm ON st.target_member_id = fm.id
    WHERE fm.linked_user_id IS NOT NULL 
      AND fm.linked_user_id != st.owner_id
)
SELECT 
    m.*,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.transactions t2
            WHERE t2.source_transaction_id = m.tx_id
              AND t2.user_id = m.linked_user_id
              AND t2.deleted = false
        ) THEN 'MIRROR_OK'
        WHEN EXISTS (
            -- Fallback por data e valor se o source_transaction_id estiver nulo no mirror (versões antigas)
            SELECT 1 FROM public.transactions t3
            WHERE t3.user_id = m.linked_user_id
              AND t3.date = m.date
              AND ABS(t3.amount - m.assigned_amount) < 0.01
              AND t3.deleted = false
              AND t3.payer_id = m.owner_id::text
        ) THEN 'MIRROR_FOUND_BY_HEURISTIC'
        ELSE 'MIRROR_MISSING'
    END as status
FROM members_to_sync m
ORDER BY m.date DESC, m.tx_id;
