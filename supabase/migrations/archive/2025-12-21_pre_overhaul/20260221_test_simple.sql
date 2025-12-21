-- ==============================================================================
-- TEST SCRIPT SIMPLES: Verificar Fix de Importação de Parcelas
-- DATA: 2025-12-21
-- OBJETIVO: Testar apenas se as funções foram criadas corretamente
-- ==============================================================================

DO $$
DECLARE
    v_function_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICANDO FIX DE IMPORTAÇÃO DE PARCELAS';
    RAISE NOTICE '========================================';

    -- =========================================================================
    -- TESTE 1: Verificar se a função can_access_account existe
    -- =========================================================================
    RAISE NOTICE '1. Verificando função can_access_account...';
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'can_access_account'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
        RAISE NOTICE '   ✅ PASSOU: Função can_access_account existe';
    ELSE
        RAISE EXCEPTION '   ❌ FALHOU: Função can_access_account não encontrada';
    END IF;

    -- =========================================================================
    -- TESTE 2: Verificar se create_transaction existe
    -- =========================================================================
    RAISE NOTICE '2. Verificando função create_transaction...';
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_transaction'
        AND pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
        RAISE NOTICE '   ✅ PASSOU: Função create_transaction existe';
    ELSE
        RAISE EXCEPTION '   ❌ FALHOU: Função create_transaction não encontrada';
    END IF;

    -- =========================================================================
    -- TESTE 3: Verificar se create_transaction foi atualizado com o fix
    -- =========================================================================
    RAISE NOTICE '3. Verificando se create_transaction contém o fix...';
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_transaction'
        AND pg_get_functiondef(oid) LIKE '%can_access_account%'
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
        RAISE NOTICE '   ✅ PASSOU: create_transaction contém o fix (usa can_access_account)';
    ELSE
        RAISE EXCEPTION '   ❌ FALHOU: create_transaction não contém o fix';
    END IF;

    -- =========================================================================
    -- RESULTADO FINAL
    -- =========================================================================
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TODOS OS TESTES PASSARAM!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'A migration foi aplicada com sucesso:';
    RAISE NOTICE '  ✅ Função can_access_account criada';
    RAISE NOTICE '  ✅ Função create_transaction atualizada com fix';
    RAISE NOTICE '  ✅ Fix de user_id implementado';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMO PASSO:';
    RAISE NOTICE 'Teste via aplicação frontend para confirmar funcionamento';

END $$;