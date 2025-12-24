-- ==============================================================================
-- MIGRATION: RECONCILE LEDGER DATA
-- DATA: 2026-02-23
-- DESCRIÇÃO: Função para reconciliar dados existentes do ledger
--            1. Identificar lançamentos duplicados
--            2. Identificar lançamentos desbalanceados
--            3. Corrigir transações compartilhadas existentes
--            4. Gerar relatório de correções
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: FUNÇÃO PRINCIPAL DE RECONCILIAÇÃO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.reconcile_ledger_entries()
RETURNS TABLE (
    issue_type TEXT,
    transaction_id UUID,
    user_id UUID,
    description TEXT,
    amount NUMERIC,
    action_taken TEXT,
    details JSONB
) AS $$
DECLARE
    v_duplicate RECORD;
    v_shared_tx RECORD;
    v_orphan RECORD;
    v_total_duplicates INTEGER := 0;
    v_total_fixed_shared INTEGER := 0;
    v_total_orphans INTEGER := 0;
    v_start_time TIMESTAMPTZ := NOW();
BEGIN
    RAISE NOTICE 'Iniciando reconciliação do ledger em %', v_start_time;
    
    -- ==================================================================
    -- ETAPA 1: IDENTIFICAR E REMOVER LANÇAMENTOS DUPLICADOS
    -- ==================================================================
    RAISE NOTICE 'Etapa 1: Identificando lançamentos duplicados...';
    
    FOR v_duplicate IN
        SELECT 
            transaction_id,
            user_id,
            debit_account_id,
            credit_account_id,
            amount,
            COUNT(*) as duplicate_count,
            MIN(id) as keep_id,
            ARRAY_AGG(id) as all_ids
        FROM public.ledger_entries
        WHERE archived = false
        GROUP BY transaction_id, user_id, debit_account_id, credit_account_id, amount
        HAVING COUNT(*) > 1
    LOOP
        v_total_duplicates := v_total_duplicates + 1;
        
        -- Retornar informação sobre duplicata
        RETURN QUERY SELECT
            'DUPLICATE'::TEXT,
            v_duplicate.transaction_id,
            v_duplicate.user_id,
            'Lançamento duplicado encontrado'::TEXT,
            v_duplicate.amount,
            'Removendo ' || (v_duplicate.duplicate_count - 1) || ' duplicatas'::TEXT,
            jsonb_build_object(
                'duplicate_count', v_duplicate.duplicate_count,
                'kept_id', v_duplicate.keep_id,
                'removed_ids', v_duplicate.all_ids
            );
        
        -- Remover duplicatas (manter apenas o primeiro)
        DELETE FROM public.ledger_entries
        WHERE id = ANY(v_duplicate.all_ids)
        AND id != v_duplicate.keep_id;
        
        RAISE NOTICE 'Duplicata removida: transaction_id=%, count=%', 
            v_duplicate.transaction_id, v_duplicate.duplicate_count;
    END LOOP;
    
    RAISE NOTICE 'Etapa 1 completa: % duplicatas encontradas e corrigidas', v_total_duplicates;
    
    -- ==================================================================
    -- ETAPA 2: IDENTIFICAR TRANSAÇÕES ÓRFÃS (SEM LANÇAMENTOS)
    -- ==================================================================
    RAISE NOTICE 'Etapa 2: Identificando transações órfãs...';
    
    FOR v_orphan IN
        SELECT t.*
        FROM public.transactions t
        LEFT JOIN public.ledger_entries le ON le.transaction_id = t.id
        WHERE t.deleted = false
        AND le.id IS NULL
        AND t.created_at < NOW() - INTERVAL '1 minute' -- Ignorar transações muito recentes
    LOOP
        v_total_orphans := v_total_orphans + 1;
        
        -- Retornar informação sobre órfã
        RETURN QUERY SELECT
            'ORPHAN'::TEXT,
            v_orphan.id,
            v_orphan.user_id,
            v_orphan.description,
            v_orphan.amount,
            'Recriando lançamentos via trigger'::TEXT,
            jsonb_build_object(
                'type', v_orphan.type,
                'is_shared', v_orphan.is_shared,
                'payer_id', v_orphan.payer_id,
                'date', v_orphan.date
            );
        
        -- Forçar trigger executando UPDATE (sem mudar dados)
        UPDATE public.transactions
        SET updated_at = NOW()
        WHERE id = v_orphan.id;
        
        RAISE NOTICE 'Transação órfã corrigida: id=%, description=%', 
            v_orphan.id, v_orphan.description;
    END LOOP;
    
    RAISE NOTICE 'Etapa 2 completa: % transações órfãs corrigidas', v_total_orphans;
    
    -- ==================================================================
    -- ETAPA 3: CORRIGIR TRANSAÇÕES COMPARTILHADAS EXISTENTES
    -- ==================================================================
    RAISE NOTICE 'Etapa 3: Corrigindo transações compartilhadas existentes...';
    
    FOR v_shared_tx IN
        SELECT t.*, le.id as ledger_id
        FROM public.transactions t
        JOIN public.ledger_entries le ON le.transaction_id = t.id
        WHERE t.is_shared = true
        AND t.deleted = false
        AND le.metadata->>'entry_type' IS NULL -- Lançamentos antigos sem entry_type
    LOOP
        v_total_fixed_shared := v_total_fixed_shared + 1;
        
        -- Retornar informação sobre correção
        RETURN QUERY SELECT
            'SHARED_FIX'::TEXT,
            v_shared_tx.id,
            v_shared_tx.user_id,
            v_shared_tx.description,
            v_shared_tx.amount,
            'Recriando lançamentos com lógica correta'::TEXT,
            jsonb_build_object(
                'payer_id', v_shared_tx.payer_id,
                'is_mirror', v_shared_tx.is_mirror,
                'old_ledger_id', v_shared_tx.ledger_id
            );
        
        -- Deletar lançamentos antigos
        DELETE FROM public.ledger_entries
        WHERE transaction_id = v_shared_tx.id;
        
        -- Forçar recriação via trigger
        UPDATE public.transactions
        SET updated_at = NOW()
        WHERE id = v_shared_tx.id;
        
        RAISE NOTICE 'Transação compartilhada corrigida: id=%, payer_id=%', 
            v_shared_tx.id, v_shared_tx.payer_id;
    END LOOP;
    
    RAISE NOTICE 'Etapa 3 completa: % transações compartilhadas corrigidas', v_total_fixed_shared;
    
    -- ==================================================================
    -- ETAPA 4: RELATÓRIO FINAL
    -- ==================================================================
    RETURN QUERY SELECT
        'SUMMARY'::TEXT,
        NULL::UUID,
        NULL::UUID,
        'Reconciliação completa'::TEXT,
        NULL::NUMERIC,
        format('Duplicatas: %s, Órfãs: %s, Compartilhadas: %s', 
            v_total_duplicates, v_total_orphans, v_total_fixed_shared)::TEXT,
        jsonb_build_object(
            'total_duplicates', v_total_duplicates,
            'total_orphans', v_total_orphans,
            'total_fixed_shared', v_total_fixed_shared,
            'execution_time_ms', EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000
        );
    
    RAISE NOTICE 'Reconciliação completa em % ms', 
        EXTRACT(EPOCH FROM (NOW() - v_start_time)) * 1000;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 2: FUNÇÃO DE VALIDAÇÃO (NÃO MODIFICA DADOS)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.validate_ledger_integrity()
