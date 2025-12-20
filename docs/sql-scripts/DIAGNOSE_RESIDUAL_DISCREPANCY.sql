-- ==============================================================================
-- DIAGNÓSTICO DE DISCREPÂNCIA RESIDUAL (67 vs 58)
-- DATA: 2025-12-20
-- ==============================================================================

-- 1. IDENTIFICAR QUAIS TRANSAÇÕES ORIGINAIS NÃO TÊM ESPELHOS
SELECT 
    t.id, 
    t.date, 
    t.description, 
    t.amount,
    t.shared_with,
    (SELECT count(*) FROM public.transactions m WHERE m.source_transaction_id = t.id) as mirror_count,
    -- Verificar se os membros no shared_with têm user_id vinculado
    ARRAY(
        SELECT fm.name || ' (Link: ' || COALESCE(fm.linked_user_id::text, 'NULO') || ')'
        FROM jsonb_array_elements(t.shared_with) s
        JOIN public.family_members fm ON (s->>'memberId')::UUID = fm.id
    ) as members_status
FROM public.transactions t
WHERE t.is_shared = true 
  AND t.deleted = false 
  AND (t.payer_id IS NULL OR t.payer_id = 'me')
  AND NOT EXISTS (
      SELECT 1 FROM public.transactions m 
      WHERE m.source_transaction_id = t.id 
      AND m.deleted = false
  )
ORDER BY t.date DESC;

-- 2. VERIFICAR SE EXISTEM ESPELHOS SEM source_transaction_id (ÓRFÃOS QUE A HEURÍSTICA LINGUAGEM NÃO PEGOU)
SELECT 
    id, date, description, amount, user_id, payer_id
FROM public.transactions
WHERE (payer_id IS NOT NULL AND payer_id != 'me')
  AND source_transaction_id IS NULL
  AND deleted = false;

-- 3. VERIFICAR SE HÁ ERROS DE TRIP MIRROR (Sync falha se a viagem não for espelhada primeiro)
SELECT 
    t.id, t.description, t.trip_id
FROM public.transactions t
WHERE t.is_shared = true 
  AND t.deleted = false
  AND t.trip_id IS NOT NULL
  AND NOT EXISTS (
      -- Tentar achar o espelho da viagem para algum dos participantes
      SELECT 1 FROM public.trips tr
      WHERE tr.source_trip_id = t.trip_id
  );
