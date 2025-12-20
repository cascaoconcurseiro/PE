-- ==============================================================================
-- FIX: FORÇAR RESSINCRONIZAÇÃO DE TRANSAÇÕES ÓRFÃS
-- OBJETIVO: Chamar sync_shared_transaction para itens identificados como missing
-- ==============================================================================

DO $$
DECLARE
    r RECORD;
    v_count INT := 0;
BEGIN
    RAISE NOTICE 'Iniciando correção de transações órfãs...';
    
    FOR r IN 
        WITH shared_txs AS (
            SELECT 
                t.id as tx_id,
                t.user_id as owner_id,
                (split->>'memberId')::UUID as target_member_id,
                (split->>'assignedAmount')::NUMERIC as assigned_amount,
                t.date
            FROM public.transactions t
            CROSS JOIN LATERAL jsonb_array_elements(t.shared_with) as split
            WHERE t.is_shared = true
              AND t.deleted = false
              AND (t.payer_id IS NULL OR t.payer_id = 'me')
        ),
        missing_mirrors AS (
            SELECT DISTINCT st.tx_id
            FROM shared_txs st
            JOIN public.family_members fm ON st.target_member_id = fm.id
            WHERE fm.linked_user_id IS NOT NULL 
              AND fm.linked_user_id != st.owner_id
              AND NOT EXISTS (
                  SELECT 1 FROM public.transactions t2
                  WHERE t2.source_transaction_id = st.tx_id
                    AND t2.user_id = fm.linked_user_id
                    AND t2.deleted = false
              )
              AND NOT EXISTS (
                  -- Heurística de segurança para evitar duplicar antigos manual/buggy mirrors
                  SELECT 1 FROM public.transactions t3
                  WHERE t3.user_id = fm.linked_user_id
                    AND t3.date = st.date
                    AND ABS(t3.amount - st.assigned_amount) < 0.01
                    AND t3.payer_id = st.owner_id::text
                    AND t3.deleted = false
              )
        )
        SELECT tx_id FROM missing_mirrors
    LOOP
        BEGIN
            PERFORM public.sync_shared_transaction(r.tx_id);
            v_count := v_count + 1;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Erro ao sincronizar %: %', r.tx_id, SQLERRM;
        END;
    END LOOP;
    
    RAISE NOTICE 'Correção finalizada. Total de transações ressincronizadas: %', v_count;
END $$;
