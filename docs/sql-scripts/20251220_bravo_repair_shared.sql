-- ==============================================================================
-- BRAVO REPAIR: FINAL SHARED SYNC AND LINKING
-- DATA: 2025-12-20
-- OBJETIVO: 
--   1. Vincular os 10 "Seguro - carro" órfãos
--   2. Forçar criação dos espelhos para Geladeira, Carro-ar e outros (totalizando 9)
--   3. Garantir limpeza de duplicatas
-- ==============================================================================

BEGIN;

-- 1. VINCULAR MIRRORS ÓRFÃOS (Aprimorado)
-- Removemos sufixos como "(Wesley)" da descrição para garantir o match
WITH orphans_match AS (
    SELECT 
        tm.id as mirror_id, 
        to_orig.id as orig_id
    FROM public.transactions tm
    JOIN public.transactions to_orig ON (
        tm.date = to_orig.date 
        AND tm.payer_id = to_orig.user_id::text
        AND tm.user_id != to_orig.user_id
        AND tm.deleted = false
        AND to_orig.deleted = false
        AND to_orig.is_shared = true
        -- Match de valor (split)
        AND EXISTS (
            SELECT 1 FROM jsonb_array_elements(to_orig.shared_with) s 
            WHERE ABS((s->>'assignedAmount')::NUMERIC - tm.amount) < 0.01
        )
        -- Match de descrição flexível (removendo sufixos entre parênteses)
        AND (
            tm.description LIKE to_orig.description || '%'
            OR 
            REGEXP_REPLACE(tm.description, ' \(.*?\)$', '') = to_orig.description
        )
    )
    WHERE tm.source_transaction_id IS NULL
      AND (tm.payer_id IS NOT NULL AND tm.payer_id != 'me')
)
UPDATE public.transactions t
SET source_transaction_id = om.orig_id, 
    updated_at = NOW()
FROM orphans_match om
WHERE t.id = om.mirror_id;

-- 2. CORREÇÃO DE CATEGORIA E DOMÍNIO PARA MIRRORS
UPDATE public.transactions tm
SET category = to_orig.category,
    domain = CASE WHEN to_orig.trip_id IS NOT NULL THEN 'TRAVEL' ELSE 'SHARED' END,
    updated_at = NOW()
FROM public.transactions to_orig
WHERE tm.source_transaction_id = to_orig.id
  AND (tm.category != to_orig.category OR tm.domain IS NULL);

-- 3. FORÇAR RESSINCRONIZAÇÃO (BRAVO FORCE)
-- Tenta criar os mirrors que ainda não existem de jeito nenhum
DO $$
DECLARE
    r RECORD;
    v_new_mirrors INT := 0;
BEGIN
    FOR r IN 
        SELECT DISTINCT t.id, t.description
        FROM public.transactions t
        CROSS JOIN LATERAL jsonb_array_elements(t.shared_with) as split
        JOIN public.family_members fm ON (split->>'memberId')::UUID = fm.id
        WHERE t.is_shared = true 
          AND t.deleted = false
          AND (t.payer_id IS NULL OR t.payer_id = 'me')
          AND fm.linked_user_id IS NOT NULL
          AND fm.linked_user_id != t.user_id
          AND NOT EXISTS (
              SELECT 1 FROM public.transactions t2 
              WHERE t2.source_transaction_id = t.id 
                AND t2.user_id = fm.linked_user_id
                AND t2.deleted = false
          )
    LOOP
        BEGIN
            PERFORM public.sync_shared_transaction(r.id);
            v_new_mirrors := v_new_mirrors + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao sincronizar % (%): %', r.id, r.description, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Total de % novos espelhos criados.', v_new_mirrors;
END $$;

COMMIT;

-- VERIFICAÇÃO FINAL POR PERÍODO (Exemplo: Janeiro 2026)
SELECT 
    'Usuário A (Wesley)' as usuario,
    count(*) as total_jan
FROM public.transactions 
WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5' 
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false
UNION ALL
SELECT 
    'Usuário B (Fran)' as usuario,
    count(*) as total_jan
FROM public.transactions 
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' 
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false;
