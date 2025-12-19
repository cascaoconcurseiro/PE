-- ==============================================================================
-- DIAGNÓSTICO: ESPELHAMENTO DE TRANSAÇÕES COMPARTILHADAS
-- DATA: 2025-12-19
-- ==============================================================================

-- 1. VERIFICAR SE A FUNÇÃO sync_shared_transaction EXISTE
SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_name = 'sync_shared_transaction'
  AND routine_schema = 'public';

-- 2. VERIFICAR MEMBROS DA FAMÍLIA E SEUS VÍNCULOS
SELECT 
    fm.id as member_id,
    fm.name as member_name,
    fm.email as member_email,
    fm.linked_user_id,
    fm.user_id as owner_user_id,
    up.name as linked_user_name,
    up.email as linked_user_email
FROM public.family_members fm
LEFT JOIN public.user_profiles up ON fm.linked_user_id = up.id
WHERE fm.deleted = false
ORDER BY fm.user_id, fm.name;

-- 3. VERIFICAR TRANSAÇÕES COMPARTILHADAS RECENTES
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.is_shared,
    t.shared_with,
    t.payer_id,
    t.user_id,
    t.domain
FROM public.transactions t
WHERE t.is_shared = true
  AND t.deleted = false
  AND t.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY t.created_at DESC
LIMIT 20;

-- 4. VERIFICAR SE EXISTEM MIRRORS PARA AS TRANSAÇÕES COMPARTILHADAS
-- (Transações onde payer_id é um UUID de outro usuário)
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.payer_id,
    t.user_id,
    up.name as owner_name
FROM public.transactions t
LEFT JOIN public.user_profiles up ON t.user_id = up.id
WHERE t.payer_id IS NOT NULL 
  AND t.payer_id != 'me'
  AND t.deleted = false
  AND t.date >= CURRENT_DATE - INTERVAL '7 days'
ORDER BY t.created_at DESC
LIMIT 20;

-- 5. IDENTIFICAR TRANSAÇÕES COMPARTILHADAS SEM MIRROR
-- (Transações onde shared_with tem membros com linked_user_id mas não existe mirror)
WITH shared_txs AS (
    SELECT 
        t.id as tx_id,
        t.description,
        t.amount,
        t.date,
        t.user_id as owner_id,
        (split->>'memberId')::UUID as member_id,
        (split->>'assignedAmount')::NUMERIC as assigned_amount
    FROM public.transactions t,
         jsonb_array_elements(t.shared_with) as split
    WHERE t.is_shared = true
      AND t.deleted = false
      AND t.shared_with IS NOT NULL
      AND jsonb_array_length(t.shared_with) > 0
      AND t.payer_id IS NULL  -- Apenas transações originais (não mirrors)
),
members_with_links AS (
    SELECT 
        st.*,
        fm.linked_user_id,
        fm.name as member_name
    FROM shared_txs st
    JOIN public.family_members fm ON st.member_id = fm.id
    WHERE fm.linked_user_id IS NOT NULL
)
SELECT 
    mwl.*,
    CASE 
        WHEN EXISTS (
            SELECT 1 FROM public.transactions t2
            WHERE t2.user_id = mwl.linked_user_id
              AND t2.payer_id = mwl.owner_id::text
              AND t2.date = mwl.date
              AND t2.amount = mwl.assigned_amount
              AND t2.deleted = false
        ) THEN 'MIRROR EXISTS'
        ELSE 'MIRROR MISSING'
    END as mirror_status
FROM members_with_links mwl
WHERE mwl.date >= CURRENT_DATE - INTERVAL '30 days'
ORDER BY mwl.date DESC;

-- 6. FORÇAR RESYNC DE TRANSAÇÕES COMPARTILHADAS RECENTES
-- (Descomente para executar)
/*
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN 
        SELECT id 
        FROM public.transactions 
        WHERE is_shared = true 
          AND deleted = false
          AND shared_with IS NOT NULL
          AND jsonb_array_length(shared_with) > 0
          AND date >= CURRENT_DATE - INTERVAL '7 days'
    LOOP
        PERFORM public.sync_shared_transaction(r.id);
        RAISE NOTICE 'Synced transaction: %', r.id;
    END LOOP;
END $$;
*/