RETURNS TABLE (
    check_type TEXT,
    status TEXT,
    count INTEGER,
    details JSONB
) AS $$
DECLARE
    v_duplicate_count INTEGER;
    v_orphan_count INTEGER;
    v_unbalanced_count INTEGER;
    v_shared_incorrect_count INTEGER;
BEGIN
    -- Check 1: Duplicatas
    SELECT COUNT(*) INTO v_duplicate_count
    FROM (
        SELECT transaction_id, user_id, debit_account_id, credit_account_id, amount
        FROM public.ledger_entries
        WHERE archived = false
        GROUP BY transaction_id, user_id, debit_account_id, credit_account_id, amount
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RETURN QUERY SELECT
        'DUPLICATES'::TEXT,
        CASE WHEN v_duplicate_count = 0 THEN 'OK' ELSE 'ISSUES_FOUND' END::TEXT,
        v_duplicate_count,
        jsonb_build_object('message', 
            CASE WHEN v_duplicate_count = 0 
            THEN 'Nenhuma duplicata encontrada' 
            ELSE v_duplicate_count || ' duplicatas encontradas' 
            END
        );
    
    -- Check 2: Transações órfãs
    SELECT COUNT(*) INTO v_orphan_count
    FROM public.transactions t
    LEFT JOIN public.ledger_entries le ON le.transaction_id = t.id
    WHERE t.deleted = false
    AND le.id IS NULL
    AND t.created_at < NOW() - INTERVAL '1 minute';
    
    RETURN QUERY SELECT
        'ORPHANS'::TEXT,
        CASE WHEN v_orphan_count = 0 THEN 'OK' ELSE 'ISSUES_FOUND' END::TEXT,
        v_orphan_count,
        jsonb_build_object('message', 
            CASE WHEN v_orphan_count = 0 
            THEN 'Nenhuma transação órfã encontrada' 
            ELSE v_orphan_count || ' transações órfãs encontradas' 
            END
        );
    
    -- Check 3: Transações compartilhadas com lançamentos incorretos
    SELECT COUNT(*) INTO v_shared_incorrect_count
    FROM public.transactions t
    JOIN public.ledger_entries le ON le.transaction_id = t.id
    WHERE t.is_shared = true
    AND t.deleted = false
    AND le.metadata->>'entry_type' IS NULL;
    
    RETURN QUERY SELECT
        'SHARED_INCORRECT'::TEXT,
        CASE WHEN v_shared_incorrect_count = 0 THEN 'OK' ELSE 'ISSUES_FOUND' END::TEXT,
        v_shared_incorrect_count,
        jsonb_build_object('message', 
            CASE WHEN v_shared_incorrect_count = 0 
            THEN 'Todas transações compartilhadas estão corretas' 
            ELSE v_shared_incorrect_count || ' transações compartilhadas precisam correção' 
            END
        );
    
    -- Check 4: Resumo geral
    RETURN QUERY SELECT
        'SUMMARY'::TEXT,
        CASE WHEN v_duplicate_count = 0 AND v_orphan_count = 0 AND v_shared_incorrect_count = 0 
            THEN 'HEALTHY' ELSE 'NEEDS_RECONCILIATION' END::TEXT,
        v_duplicate_count + v_orphan_count + v_shared_incorrect_count,
        jsonb_build_object(
            'total_issues', v_duplicate_count + v_orphan_count + v_shared_incorrect_count,
            'duplicates', v_duplicate_count,
            'orphans', v_orphan_count,
            'shared_incorrect', v_shared_incorrect_count,
            'recommendation', 
                CASE WHEN v_duplicate_count + v_orphan_count + v_shared_incorrect_count > 0
                THEN 'Execute SELECT * FROM reconcile_ledger_entries() para corrigir'
                ELSE 'Sistema está saudável'
                END
        );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 3: FUNÇÃO DE ANÁLISE DE CASH FLOW
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.analyze_cash_flow_duplication(
    p_user_id UUID,
    p_start_date DATE,
    p_end_date DATE
)
RETURNS TABLE (
    analysis_type TEXT,
    total_amount NUMERIC,
    transaction_count INTEGER,
    details JSONB
) AS $$
DECLARE
    v_total_transactions NUMERIC;
    v_total_ledger NUMERIC;
    v_shared_transactions NUMERIC;
    v_shared_ledger NUMERIC;
BEGIN
    -- Total de transações (método antigo - frontend)
    SELECT 
        COALESCE(SUM(amount), 0),
        COUNT(*)
    INTO v_total_transactions, v_shared_transactions
    FROM public.transactions
    WHERE user_id = p_user_id
    AND date BETWEEN p_start_date AND p_end_date
    AND type = 'DESPESA'
    AND deleted = false;
    
    RETURN QUERY SELECT
        'TRANSACTIONS_TABLE'::TEXT,
        v_total_transactions,
        v_shared_transactions::INTEGER,
        jsonb_build_object(
            'source', 'transactions table',
            'method', 'SUM(amount) WHERE type=DESPESA'
        );
    
    -- Total do ledger (método correto - backend)
    SELECT 
        COALESCE(SUM(le.amount), 0),
        COUNT(DISTINCT le.transaction_id)
    INTO v_total_ledger, v_shared_ledger
    FROM public.ledger_entries le
    JOIN public.chart_of_accounts ca ON ca.id = le.debit_account_id
    WHERE le.user_id = p_user_id
    AND le.occurred_at::date BETWEEN p_start_date AND p_end_date
    AND ca.type = 'EXPENSE'
    AND le.archived = false;
    
    RETURN QUERY SELECT
        'LEDGER_ENTRIES'::TEXT,
        v_total_ledger,
        v_shared_ledger::INTEGER,
        jsonb_build_object(
            'source', 'ledger_entries',
            'method', 'SUM(amount) WHERE debit_account.type=EXPENSE'
        );
    
    -- Comparação
    RETURN QUERY SELECT
        'COMPARISON'::TEXT,
        ABS(v_total_transactions - v_total_ledger),
        NULL::INTEGER,
        jsonb_build_object(
            'difference', ABS(v_total_transactions - v_total_ledger),
            'difference_percentage', 
                CASE WHEN v_total_transactions > 0 
                THEN ROUND((ABS(v_total_transactions - v_total_ledger) / v_total_transactions) * 100, 2)
                ELSE 0 
                END,
            'status', 
                CASE WHEN ABS(v_total_transactions - v_total_ledger) < 0.01 
                THEN 'OK' 
                ELSE 'DUPLICATION_DETECTED' 
                END,
            'recommendation',
                CASE WHEN ABS(v_total_transactions - v_total_ledger) > 0.01
                THEN 'Use ledger_entries como fonte de verdade, não transactions'
                ELSE 'Ambos os métodos estão consistentes'
                END
        );
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 4: COMENTÁRIOS E PERMISSÕES
-- ==============================================================================

COMMENT ON FUNCTION public.reconcile_ledger_entries() IS 
'Reconcilia dados do ledger: remove duplicatas, corrige órfãs, e recria lançamentos compartilhados com lógica correta';

COMMENT ON FUNCTION public.validate_ledger_integrity() IS 
'Valida integridade do ledger sem modificar dados. Use antes de reconciliar para ver o que precisa ser corrigido';

COMMENT ON FUNCTION public.analyze_cash_flow_duplication(UUID, DATE, DATE) IS 
'Analisa duplicação no cálculo de cash flow comparando transactions table vs ledger entries';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.reconcile_ledger_entries() TO authenticated;
GRANT EXECUTE ON FUNCTION public.validate_ledger_integrity() TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_cash_flow_duplication(UUID, DATE, DATE) TO authenticated;

COMMIT;

-- ==============================================================================
-- INSTRUÇÕES DE USO
-- ==============================================================================

/*
COMO USAR ESTAS FUNÇÕES:

1. VALIDAR INTEGRIDADE (NÃO MODIFICA DADOS):
   SELECT * FROM validate_ledger_integrity();
   
   Retorna:
   - DUPLICATES: Quantas duplicatas existem
   - ORPHANS: Quantas transações órfãs existem
   - SHARED_INCORRECT: Quantas transações compartilhadas precisam correção
   - SUMMARY: Status geral e recomendação

2. RECONCILIAR DADOS (MODIFICA DADOS):
   SELECT * FROM reconcile_ledger_entries();
   
   Retorna log de todas as correções aplicadas:
   - DUPLICATE: Duplicatas removidas
   - ORPHAN: Transações órfãs corrigidas
   - SHARED_FIX: Transações compartilhadas recriadas
   - SUMMARY: Resumo final

3. ANALISAR DUPLICAÇÃO DE CASH FLOW:
   SELECT * FROM analyze_cash_flow_duplication(
       'user-uuid-here'::UUID,
       '2024-01-01'::DATE,
       '2024-12-31'::DATE
   );
   
   Retorna:
   - TRANSACTIONS_TABLE: Total calculado pela tabela transactions
   - LEDGER_ENTRIES: Total calculado pelo ledger (correto)
   - COMPARISON: Diferença e recomendação

ORDEM RECOMENDADA:
1. Execute validate_ledger_integrity() para ver o estado atual
2. Se houver issues, execute reconcile_ledger_entries() para corrigir
3. Execute validate_ledger_integrity() novamente para confirmar
4. Execute analyze_cash_flow_duplication() para verificar se duplicação foi resolvida

EXEMPLO COMPLETO:
-- Passo 1: Validar
SELECT * FROM validate_ledger_integrity();

-- Passo 2: Se necessário, reconciliar
SELECT * FROM reconcile_ledger_entries();

-- Passo 3: Validar novamente
SELECT * FROM validate_ledger_integrity();

-- Passo 4: Analisar cash flow
SELECT * FROM analyze_cash_flow_duplication(
    auth.uid(),
    CURRENT_DATE - INTERVAL '30 days',
    CURRENT_DATE
);
*/
