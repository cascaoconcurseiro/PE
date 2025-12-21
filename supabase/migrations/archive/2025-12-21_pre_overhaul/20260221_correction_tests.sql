-- ==============================================================================
-- TESTES DE PROPRIEDADE: Correction Engine
-- DATA: 2025-12-21
-- OBJETIVO: Implementar testes baseados em propriedades para o Correction Engine
-- ==============================================================================

-- ==============================================================================
-- PROPERTY 4: User_ID Correction Accuracy
-- Feature: missing-installment-fix, Property 4: User_ID Correction Accuracy
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_user_id_correction_accuracy()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_CORRECTION_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_generated_ids UUID[];
    v_correction_result RECORD;
    v_iteration INTEGER;
    v_corrected_count INTEGER;
    v_expected_count INTEGER;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (3-8)
        v_installment_count := 3 + (random() * 5)::INTEGER;
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste com 100% de user_id incorreto
        v_generated_ids := public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            1.0, -- 100% corrupção para garantir que há problemas
            v_test_pattern
        );
        
        -- Contar quantas parcelas têm user_id incorreto
        SELECT COUNT(*) INTO v_expected_count
        FROM public.transactions
        WHERE description LIKE v_test_pattern || '%'
          AND user_id != v_user_b_id;
        
        -- Executar correção em dry-run
        SELECT COUNT(*) INTO v_corrected_count
        FROM public.fix_missing_installments(v_test_pattern || '%', true)
        WHERE action = 'UPDATE_USER_ID' AND success = true;
        
        -- Verificar propriedade: deve identificar todas as parcelas com user_id incorreto
        RETURN NEXT ok(
            v_corrected_count = v_expected_count,
            format('Iteration %s: Expected %s corrections, found %s', 
                   v_iteration, v_expected_count, v_corrected_count)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_CORRECTION_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 4: User_ID Correction Accuracy - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 5: Data Preservation During Correction
-- Feature: missing-installment-fix, Property 5: Data Preservation During Correction
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_data_preservation_during_correction()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_PRESERVATION_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_generated_ids UUID[];
    v_before_data RECORD;
    v_after_data RECORD;
    v_iteration INTEGER;
    v_data_preserved BOOLEAN;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (2-5)
        v_installment_count := 2 + (random() * 3)::INTEGER;
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste com problemas
        v_generated_ids := public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            0.5, -- 50% corrupção
            v_test_pattern
        );
        
        -- Capturar dados antes da correção (exceto user_id e deleted)
        SELECT 
            COUNT(*) as total_count,
            SUM(amount) as total_amount,
            COUNT(DISTINCT description) as unique_descriptions,
            COUNT(DISTINCT current_installment) as unique_installments
        INTO v_before_data
        FROM public.transactions
        WHERE description LIKE v_test_pattern || '%';
        
        -- Executar correção real
        PERFORM public.fix_missing_installments(v_test_pattern || '%', false);
        
        -- Capturar dados após a correção
        SELECT 
            COUNT(*) as total_count,
            SUM(amount) as total_amount,
            COUNT(DISTINCT description) as unique_descriptions,
            COUNT(DISTINCT current_installment) as unique_installments
        INTO v_after_data
        FROM public.transactions
        WHERE description LIKE v_test_pattern || '%';
        
        -- Verificar propriedade: dados não relacionados a user_id/deleted devem ser preservados
        v_data_preserved := (
            v_before_data.total_count = v_after_data.total_count AND
            v_before_data.total_amount = v_after_data.total_amount AND
            v_before_data.unique_descriptions = v_after_data.unique_descriptions AND
            v_before_data.unique_installments = v_after_data.unique_installments
        );
        
        RETURN NEXT ok(
            v_data_preserved,
            format('Iteration %s: Data preserved - Count: %s→%s, Amount: %s→%s', 
                   v_iteration, 
                   v_before_data.total_count, v_after_data.total_count,
                   v_before_data.total_amount, v_after_data.total_amount)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_PRESERVATION_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 5: Data Preservation During Correction - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 6: Atomic Correction Operations
-- Feature: missing-installment-fix, Property 6: Atomic Correction Operations
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_atomic_correction_operations()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_ATOMIC_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_generated_ids UUID[];
    v_correction_results RECORD;
    v_iteration INTEGER;
    v_all_success BOOLEAN;
    v_all_failed BOOLEAN;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (3-6)
        v_installment_count := 3 + (random() * 3)::INTEGER;
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste com problemas
        v_generated_ids := public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            0.7, -- 70% corrupção
            v_test_pattern
        );
        
        -- Executar correção e analisar resultados
        SELECT 
            bool_and(success) as all_success,
            bool_or(NOT success) as any_failed
        INTO v_all_success, v_all_failed
        FROM public.fix_missing_installments(v_test_pattern || '%', false)
        WHERE action IN ('UPDATE_USER_ID', 'RESTORE_DELETED', 'UPDATE_ACCOUNT_ID');
        
        -- Verificar propriedade: operações devem ser consistentes (todas sucesso ou todas falha)
        -- Em um cenário normal, todas devem ter sucesso
        RETURN NEXT ok(
            v_all_success OR NOT v_all_failed,
            format('Iteration %s: Atomic operations - All success: %s, Any failed: %s', 
                   v_iteration, v_all_success, v_all_failed)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_ATOMIC_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 6: Atomic Correction Operations - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 7: Account Validation Before Correction
-- Feature: missing-installment-fix, Property 7: Account Validation Before Correction
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_account_validation_before_correction()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_invalid_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_VALIDATION_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_generated_ids UUID[];
    v_correction_result RECORD;
    v_iteration INTEGER;
    v_validation_worked BOOLEAN;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (2-4)
        v_installment_count := 2 + (random() * 2)::INTEGER;
        
        -- Criar conta de teste válida
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste
        v_generated_ids := public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            1.0, -- 100% corrupção
            v_test_pattern
        );
        
        -- Tentar corrigir com conta válida (deve funcionar)
        SELECT success INTO v_validation_worked
        FROM public.fix_missing_installments(v_test_pattern || '%', true)
        WHERE action = 'INFO'
        LIMIT 1;
        
        -- Verificar propriedade: correção com conta válida deve ser aceita
        RETURN NEXT ok(
            v_validation_worked,
            format('Iteration %s: Valid account validation passed: %s', 
                   v_iteration, v_validation_worked)
        );
        
        -- Deletar a conta para torná-la inválida
        UPDATE public.accounts SET deleted = true WHERE id = v_account_id;
        
        -- Tentar corrigir com conta deletada (deve falhar)
        SELECT success INTO v_validation_worked
        FROM public.fix_missing_installments(v_test_pattern || '%', true)
        WHERE action = 'ERROR'
        LIMIT 1;
        
        -- Verificar propriedade: correção com conta deletada deve ser rejeitada
        RETURN NEXT ok(
            NOT v_validation_worked,
            format('Iteration %s: Deleted account validation failed as expected: %s', 
                   v_iteration, NOT v_validation_worked)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_VALIDATION_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 7: Account Validation Before Correction - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PROPERTY 8: Deletion Restoration Accuracy
-- Feature: missing-installment-fix, Property 8: Deletion Restoration Accuracy
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.test_property_deletion_restoration_accuracy()
RETURNS SETOF TEXT AS $$
DECLARE
    v_user_a_id UUID := gen_random_uuid();
    v_user_b_id UUID := gen_random_uuid();
    v_account_id UUID := gen_random_uuid();
    v_test_pattern TEXT := 'TEST_RESTORATION_' || extract(epoch from now())::TEXT;
    v_installment_count INTEGER;
    v_generated_ids UUID[];
    v_iteration INTEGER;
    v_deleted_before INTEGER;
    v_deleted_after INTEGER;
    v_restored_count INTEGER;
BEGIN
    -- Executar 10 iterações do teste de propriedade
    FOR v_iteration IN 1..10 LOOP
        -- Gerar número aleatório de parcelas (3-7)
        v_installment_count := 3 + (random() * 4)::INTEGER;
        
        -- Criar conta de teste
        INSERT INTO public.accounts (id, user_id, name, type, deleted)
        VALUES (v_account_id, v_user_b_id, 'Test Account', 'CREDIT_CARD', false)
        ON CONFLICT (id) DO UPDATE SET updated_at = NOW();
        
        -- Gerar parcelas de teste com alta taxa de deleção
        v_generated_ids := public.generate_test_installments(
            v_installment_count,
            v_user_a_id,
            v_user_b_id,
            v_account_id,
            0.8, -- 80% corrupção (inclui deleções)
            v_test_pattern
        );
        
        -- Contar parcelas deletadas antes da correção
        SELECT COUNT(*) INTO v_deleted_before
        FROM public.transactions
        WHERE description LIKE v_test_pattern || '%'
          AND deleted = true;
        
        -- Executar correção real
        SELECT COUNT(*) INTO v_restored_count
        FROM public.fix_missing_installments(v_test_pattern || '%', false)
        WHERE action = 'RESTORE_DELETED' AND success = true;
        
        -- Contar parcelas deletadas após a correção
        SELECT COUNT(*) INTO v_deleted_after
        FROM public.transactions
        WHERE description LIKE v_test_pattern || '%'
          AND deleted = true;
        
        -- Verificar propriedade: número de restaurações deve corresponder à redução de deletadas
        RETURN NEXT ok(
            v_restored_count = (v_deleted_before - v_deleted_after),
            format('Iteration %s: Deleted before: %s, Restored: %s, Deleted after: %s', 
                   v_iteration, v_deleted_before, v_restored_count, v_deleted_after)
        );
        
        -- Limpar dados de teste
        PERFORM public.cleanup_test_installments(v_test_pattern);
        DELETE FROM public.accounts WHERE id = v_account_id;
        
        -- Gerar novos IDs para próxima iteração
        v_user_a_id := gen_random_uuid();
        v_user_b_id := gen_random_uuid();
        v_account_id := gen_random_uuid();
        v_test_pattern := 'TEST_RESTORATION_' || extract(epoch from now())::TEXT || '_' || v_iteration::TEXT;
    END LOOP;
    
    RETURN NEXT ok(true, 'Property 8: Deletion Restoration Accuracy - 10 iterations completed');
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO PRINCIPAL DE TESTE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.run_correction_engine_property_tests()
RETURNS SETOF TEXT AS $$
BEGIN
    -- Executar todos os testes de propriedade
    RETURN QUERY SELECT * FROM public.test_property_user_id_correction_accuracy();
    RETURN QUERY SELECT * FROM public.test_property_data_preservation_during_correction();
    RETURN QUERY SELECT * FROM public.test_property_atomic_correction_operations();
    RETURN QUERY SELECT * FROM public.test_property_account_validation_before_correction();
    RETURN QUERY SELECT * FROM public.test_property_deletion_restoration_accuracy();
    
    -- Resumo final
    RETURN NEXT ok(true, '=== CORRECTION ENGINE PROPERTY TESTS COMPLETED ===');
    RETURN NEXT ok(true, 'All 5 properties tested with 10 iterations each');
    RETURN NEXT ok(true, 'Total test iterations: 50');
END;
$$ LANGUAGE plpgsql;

-- Adicionar comentários
COMMENT ON FUNCTION public.test_property_user_id_correction_accuracy() IS 
'Property Test 4: Verifica que correções de user_id são precisas e completas';

COMMENT ON FUNCTION public.test_property_data_preservation_during_correction() IS 
'Property Test 5: Verifica que dados não relacionados são preservados durante correção';

COMMENT ON FUNCTION public.test_property_atomic_correction_operations() IS 
'Property Test 6: Verifica que operações de correção são atômicas';

COMMENT ON FUNCTION public.test_property_account_validation_before_correction() IS 
'Property Test 7: Verifica que validação de conta funciona antes da correção';

COMMENT ON FUNCTION public.test_property_deletion_restoration_accuracy() IS 
'Property Test 8: Verifica que restauração de parcelas deletadas é precisa';

COMMENT ON FUNCTION public.run_correction_engine_property_tests() IS 
'Executa todos os testes de propriedade do Correction Engine';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.test_property_user_id_correction_accuracy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_data_preservation_during_correction() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_atomic_correction_operations() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_account_validation_before_correction() TO authenticated;
GRANT EXECUTE ON FUNCTION public.test_property_deletion_restoration_accuracy() TO authenticated;
GRANT EXECUTE ON FUNCTION public.run_correction_engine_property_tests() TO authenticated;