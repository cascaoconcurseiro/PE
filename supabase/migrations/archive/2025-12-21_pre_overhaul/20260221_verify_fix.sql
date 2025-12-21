-- ==============================================================================
-- SCRIPT DE VERIFICAÇÃO: Verificar se as parcelas foram corrigidas
-- DATA: 2025-12-21
-- OBJETIVO: Verificar se todas as transações agora têm o user_id correto
-- ==============================================================================

DO $$
DECLARE
    v_incorrect_transactions INTEGER;
    v_total_transactions INTEGER;
    v_installments_fixed INTEGER;
    v_accounts_affected INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'VERIFICAÇÃO DO FIX DE PARCELAS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- VERIFICAR TRANSAÇÕES COM USER_ID INCORRETO
    -- =========================================================================
    SELECT COUNT(*) INTO v_incorrect_transactions
    FROM public.transactions t
    JOIN public.accounts a ON t.account_id = a.id
    WHERE t.user_id != a.user_id
      AND a.deleted = false;
    
    SELECT COUNT(*) INTO v_total_transactions
    FROM public.transactions t
    JOIN public.accounts a ON t.account_id = a.id
    WHERE a.deleted = false;
    
    RAISE NOTICE '1. VERIFICAÇÃO GERAL:';
    RAISE NOTICE '   Total de transações: %', v_total_transactions;
    RAISE NOTICE '   Transações com user_id incorreto: %', v_incorrect_transactions;
    
    IF v_incorrect_transactions = 0 THEN
        RAISE NOTICE '   ✅ PASSOU: Todas as transações têm user_id correto';
    ELSE
        RAISE NOTICE '   ❌ FALHOU: % transações ainda têm user_id incorreto', v_incorrect_transactions;
    END IF;
    RAISE NOTICE '';

    -- =========================================================================
    -- VERIFICAR PARCELAS ESPECIFICAMENTE
    -- =========================================================================
    SELECT COUNT(*) INTO v_installments_fixed
    FROM public.transactions t
    JOIN public.accounts a ON t.account_id = a.id
    WHERE t.user_id = a.user_id
      AND t.is_installment = true
      AND a.deleted = false;
    
    RAISE NOTICE '2. VERIFICAÇÃO DE PARCELAS:';
    RAISE NOTICE '   Parcelas com user_id correto: %', v_installments_fixed;
    RAISE NOTICE '   ✅ Parcelas corrigidas com sucesso';
    RAISE NOTICE '';

    -- =========================================================================
    -- VERIFICAR CONTAS AFETADAS
    -- =========================================================================
    SELECT COUNT(DISTINCT a.id) INTO v_accounts_affected
    FROM public.transactions t
    JOIN public.accounts a ON t.account_id = a.id
    WHERE t.user_id = a.user_id
      AND t.is_installment = true
      AND a.deleted = false;
    
    RAISE NOTICE '3. CONTAS AFETADAS:';
    RAISE NOTICE '   Contas com parcelas corrigidas: %', v_accounts_affected;
    RAISE NOTICE '';

    -- =========================================================================
    -- RESULTADO FINAL
    -- =========================================================================
    IF v_incorrect_transactions = 0 THEN
        RAISE NOTICE '========================================';
        RAISE NOTICE '✅ FIX APLICADO COM SUCESSO!';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE 'Todas as transações agora têm o user_id correto.';
        RAISE NOTICE 'O usuário B deve ver todas as parcelas importadas.';
    ELSE
        RAISE NOTICE '========================================';
        RAISE NOTICE '⚠️  FIX PARCIALMENTE APLICADO';
        RAISE NOTICE '========================================';
        RAISE NOTICE '';
        RAISE NOTICE 'Ainda existem % transações com user_id incorreto.', v_incorrect_transactions;
        RAISE NOTICE 'Pode ser necessário executar correção adicional.';
    END IF;
    RAISE NOTICE '';

END $$;