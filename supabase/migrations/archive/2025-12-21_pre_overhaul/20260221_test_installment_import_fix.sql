-- ==============================================================================
-- TEST SCRIPT: Verificar Fix de Importação de Parcelas
-- DATA: 2026-02-21
-- OBJETIVO: Testar se a função can_access_account() foi criada corretamente
-- ==============================================================================
-- 
-- NOTA: Este teste verifica apenas a função auxiliar can_access_account().
-- O teste completo de create_transaction requer autenticação e deve ser feito
-- via aplicação frontend ou com um usuário autenticado no Supabase.
-- 
-- INSTRUÇÕES:
-- 1. Execute este script APÓS aplicar a migration 20260221_fix_installment_import_user_id.sql
-- 2. Verifique os resultados de cada teste
-- 3. Todos os testes devem passar (✅)
-- ==============================================================================

DO $$
DECLARE
    v_user_a_id UUID;
    v_account_a_id UUID;
    v_function_exists BOOLEAN;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICANDO FIX DE IMPORTAÇÃO DE PARCELAS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- TESTE 1: Verificar se a função can_access_account existe
    -- =========================================================================
    RAISE NOTICE '1. TESTE 1: Verificar se função can_access_account existe...';
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'can_access_account'
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
        RAISE NOTICE '   ✅ PASSOU: Função can_access_account existe';
    ELSE
        RAISE EXCEPTION '   ❌ FALHOU: Função can_access_account não encontrada';
    END IF;
    RAISE NOTICE '';

    -- =========================================================================
    -- TESTE 2: Verificar se create_transaction foi atualizado
    -- =========================================================================
    RAISE NOTICE '2. TESTE 2: Verificar se create_transaction foi atualizado...';
    
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_transaction'
        AND pg_get_functiondef(oid) LIKE '%can_access_account%'
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
        RAISE NOTICE '   ✅ PASSOU: create_transaction usa can_access_account';
    ELSE
        RAISE EXCEPTION '   ❌ FALHOU: create_transaction não foi atualizado';
    END IF;
    RAISE NOTICE '';

    -- =========================================================================
    -- TESTE 3: Testar can_access_account com dados reais
    -- =========================================================================
    RAISE NOTICE '3. TESTE 3: Testar função can_access_account...';
    
    -- Buscar um usuário real
    SELECT id INTO v_user_a_id FROM auth.users LIMIT 1;
    
    IF v_user_a_id IS NULL THEN
        RAISE NOTICE '   ⚠️  AVISO: Nenhum usuário encontrado, pulando teste com dados reais';
    ELSE
        -- Criar conta de teste
        INSERT INTO public.accounts (
            user_id, name, type, balance, currency, initial_balance, deleted
        ) VALUES (
            v_user_a_id, 'Conta Teste Validação', 'CONTA CORRENTE', 0, 'BRL', 0, false
        ) RETURNING id INTO v_account_a_id;
        
        -- Teste 3.1: Dono da conta deve ter acesso
        IF public.can_access_account(v_account_a_id, v_user_a_id) THEN
            RAISE NOTICE '   ✅ PASSOU: Dono da conta tem acesso';
        ELSE
            RAISE EXCEPTION '   ❌ FALHOU: Dono da conta não tem acesso';
        END IF;
        
        -- Teste 3.2: Usuário aleatório não deve ter acesso
        IF NOT public.can_access_account(v_account_a_id, gen_random_uuid()) THEN
            RAISE NOTICE '   ✅ PASSOU: Usuário aleatório não tem acesso';
        ELSE
            RAISE EXCEPTION '   ❌ FALHOU: Usuário aleatório tem acesso (falha de segurança!)';
        END IF;
        
        -- Teste 3.3: Conta inexistente deve retornar false
        IF NOT public.can_access_account(gen_random_uuid(), v_user_a_id) THEN
            RAISE NOTICE '   ✅ PASSOU: Conta inexistente retorna false';
        ELSE
            RAISE EXCEPTION '   ❌ FALHOU: Conta inexistente retorna true';
        END IF;
        
        -- Cleanup
        DELETE FROM public.accounts WHERE id = v_account_a_id;
        RAISE NOTICE '   ✅ Dados de teste removidos';
    END IF;
    RAISE NOTICE '';

    -- =========================================================================
    -- TESTE 4: Verificar estrutura da função create_transaction
    -- =========================================================================
    RAISE NOTICE '4. TESTE 4: Verificar estrutura de create_transaction...';
    
    -- Verificar se a função busca o dono da conta
    SELECT EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_transaction'
        AND pg_get_functiondef(oid) LIKE '%SELECT user_id INTO%FROM%accounts%'
    ) INTO v_function_exists;
    
    IF v_function_exists THEN
        RAISE NOTICE '   ✅ PASSOU: create_transaction busca user_id do dono da conta';
    ELSE
        RAISE EXCEPTION '   ❌ FALHOU: create_transaction não busca user_id do dono da conta';
    END IF;
    RAISE NOTICE '';

    -- =========================================================================
    -- RESULTADO FINAL
    -- =========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE '✅ TODOS OS TESTES DE ESTRUTURA PASSARAM!';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'A migration foi aplicada corretamente:';
    RAISE NOTICE '  ✅ Função can_access_account criada';
    RAISE NOTICE '  ✅ Função create_transaction atualizada';
    RAISE NOTICE '  ✅ Validações de segurança funcionando';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMO PASSO:';
    RAISE NOTICE 'Teste funcional via aplicação frontend:';
    RAISE NOTICE '  1. Faça login como usuário A';
    RAISE NOTICE '  2. Importe faturas para uma conta';
    RAISE NOTICE '  3. Verifique se as faturas aparecem corretamente';
    RAISE NOTICE '';

END $$;
