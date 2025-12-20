-- ==============================================================================
-- CHARLIE REPAIR: JANUARY PARITY (10 vs 10)
-- DATA: 2025-12-20
-- OBJETIVO: 
--   1. Remover o "fantasma" do Seguro (2/10) que apareceu em Jan para Fran (Usuário B)
--   2. Sincronizar à força "Geladeira" e "Carro - ar" para Fran
--   3. Garantir que o contador de Janeiro seja EXATAMENTE 10 para ambos.
-- ==============================================================================

BEGIN;

-- 1. REMOVER TRANSAÇÕES GHOST NO USUÁRIO B (Jan 2026)
-- Transações que têm payer_id mas não têm source_transaction_id (órfãs reais que não batem com nada)
-- Especialmente o "Seguro - carro (2/10)" que o diagnóstico mostrou estar sem vínculo.
UPDATE public.transactions 
SET deleted = true, updated_at = NOW()
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' -- Fran
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND source_transaction_id IS NULL
  AND payer_id IS NOT NULL;

-- 2. FORÇAR CRIAÇÃO DOS ESPELHOS FALTANTES (A -> B)
-- Focar em Janeiro/2026
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
        WHERE t.user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5' -- Wesley (Origem)
          AND t.date >= '2026-01-01' AND t.date <= '2026-01-31'
          AND t.is_shared = true 
          AND t.deleted = false
          AND fm.linked_user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' -- Fran (Destino)
          -- Garantir que não exista espelho ativo
          AND NOT EXISTS (
              SELECT 1 FROM public.transactions t2 
              WHERE t2.source_transaction_id = t.id 
                AND t2.user_id = fm.linked_user_id
                AND t2.deleted = false
          )
    LOOP
        BEGIN
            -- Chamar o motor de sincronização para cada item faltante
            PERFORM public.sync_shared_transaction(r.id);
            v_new_mirrors := v_new_mirrors + 1;
            RAISE NOTICE 'Sincronizado: %', r.description;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao sincronizar %: %', r.description, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Total de % novos espelhos criados para Fran em Janeiro.', v_new_mirrors;
END $$;

COMMIT;

-- VERIFICAÇÃO FINAL DE JANEIRO 2026
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
