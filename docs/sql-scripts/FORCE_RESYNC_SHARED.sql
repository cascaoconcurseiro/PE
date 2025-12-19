-- ==============================================================================
-- FORÇAR RESYNC DE TRANSAÇÕES COMPARTILHADAS SEM MIRROR
-- DATA: 2025-12-19
-- ==============================================================================

-- 1. VERIFICAR SE A FUNÇÃO sync_shared_transaction EXISTE
SELECT routine_name FROM information_schema.routines 
WHERE routine_name = 'sync_shared_transaction' AND routine_schema = 'public';

-- 2. FORÇAR RESYNC DAS TRANSAÇÕES ESPECÍFICAS (Seguro - carro)
DO $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    FOR r IN 
        SELECT id, description
        FROM public.transactions 
        WHERE is_shared = true 
          AND deleted = false
          AND shared_with IS NOT NULL
          AND jsonb_array_length(shared_with) > 0
          AND description LIKE 'Seguro - carro%'
    LOOP
        BEGIN
            PERFORM public.sync_shared_transaction(r.id);
            v_count := v_count + 1;
            RAISE NOTICE 'Synced: % - %', r.id, r.description;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'ERRO ao sincronizar %: %', r.id, SQLERRM;
        END;
    END LOOP;
    RAISE NOTICE 'Total sincronizado: %', v_count;
END $$;

-- 3. VERIFICAR SE OS MIRRORS FORAM CRIADOS
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.payer_id,
    t.user_id
FROM public.transactions t
WHERE t.payer_id IS NOT NULL 
  AND t.payer_id != 'me'
  AND t.deleted = false
  AND t.description LIKE '%Seguro - carro%'
ORDER BY t.date;
