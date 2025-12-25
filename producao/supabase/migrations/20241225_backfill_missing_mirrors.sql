-- ============================================
-- CORRIGIR TRANSAÇÕES COMPARTILHADAS SEM ESPELHOS
-- Data: 2024-12-25
-- Descrição: Criar espelhos para transações compartilhadas existentes
--            que foram criadas quando o trigger estava desabilitado
-- ============================================

BEGIN;

-- Processar todas as transações compartilhadas que não têm espelhos
DO $$
DECLARE
    v_transaction RECORD;
    v_count INTEGER := 0;
BEGIN
    -- Buscar transações compartilhadas sem espelhos
    FOR v_transaction IN
        SELECT DISTINCT t.id
        FROM public.transactions t
        WHERE t.is_shared = true
          AND t.shared_with IS NOT NULL
          AND jsonb_array_length(t.shared_with) > 0
          AND t.deleted = false
          -- Verificar se não existe espelho para pelo menos um dos membros
          AND EXISTS (
              SELECT 1
              FROM jsonb_array_elements(t.shared_with) AS split
              WHERE (split->>'memberId')::UUID IN (
                  SELECT id FROM public.family_members WHERE linked_user_id IS NOT NULL
              )
              AND NOT EXISTS (
                  SELECT 1
                  FROM public.transactions mirror
                  WHERE mirror.user_id = (
                      SELECT linked_user_id 
                      FROM public.family_members 
                      WHERE id = (split->>'memberId')::UUID
                  )
                  AND mirror.payer_id = t.user_id::text
                  AND mirror.date = t.date
                  AND mirror.amount = (split->>'assignedAmount')::NUMERIC
                  AND mirror.is_shared = true
              )
          )
    LOOP
        -- Chamar sync_shared_transaction para criar os espelhos
        BEGIN
            PERFORM public.sync_shared_transaction(v_transaction.id);
            v_count := v_count + 1;
        EXCEPTION
            WHEN OTHERS THEN
                RAISE WARNING 'Erro ao sincronizar transação %: %', v_transaction.id, SQLERRM;
        END;
    END LOOP;

    -- Log do resultado
    RAISE NOTICE 'Sincronizadas % transações compartilhadas', v_count;
    
    INSERT INTO audit_logs (entity, action, changes, user_id)
    VALUES (
        'SYSTEM',
        'BACKFILL_MIRRORS',
        jsonb_build_object('message', 'Backfill de espelhos de transações compartilhadas', 'count', v_count),
        auth.uid()
    );
END $$;

COMMIT;

-- ============================================
-- FIM DA CORREÇÃO
-- ============================================
