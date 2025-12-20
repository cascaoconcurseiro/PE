-- ==============================================================================
-- REPAIR SHARED AND DELETION SYNC
-- DATA: 2025-12-20
-- OBJETIVO: 
--   1. Restaurar propagação de exclusão (soft-delete)
--   2. Corrigir discrepâncias entre usuários (A: 10, B: 9)
--   3. Garantir que mirrors tenham source_transaction_id
-- ==============================================================================

BEGIN;

-- 1. FUNÇÃO PARA PROPAGAR EXCLUSÃO (SOFT-DELETE)
CREATE OR REPLACE FUNCTION public.propagate_transaction_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a transação original for marcada como excluída, marcar os mirrors também
    IF (OLD.deleted = false AND NEW.deleted = true) THEN
        UPDATE public.transactions
        SET deleted = true, updated_at = NOW()
        WHERE source_transaction_id = NEW.id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_propagate_deletion ON public.transactions;
CREATE TRIGGER trg_propagate_deletion
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    WHEN (OLD.deleted IS DISTINCT FROM NEW.deleted)
    EXECUTE FUNCTION public.propagate_transaction_deletion();

-- 2. REPARO DE INTEGRIDADE (AUTO-REPAIR)
DO $$
DECLARE
    v_updated_links INT := 0;
    v_repaired_mirrors INT := 0;
    r RECORD;
BEGIN
    -- A. Vincular mirrors órfãos por heurística
    WITH orphans AS (
        SELECT t_mirror.id as mirror_id, t_orig.id as orig_id
        FROM public.transactions t_mirror
        JOIN public.transactions t_orig ON (
            t_mirror.date = t_orig.date 
            AND t_mirror.payer_id = t_orig.user_id::text
            AND t_mirror.user_id != t_orig.user_id
            AND t_mirror.deleted = false
            AND t_orig.deleted = false
            AND t_orig.is_shared = true
            -- Heurística de valor (split match)
            AND EXISTS (
                SELECT 1 FROM jsonb_array_elements(t_orig.shared_with) s 
                WHERE (s->>'assignedAmount')::NUMERIC = t_mirror.amount
            )
        )
        WHERE t_mirror.source_transaction_id IS NULL
    )
    UPDATE public.transactions t
    SET source_transaction_id = o.orig_id, updated_at = NOW()
    FROM orphans o
    WHERE t.id = o.mirror_id;
    
    GET DIAGNOSTICS v_updated_links = ROW_COUNT;
    RAISE NOTICE '% mirrors órfãos vinculados.', v_updated_links;

    -- B. Recriar mirrors faltantes (Garante que User B veja o que User A tem)
    FOR r IN 
        SELECT DISTINCT t.id 
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
            v_repaired_mirrors := v_repaired_mirrors + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao processar resync para %: %', r.id, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '% transações espelhadas recriadas/corrigidas.', v_repaired_mirrors;
END $$;

COMMIT;

-- VERIFICAÇÃO FINAL
SELECT 
    (SELECT count(*) FROM public.transactions WHERE is_shared = true AND deleted = false AND (payer_id IS NULL OR payer_id = 'me')) as originais,
    (SELECT count(*) FROM public.transactions WHERE source_transaction_id IS NOT NULL AND deleted = false) as espelhos;
