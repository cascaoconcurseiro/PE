-- ==============================================================================
-- ENCONTRAR A 10ª PARCELA FALTANTE
-- DATA: 2025-12-21
-- OBJETIVO: Verificar status, data e categoria da parcela que não aparece
-- ==============================================================================

DO $$
DECLARE
    v_installment_info RECORD;
    v_total_count INTEGER;
    v_paid_count INTEGER;
    v_unpaid_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'PROCURANDO A 10ª PARCELA FALTANTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- CONTAR PARCELAS POR STATUS
    -- =========================================================================
    SELECT COUNT(*) INTO v_total_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%';
    
    SELECT COUNT(*) INTO v_paid_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%'
      AND (paid = true OR status = 'PAID' OR status = 'CRÉDITO');
    
    SELECT COUNT(*) INTO v_unpaid_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%'
      AND (paid = false OR paid IS NULL OR status = 'DÉBITO' OR status IS NULL);
    
    RAISE NOTICE 'CONTAGEM POR STATUS:';
    RAISE NOTICE '  Total de parcelas: %', v_total_count;
    RAISE NOTICE '  Parcelas pagas: %', v_paid_count;
    RAISE NOTICE '  Parcelas não pagas: %', v_unpaid_count;
    RAISE NOTICE '';

    -- =========================================================================
    -- LISTAR TODAS AS PARCELAS COM DETALHES
    -- =========================================================================
    RAISE NOTICE 'DETALHES DE TODAS AS PARCELAS:';
    RAISE NOTICE '';
    
    FOR v_installment_info IN
        SELECT 
            id,
            description,
            amount,
            current_installment,
            total_installments,
            date,
            category,
            type,
            paid,
            status,
            user_id,
            account_id,
            created_at
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        ORDER BY current_installment
    LOOP
        RAISE NOTICE 'Parcela %/%:', v_installment_info.current_installment, v_installment_info.total_installments;
        RAISE NOTICE '  ID: %', v_installment_info.id;
        RAISE NOTICE '  Descrição: %', v_installment_info.description;
        RAISE NOTICE '  Valor: R$ %', v_installment_info.amount;
        RAISE NOTICE '  Data: %', v_installment_info.date;
        RAISE NOTICE '  Categoria: %', v_installment_info.category;
        RAISE NOTICE '  Tipo: %', v_installment_info.type;
        RAISE NOTICE '  Pago: %', COALESCE(v_installment_info.paid::text, 'NULL');
        RAISE NOTICE '  Status: %', COALESCE(v_installment_info.status, 'NULL');
        RAISE NOTICE '  User ID: %', v_installment_info.user_id;
        RAISE NOTICE '  Account ID: %', v_installment_info.account_id;
        RAISE NOTICE '  Criado em: %', v_installment_info.created_at;
        RAISE NOTICE '';
    END LOOP;

    -- =========================================================================
    -- VERIFICAR PARCELAS POR MÊS
    -- =========================================================================
    RAISE NOTICE 'PARCELAS POR MÊS:';
    FOR v_installment_info IN
        SELECT 
            EXTRACT(YEAR FROM date) as year,
            EXTRACT(MONTH FROM date) as month,
            COUNT(*) as count
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
        ORDER BY year, month
    LOOP
        RAISE NOTICE '  %/% - % parcelas', v_installment_info.month, v_installment_info.year, v_installment_info.count;
    END LOOP;
    RAISE NOTICE '';

    -- =========================================================================
    -- VERIFICAR PARCELAS POR CATEGORIA
    -- =========================================================================
    RAISE NOTICE 'PARCELAS POR CATEGORIA:';
    FOR v_installment_info IN
        SELECT 
            category,
            COUNT(*) as count
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        GROUP BY category
        ORDER BY count DESC
    LOOP
        RAISE NOTICE '  % - % parcelas', v_installment_info.category, v_installment_info.count;
    END LOOP;
    RAISE NOTICE '';

    -- =========================================================================
    -- RESULTADO E RECOMENDAÇÕES
    -- =========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ANÁLISE COMPLETA';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_total_count = 10 THEN
        RAISE NOTICE '✅ TODAS AS 10 PARCELAS EXISTEM NO BANCO';
        RAISE NOTICE '';
        RAISE NOTICE 'POSSÍVEIS CAUSAS DO FILTRO:';
        RAISE NOTICE '  1. Filtro por status (pago/não pago)';
        RAISE NOTICE '  2. Filtro por data (mês diferente)';
        RAISE NOTICE '  3. Filtro por categoria';
        RAISE NOTICE '  4. Cache do navegador';
        RAISE NOTICE '';
        RAISE NOTICE 'SOLUÇÕES:';
        RAISE NOTICE '  - Limpe filtros na aplicação';
        RAISE NOTICE '  - Verifique mês selecionado';
        RAISE NOTICE '  - Limpe cache (Ctrl+Shift+R)';
    ELSE
        RAISE NOTICE '❌ FALTAM % PARCELAS NO BANCO', (10 - v_total_count);
        RAISE NOTICE 'É necessário recriar as parcelas faltantes';
    END IF;
    RAISE NOTICE '';

END $$;