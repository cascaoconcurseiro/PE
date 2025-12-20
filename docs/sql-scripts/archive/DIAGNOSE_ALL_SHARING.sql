-- ==============================================================================
-- DIAGNÓSTICO COMPLETO: COMPARTILHAMENTO (TRANSAÇÕES E VIAGENS)
-- DATA: 2025-12-19
-- ==============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAR FUNÇÕES DE SINCRONIZAÇÃO
-- ============================================================================

SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name IN ('sync_shared_transaction', 'sync_shared_trip', 'handle_trip_sharing')
  AND routine_schema = 'public';

-- ============================================================================
-- PARTE 2: VERIFICAR TRIGGERS ATIVOS
-- ============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    event_object_table,
    action_statement
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND event_object_table IN ('transactions', 'trips')
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- PARTE 3: MEMBROS DA FAMÍLIA COM VÍNCULOS
-- ============================================================================

SELECT 
    fm.id as member_id,
    fm.name as member_name,
    fm.email as member_email,
    fm.linked_user_id,
    fm.user_id as owner_user_id,
    CASE WHEN fm.linked_user_id IS NOT NULL THEN 'VINCULADO' ELSE 'SEM VÍNCULO' END as status
FROM public.family_members fm
WHERE fm.deleted = false
ORDER BY fm.user_id, fm.name;

-- ============================================================================
-- PARTE 4: VIAGENS COMPARTILHADAS E SEUS MIRRORS
-- ============================================================================

-- 4.1 Viagens com participantes
SELECT 
    t.id,
    t.name,
    t.user_id as owner_id,
    t.source_trip_id,
    t.participants,
    jsonb_array_length(COALESCE(t.participants, '[]'::jsonb)) as num_participants
FROM public.trips t
WHERE t.deleted = false
  AND (t.participants IS NOT NULL AND jsonb_array_length(t.participants) > 0)
ORDER BY t.created_at DESC
LIMIT 20;

-- 4.2 Viagens que são mirrors (têm source_trip_id)
SELECT 
    t.id,
    t.name,
    t.user_id as mirror_owner_id,
    t.source_trip_id as original_trip_id,
    orig.name as original_trip_name,
    orig.user_id as original_owner_id
FROM public.trips t
LEFT JOIN public.trips orig ON t.source_trip_id = orig.id
WHERE t.deleted = false
  AND t.source_trip_id IS NOT NULL
ORDER BY t.created_at DESC
LIMIT 20;

-- 4.3 Viagens compartilhadas SEM mirror
WITH shared_trips AS (
    SELECT 
        t.id as trip_id,
        t.name,
        t.user_id as owner_id,
        (p->>'email') as participant_email
    FROM public.trips t,
         jsonb_array_elements(t.participants) as p
    WHERE t.deleted = false
      AND t.participants IS NOT NULL
      AND jsonb_array_length(t.participants) > 0
),
participants_with_users AS (
    SELECT 
        st.*,
        up.id as participant_user_id
    FROM shared_trips st
    LEFT JOIN public.user_profiles up ON LOWER(st.participant_email) = LOWER(up.email)
)
SELECT 
    pwu.*,
    CASE 
        WHEN pwu.participant_user_id IS NULL THEN 'USUÁRIO NÃO ENCONTRADO'
        WHEN EXISTS (
            SELECT 1 FROM public.trips t2
            WHERE t2.source_trip_id = pwu.trip_id
              AND t2.user_id = pwu.participant_user_id
              AND t2.deleted = false
        ) THEN 'MIRROR EXISTS'
        ELSE 'MIRROR MISSING'
    END as mirror_status
FROM participants_with_users pwu
ORDER BY pwu.trip_id;

-- ============================================================================
-- PARTE 5: TRANSAÇÕES COMPARTILHADAS SEM MIRROR (RESUMO)
-- ============================================================================

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
    mirror_status,
    COUNT(*) as total
FROM (
    SELECT 
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
) sub
GROUP BY mirror_status;

-- ============================================================================
-- PARTE 6: VERIFICAR SE RPC create_transaction CHAMA sync_shared_transaction
-- ============================================================================

SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'create_transaction'
  AND routine_schema = 'public';

-- ============================================================================
-- PARTE 7: TESTAR FUNÇÃO sync_shared_transaction MANUALMENTE
-- ============================================================================

-- Pegar uma transação compartilhada recente para teste
SELECT id, description, is_shared, shared_with
FROM public.transactions
WHERE is_shared = true
  AND deleted = false
  AND shared_with IS NOT NULL
  AND jsonb_array_length(shared_with) > 0
ORDER BY created_at DESC
LIMIT 1;
