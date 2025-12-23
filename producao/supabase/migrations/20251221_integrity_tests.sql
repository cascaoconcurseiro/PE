-- ==============================================================================
-- TESTES DE INTEGRIDADE - SISTEMA COMPARTILHADO REESTRUTURADO
-- DATA: 2025-12-21
-- OBJETIVO: Validar integridade e consistência após reestruturação do schema
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: FUNÇÃO DE TESTE DE INTEGRIDADE ABRANGENTE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.run_comprehensive_integrity_tests()
RETURNS TABLE (
    test_category TEXT,
    test_name TEXT,
    status TEXT,
    details TEXT,
    affected_count INTEGER,
    severity TEXT
) AS $$
BEGIN
    -- ========================================
    -- CATEGORIA: ESTRUTURA DE TABELAS
    -- ========================================
    
    -- Teste 1: Verificar se todas as tabelas necessárias existem
    RETURN QUERY
    SELECT 
        'SCHEMA'::TEXT as test_category,
        'Required tables exist'::TEXT as test_name,
        CASE WHEN COUNT(*) = 4 THEN 'PASS' ELSE 'FAIL' END::TEXT as status,
        'Verificando existência de tabelas: transactions, shared_transaction_requests, shared_transaction_mirrors, shared_system_audit_logs'::TEXT as details,
        COUNT(*)::INTEGER as affected_count,
        'CRITICAL'::TEXT as severity
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN ('transactions', 'shared_transaction_requests', 'shared_transaction_mirrors', 'shared_system_audit_logs');
    
    -- Teste 2: Verificar se colunas necessárias foram adicionadas
    RETURN QUERY
    SELECT 
        'SCHEMA'::TEXT,
        'New columns in shared_transaction_requests'::TEXT,
        CASE WHEN COUNT(*) >= 5 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Verificando colunas: assigned_amount, expires_at, retry_count, last_retry_at, error_message, request_metadata'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'shared_transaction_requests'
    AND column_name IN ('assigned_amount', 'expires_at', 'retry_count', 'last_retry_at', 'error_message', 'request_metadata');
    
    -- Teste 3: Verificar constraints
    RETURN QUERY
    SELECT 
        'SCHEMA'::TEXT,
        'Constraints properly created'::TEXT,
        CASE WHEN COUNT(*) >= 2 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Verificando constraints: valid_status, valid_assigned_amount'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM information_schema.table_constraints 
    WHERE table_schema = 'public' 
    AND table_name = 'shared_transaction_requests'
    AND constraint_name IN ('valid_status', 'valid_assigned_amount');
    
    -- ========================================
    -- CATEGORIA: INTEGRIDADE DE DADOS
    -- ========================================
    
    -- Teste 4: Transações compartilhadas órfãs
    RETURN QUERY
    SELECT 
        'DATA_INTEGRITY'::TEXT,
        'Shared transactions without requests'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END::TEXT,
        'Transações marcadas como compartilhadas mas sem solicitações correspondentes'::TEXT,
        COUNT(*)::INTEGER,
        'MEDIUM'::TEXT
    FROM public.transactions t
    WHERE t.is_shared = true 
    AND t.payer_id = 'me'
    AND t.deleted = false
    AND NOT EXISTS (
        SELECT 1 FROM public.shared_transaction_requests str 
        WHERE str.transaction_id = t.id
    );
    
    -- Teste 5: Solicitações sem transações
    RETURN QUERY
    SELECT 
        'DATA_INTEGRITY'::TEXT,
        'Requests without transactions'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Solicitações de compartilhamento sem transação correspondente'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM public.shared_transaction_requests str
    WHERE NOT EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = str.transaction_id AND t.deleted = false
    );
    
    -- Teste 6: Espelhos órfãos
    RETURN QUERY
    SELECT 
        'DATA_INTEGRITY'::TEXT,
        'Orphaned mirror transactions'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Transações espelho sem transação original correspondente'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM public.shared_transaction_mirrors stm
    WHERE NOT EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = stm.original_transaction_id AND t.deleted = false
    );
    
    -- Teste 7: Duplicatas de espelhos
    RETURN QUERY
    SELECT 
        'DATA_INTEGRITY'::TEXT,
        'Duplicate mirror relationships'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END::TEXT,
        'Múltiplos espelhos para a mesma transação e usuário'::TEXT,
        COUNT(*)::INTEGER,
        'MEDIUM'::TEXT
    FROM (
        SELECT original_transaction_id, mirror_user_id, COUNT(*) as mirror_count
        FROM public.shared_transaction_mirrors
        GROUP BY original_transaction_id, mirror_user_id
        HAVING COUNT(*) > 1
    ) duplicates;
    
    -- ========================================
    -- CATEGORIA: ÍNDICES E PERFORMANCE
    -- ========================================
    
    -- Teste 8: Verificar índices críticos
    RETURN QUERY
    SELECT 
        'PERFORMANCE'::TEXT,
        'Critical indexes exist'::TEXT,
        CASE WHEN COUNT(*) >= 6 THEN 'PASS' ELSE 'WARN' END::TEXT,
        'Verificando índices para consultas de sistema compartilhado'::TEXT,
        COUNT(*)::INTEGER,
        'MEDIUM'::TEXT
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname IN (
        'idx_shared_requests_invited_user_status',
        'idx_shared_requests_expires_at',
        'idx_mirrors_original_transaction',
        'idx_mirrors_mirror_user',
        'idx_transactions_shared_payer',
        'idx_audit_logs_user_operation'
    );
    
    -- ========================================
    -- CATEGORIA: SEGURANÇA (RLS)
    -- ========================================
    
    -- Teste 9: Verificar RLS habilitado
    RETURN QUERY
    SELECT 
        'SECURITY'::TEXT,
        'RLS enabled on critical tables'::TEXT,
        CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Row Level Security deve estar habilitado em tabelas sensíveis'::TEXT,
        COUNT(*)::INTEGER,
        'CRITICAL'::TEXT
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND c.relname IN ('transactions', 'shared_transaction_requests', 'shared_transaction_mirrors', 'shared_system_audit_logs')
    AND c.relrowsecurity = true;
    
    -- Teste 10: Verificar policies existem
    RETURN QUERY
    SELECT 
        'SECURITY'::TEXT,
        'RLS policies exist'::TEXT,
        CASE WHEN COUNT(*) >= 4 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Políticas de segurança devem estar configuradas'::TEXT,
        COUNT(*)::INTEGER,
        'CRITICAL'::TEXT
    FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename IN ('transactions', 'shared_transaction_requests', 'shared_transaction_mirrors', 'shared_system_audit_logs');
    
    -- ========================================
    -- CATEGORIA: FUNÇÕES E TRIGGERS
    -- ========================================
    
    -- Teste 11: Verificar funções críticas existem
    RETURN QUERY
    SELECT 
        'FUNCTIONS'::TEXT,
        'Critical functions exist'::TEXT,
        CASE WHEN COUNT(*) >= 3 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Funções essenciais do sistema compartilhado'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
    AND p.proname IN ('cleanup_expired_shared_requests', 'verify_shared_system_integrity', 'audit_shared_request_changes');
    
    -- Teste 12: Verificar triggers ativos
    RETURN QUERY
    SELECT 
        'FUNCTIONS'::TEXT,
        'Audit triggers active'::TEXT,
        CASE WHEN COUNT(*) >= 1 THEN 'PASS' ELSE 'WARN' END::TEXT,
        'Triggers de auditoria devem estar ativos'::TEXT,
        COUNT(*)::INTEGER,
        'MEDIUM'::TEXT
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
    AND t.tgname IN ('trigger_audit_shared_request_changes')
    AND t.tgenabled = 'O'; -- Enabled
    
    -- ========================================
    -- CATEGORIA: CONSISTÊNCIA DE DADOS
    -- ========================================
    
    -- Teste 13: Valores inválidos em campos críticos
    RETURN QUERY
    SELECT 
        'DATA_CONSISTENCY'::TEXT,
        'No invalid assigned_amount values'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'assigned_amount deve ser positivo quando presente'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM public.shared_transaction_requests
    WHERE assigned_amount IS NOT NULL AND assigned_amount <= 0;
    
    -- Teste 14: Status inválidos
    RETURN QUERY
    SELECT 
        'DATA_CONSISTENCY'::TEXT,
        'No invalid status values'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Status deve estar dentro dos valores permitidos'::TEXT,
        COUNT(*)::INTEGER,
        'HIGH'::TEXT
    FROM public.shared_transaction_requests
    WHERE status NOT IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED');
    
    -- Teste 15: Datas inconsistentes
    RETURN QUERY
    SELECT 
        'DATA_CONSISTENCY'::TEXT,
        'No inconsistent dates'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'WARN' END::TEXT,
        'responded_at deve ser posterior a created_at quando presente'::TEXT,
        COUNT(*)::INTEGER,
        'MEDIUM'::TEXT
    FROM public.shared_transaction_requests
    WHERE responded_at IS NOT NULL 
    AND responded_at < created_at;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 2: FUNÇÃO DE RELATÓRIO RESUMIDO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.generate_integrity_report()
