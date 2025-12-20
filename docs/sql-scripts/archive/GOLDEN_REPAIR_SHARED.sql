-- ==============================================================================
-- GOLDEN REPAIR: INTEGRIDADE DE TRANSAÇÕES COMPARTILHADAS
-- ==============================================================================

DO $$
DECLARE
    v_updated_links INT := 0;
    v_updated_flags INT := 0;
    v_new_mirrors INT := 0;
    r RECORD;
BEGIN
    RAISE NOTICE 'Iniciando reparo de integridade...';

    -- 1. VINCULAR MIRRORS ÓRFÃOS (Heuristic linking)
    -- Isso restaura o source_transaction_id em mirrors antigos que perderam o vínculo
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
            -- Heurística de valor: o mirror deve ter o valor de um dos splits
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
    RAISE NOTICE '% mirrors órfãos foram vinculados.', v_updated_links;

    -- 2. CORRIGIR ATRIBUTOS DE EXIBIÇÃO (is_shared e type)
    -- Garante que transações que possuem payer_id (são mirrors) sejam visíveis como compartilhadas
    UPDATE public.transactions
    SET is_shared = true, 
        type = 'DESPESA', 
        updated_at = NOW()
    WHERE (payer_id IS NOT NULL AND payer_id != 'me')
      AND (is_shared = false OR type != 'DESPESA')
      AND deleted = false;
      
    GET DIAGNOSTICS v_updated_flags = ROW_COUNT;
    RAISE NOTICE '% transações tiveram atributos corrigidos (is_shared/type).', v_updated_flags;

    -- 3. FORÇAR RESSINCRONIZAÇÃO DE ITENS RESTANTES (Missing)
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
            v_new_mirrors := v_new_mirrors + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao sincronizar %: %', r.id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE '% novos mirrors foram criados via resync.', v_new_mirrors;
    RAISE NOTICE 'Reparo concluído com sucesso.';
END $$;
