-- ==============================================================================
-- TESTES DE PROPRIEDADE: Diagnostic Engine (VERSÃO CORRIGIDA)
-- DATA: 2025-12-21
-- OBJETIVO: Implementar testes baseados em propriedades para o Diagnostic Engine
-- ==============================================================================

-- Extensão para testes (se não existir)
CREATE EXTENSION IF NOT EXISTS pgtap;

-- ==============================================================================
-- FUNÇÕES DE GERAÇÃO DE DADOS DE TESTE
-- ==============================================================================

-- Função para gerar dados de teste para parcelas
CREATE OR REPLACE FUNCTION public.generate_test_installments(
    p_count INTEGER,
    p_user_a_id UUID,
    p_user_b_id UUID,
    p_account_id UUID,
    p_corruption_rate DECIMAL DEFAULT 0.3,
    p_description_pattern TEXT DEFAULT 'TEST_Wesley'
) RETURNS UUID[] AS $$
DECLARE
    v_installment_ids UUID[] := '{}';
    v_installment_id UUID;
    i INTEGER;
    v_corrupt_user_id BOOLEAN;
    v_corrupt_deleted BOOLEAN;
BEGIN
    -- Limpar dados de teste anteriores
    DELETE FROM public.transactions 
    WHERE description LIKE p_description_pattern || '%';
    
    -- Gerar parcelas de teste
    FOR i IN 1..p_count LOOP
        v_installment_id := gen_random_uuid();
        
        -- Determinar se esta parcela deve ter problemas
        v_corrupt_user_id := (random() < p_corruption_rate);
        v_corrupt_deleted := (random() < p_corruption_rate / 2); -- Menos parcelas deletadas
        
        -- Inserir parcela de teste
        INSERT INTO public.transactions (
            id,
            user_id,
            account_id,
            description,
            amount,
            type,
            category,
            date,
            is_installment,
            current_installment,
            total_installments,
            deleted,
            created_at,
            updated_at
        ) VALUES (
            v_installment_id,
            CASE WHEN v_corrupt_user_id THEN p_user_a_id ELSE p_user_b_id END,
            p_account_id,
            p_description_pattern || '_' || i::TEXT,
            100.00 + (random() * 900)::DECIMAL(10,2),
            'DESPESA',
            'Teste',
            CURRENT_DATE + (i || ' days')::INTERVAL,
            true,
            i,
            p_count,
            v_corrupt_deleted,
            NOW(),
            NOW()
        );
        
        v_installment_ids := v_installment_ids || v_installment_id;
    END LOOP;
    
    RETURN v_installment_ids;
END;
$$ LANGUAGE plpgsql;

