DO $$
DECLARE
    v_user_id UUID;
    v_account_id UUID;
    v_result JSONB;
BEGIN
    RAISE NOTICE '1. Buscando usuário para teste...';
    SELECT id INTO v_user_id FROM auth.users LIMIT 1;
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Nenhum usuário encontrado na tabela auth.users';
    END IF;
    
    RAISE NOTICE '2. Buscando conta para o usuário %...', v_user_id;
    SELECT id INTO v_account_id FROM public.accounts WHERE user_id = v_user_id LIMIT 1;
    IF v_account_id IS NULL THEN
        RAISE NOTICE 'Aviso: Usuário não tem conta. Tentando criar transação sem conta (pode falhar se account_id for obrigatório)...';
        -- Tentar achar conta de qualquer user se falhar
        SELECT id INTO v_account_id FROM public.accounts LIMIT 1;
    END IF;

    RAISE NOTICE '3. Testando função import_shared_installments...';
    
    -- Tenta executar a função
    v_result := public.import_shared_installments(
        p_user_id := v_user_id,
        p_description := 'TESTE DEBUG RPC',
        p_parcel_amount := 10.00,
        p_installments := 2,
        p_first_due_date := CURRENT_DATE,
        p_category := 'Outros',
        p_account_id := v_account_id,
        p_shared_with_user_id := NULL
    );
    
    RAISE NOTICE 'SUCESSO! Resultado: %', v_result;

EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'FALHA NO TESTE ❌';
    RAISE NOTICE 'Erro: %', SQLERRM;
    RAISE NOTICE 'Código: %', SQLSTATE;
END $$;