RETURNS TABLE (
    summary_category TEXT,
    total_tests INTEGER,
    passed INTEGER,
    failed INTEGER,
    warnings INTEGER,
    critical_issues INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH test_results AS (
        SELECT * FROM public.run_comprehensive_integrity_tests()
    ),
    categorized_results AS (
        SELECT 
            test_category,
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE status = 'PASS') as passed,
            COUNT(*) FILTER (WHERE status = 'FAIL') as failed,
            COUNT(*) FILTER (WHERE status = 'WARN') as warnings,
            COUNT(*) FILTER (WHERE status = 'FAIL' AND severity = 'CRITICAL') as critical
        FROM test_results
        GROUP BY test_category
    )
    SELECT 
        test_category::TEXT,
        total::INTEGER,
        passed::INTEGER,
        failed::INTEGER,
        warnings::INTEGER,
        critical::INTEGER
    FROM categorized_results
    
    UNION ALL
    
    SELECT 
        'TOTAL'::TEXT,
        SUM(total)::INTEGER,
        SUM(passed)::INTEGER,
        SUM(failed)::INTEGER,
        SUM(warnings)::INTEGER,
        SUM(critical)::INTEGER
    FROM categorized_results;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 3: EXECUTAR TESTES E GERAR RELATÓRIO