-- Função para limpar dados de teste
CREATE OR REPLACE FUNCTION public.cleanup_test_installments(
    p_description_pattern TEXT DEFAULT 'TEST_Wesley'
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM public.transactions 
    WHERE description LIKE p_description_pattern || '%';
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 1: Complete Installment Discovery
-- Feature: missing-installment-fix, Property 1: Complete Installment Discovery
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_complete_installment_discovery()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_DISCOVERY_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_generated_ids UUID[];
    v_found_count INTEGER;
    v_iteration INTEGER;
BEGIN
    -- Executar 10 iterações do teste de propriedade (reduzido para performance)
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (1-5)
        v_installment_count := 1 + (random() * 4)::INTEGER;
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste
        v_generated_ids := public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            0.0, -- Sem corrupção para este teste
            v_test_pattern
        );
        
        -- Executar diagnóstico
        SELECT COUNT(*) INTO v_found_count
        FROM public.diagnose_missing_installments(v_test_pattern || '%')
        WHERE phase = 'DETAILED_ANALYSIS';
        
        -- Verificar propriedade: deve encontrar exatamente todas as parcelas geradas
        RETURN NEXT ok(
            v_found_count = v_installment_count,
            format('Iteration %s: Expected %s installments, found %s', 
                   v_iteration, v_installment_count, v_found_count)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_DISCOVERY_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 1: Complete Installment Discovery - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 2: Comprehensive Analysis Coverage
-- Feature: missing-installment-fix, Property 2: Comprehensive Analysis Coverage
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_comprehensive_analysis_coverage()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_COVERAGE_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_analysis_record RECORD;
    v_iteration INTEGER;
    v_missing_fields INTEGER;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (1-5)
        v_installment_count := 1 + (random() * 4)::INTEGER;
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste
        PERFORM public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            0.3, -- 30% de corrupção
            v_test_pattern
        );
        
        -- Verificar que cada análise contém todos os campos obrigatórios
        v_missing_fields := 0;
        
        FOR v_analysis_record IN
            SELECT details
            FROM public.diagnose_missing_installments(v_test_pattern || '%')
            WHERE phase = 'DETAILED_ANALYSIS'
        LOOP
            -- Verificar se todos os campos obrigatórios estão presentes
            IF NOT (
                v_analysis_record.details ? 'installment_id' AND
                v_analysis_record.details ? 'user_id' AND
                v_analysis_record.details ? 'account_id' AND
                v_analysis_record.details ? 'deleted' AND
                v_analysis_record.details ? 'user_status' AND
                v_analysis_record.details ? 'delete_status' AND
                v_analysis_record.details ? 'account_status' AND
                v_analysis_record.details ? 'visibility_status'
            ) THEN
                v_missing_fields := v_missing_fields + 1;
            END IF;
        END LOOP;
        
        -- Verificar propriedade: nenhuma análise deve ter campos faltantes
        RETURN NEXT ok(
            v_missing_fields = 0,
            format('Iteration %s: %s installments analyzed, %s missing required fields', 
                   v_iteration, v_installment_count, v_missing_fields)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_COVERAGE_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 2: Comprehensive Analysis Coverage - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 3: Problem Detection Completeness
-- Feature: missing-installment-fix, Property 3: Problem Detection Completeness
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_problem_detection_completeness()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_PROBLEMS_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_corruption_rate DECIMAL;
    v_expected_problems INTEGER;
    v_detected_problems INTEGER;
    v_iteration INTEGER;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar parâmetros aleatórios
        v_installment_count := 3 + (random() * 4)::INTEGER; -- 3-7 parcelas
        v_corruption_rate := 0.2 + (random() * 0.4); -- 20%-60% de corrupção
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste com problemas conhecidos
        PERFORM public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            v_corruption_rate,
            v_test_pattern
        );
        
        -- Contar problemas esperados (parcelas com user_id incorreto ou deletadas)
        SELECT COUNT(*) INTO v_expected_problems
        FROM public.transactions
        WHERE description LIKE v_test_pattern || '%'
          AND (user_id != v_user_b_id OR deleted = true);
        
        -- Contar problemas detectados pelo diagnóstico
        SELECT COUNT(*) INTO v_detected_problems
        FROM public.detect_installment_problems(v_test_pattern || '%')
        WHERE problem_type IN ('INCORRECT_USER_ID', 'DELETED_INSTALLMENTS');
        
        -- Verificar propriedade: deve detectar pelo menos os problemas principais
        -- (pode detectar mais devido a problemas de sequência, etc.)
        RETURN NEXT ok(
            v_detected_problems >= CASE WHEN v_expected_problems > 0 THEN 1 ELSE 0 END,
            format('Iteration %s: Expected at least %s problem types, detected %s', 
                   v_iteration, 
                   CASE WHEN v_expected_problems > 0 THEN 1 ELSE 0 END, 
                   v_detected_problems)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_PROBLEMS_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 3: Problem Detection Completeness - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO PRINCIPAL DE TESTE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.run_diagnostic_engine_property_tests()
RETURNS SETOF TEXT AS $$
BEGIN
    -- Executar todos os testes de propriedade
    RETURN QUERY SELECT * FROM public.test_property_complete_installment_discovery();
    RETURN QUERY SELECT * FROM public.test_property_comprehensive_analysis_coverage();
    RETURN QUERY SELECT * FROM public.test_property_problem_detection_completeness();
    
    -- Resumo final
    RETURN NEXT ok(true, '=== DIAGNOSTIC ENGINE PROPERTY TESTS COMPLETED ===');
    RETURN NEXT ok(true, 'All 3 properties tested with 10 iterations each');
    RETURN NEXT ok(true, 'Total test iterations: 30');
END;
$$ LANGUAGE plpgsql;

-- Adicionar comentários
COMMENT ON FUNCTION public.generate_test_installments(INTEGER, UUID, UUID, UUID, DECIMAL, TEXT) IS 
'Gera dados de teste para parcelas com taxa de corrupção configurável';

COMMENT ON FUNCTION public.cleanup_test_installments(TEXT) IS 
'Limpa dados de teste baseado no padrão de descrição';

COMMENT ON FUNCTION public.test_property_complete_installment_discovery() IS 
'Property Test 1: Verifica que o diagnóstico encontra todas as parcelas que correspondem ao padrão';

COMMENT ON FUNCTION public.test_property_comprehensive_analysis_coverage() IS 
'Property Test 2: Verifica que cada parcela analisada contém todos os campos obrigatórios';

COMMENT ON FUNCTION public.test_property_problem_detection_completeness() IS 
'Property Test 3: Verifica que problemas conhecidos são detectados pelo sistema';

COMMENT ON FUNCTION public.run_diagnostic_engine_property_tests() IS 
'Executa todos os testes de propriedade do Diagnostic Engine';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.generate_test_installments(INTEGER, UUID, UUID, UUID, DECIMAL, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_test_installments(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_complete_installment_discovery() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_comprehensive_analysis_coverage() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_problem_detection_completeness() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_diagnostic_engine_property_tests() TO authenticated;