-- ==============================================================================

-- Executar todos os testes
DO $$
DECLARE
    test_result RECORD;
    summary_result RECORD;
    total_critical INTEGER := 0;
    total_failed INTEGER := 0;
    total_warnings INTEGER := 0;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'EXECUTANDO TESTES DE INTEGRIDADE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    -- Executar testes detalhados
    FOR test_result IN 
        SELECT * FROM public.run_comprehensive_integrity_tests()
        ORDER BY test_category, test_name
    LOOP
        RAISE NOTICE '[%] % | % | Count: % | Severity: %', 
            test_result.test_category,
            test_result.test_name,
            test_result.status,
            test_result.affected_count,
            test_result.severity;
            
        -- Contar problemas críticos
        IF test_result.status = 'FAIL' AND test_result.severity = 'CRITICAL' THEN
            total_critical := total_critical + 1;
        END IF;
        
        IF test_result.status = 'FAIL' THEN
            total_failed := total_failed + 1;
        END IF;
        
        IF test_result.status = 'WARN' THEN
            total_warnings := total_warnings + 1;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMO POR CATEGORIA';
    RAISE NOTICE '========================================';
    
    -- Gerar relatório resumido
    FOR summary_result IN 
        SELECT * FROM public.generate_integrity_report()
        ORDER BY summary_category
    LOOP
        RAISE NOTICE '% | Total: % | Passed: % | Failed: % | Warnings: % | Critical: %',
            summary_result.summary_category,
            summary_result.total_tests,
            summary_result.passed,
            summary_result.failed,
            summary_result.warnings,
            summary_result.critical_issues;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESULTADO FINAL';
    RAISE NOTICE '========================================';
    
    IF total_critical > 0 THEN
        RAISE EXCEPTION 'FALHA CRÍTICA: % problemas críticos encontrados. Sistema não está seguro para uso.', total_critical;
    ELSIF total_failed > 0 THEN
        RAISE WARNING 'ATENÇÃO: % testes falharam. Revisar antes de prosseguir.', total_failed;
    ELSIF total_warnings > 0 THEN
        RAISE NOTICE 'SUCESSO COM AVISOS: % avisos encontrados. Sistema funcional mas pode ser otimizado.', total_warnings;
    ELSE
        RAISE NOTICE 'SUCESSO COMPLETO: Todos os testes passaram. Sistema íntegro e pronto para uso.';
    END IF;
END $$;

-- ==============================================================================
-- PARTE 4: LOG DOS TESTES
-- ==============================================================================

-- Registrar execução dos testes no audit log
INSERT INTO public.shared_system_audit_logs (
    operation_type,
    operation_data,
    success,
    user_id
) VALUES (
    'INTEGRITY_TESTS',
    jsonb_build_object(
        'test_suite', 'comprehensive_integrity_tests',
        'timestamp', NOW(),
        'total_tests', (SELECT COUNT(*) FROM public.run_comprehensive_integrity_tests()),
        'passed_tests', (SELECT COUNT(*) FROM public.run_comprehensive_integrity_tests() WHERE status = 'PASS'),
        'failed_tests', (SELECT COUNT(*) FROM public.run_comprehensive_integrity_tests() WHERE status = 'FAIL'),
        'warnings', (SELECT COUNT(*) FROM public.run_comprehensive_integrity_tests() WHERE status = 'WARN')
    ),
    true,
    NULL
);

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
TESTES IMPLEMENTADOS:

1. ESTRUTURA DE SCHEMA:
   - Existência de tabelas necessárias
   - Colunas adicionadas corretamente
   - Constraints criados

2. INTEGRIDADE DE DADOS:
   - Transações órfãs
   - Solicitações sem transações
   - Espelhos órfãos
   - Duplicatas

3. PERFORMANCE:
   - Índices críticos existem
   - Otimizações implementadas

4. SEGURANÇA:
   - RLS habilitado
   - Políticas configuradas

5. FUNÇÕES E TRIGGERS:
   - Funções críticas existem
   - Triggers de auditoria ativos

6. CONSISTÊNCIA:
   - Valores válidos em campos
   - Datas consistentes
   - Status válidos

INTERPRETAÇÃO DOS RESULTADOS:
- PASS: Teste passou, tudo correto
- FAIL: Teste falhou, requer ação imediata
- WARN: Aviso, pode precisar de atenção

SEVERIDADE:
- CRITICAL: Problema que impede funcionamento
- HIGH: Problema importante que deve ser corrigido
- MEDIUM: Problema que pode afetar performance/UX
- LOW: Problema menor, correção opcional

Para executar novamente:
SELECT * FROM public.run_comprehensive_integrity_tests();
SELECT * FROM public.generate_integrity_report();
*/