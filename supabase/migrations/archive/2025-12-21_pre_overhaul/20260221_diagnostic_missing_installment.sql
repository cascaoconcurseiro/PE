-- ==============================================================================
-- DIAGNÓSTICO: ENCONTRAR PARCELA FALTANTE
-- DATA: 2025-12-21
-- OBJETIVO: Investigar por que aparecem apenas 9 de 10 parcelas
-- ==============================================================================

DO $$
DECLARE
    v_user_b_id UUID;
    v_account_id UUID;
    v_total_installments INTEGER;
    v_visible_installments INTEGER;
    v_hidden_installments INTEGER;
    v_different_user_id INTEGER;
    v_deleted_installments INTEGER;
    v_series_info RECORD;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'DIAGNÓSTICO: PARCELA FALTANTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 1: IDENTIFICAR O USUÁRIO B E SUA CONTA
    -- =========================================================================
    RAISE NOTICE '1. IDENTIFICANDO USUÁRIO B...';
    
    -- Assumindo que o usuário B é aquele que tem conta mas não importou
    -- Vamos buscar contas com parcelas
    SELECT DISTINCT a.user_id, a.id INTO v_user_b_id, v_account_id
    FROM public.accounts a
    JOIN public.transactions t ON t.account_id = a.id
    WHERE t.is_installment = true
      AND a.deleted = false
    LIMIT 1;
    
    IF v_user_b_id IS NULL THEN
        RAISE NOTICE '   ❌ Nenhuma conta com parcelas encontrada';
        RETURN;
    END IF;
    
    RAISE NOTICE '   ✅ Usuário B ID: %', v_user_b_id;
    RAISE NOTICE '   ✅ Conta ID: %', v_account_id;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 2: CONTAR TODAS AS PARCELAS RELACIONADAS À CONTA
    -- =========================================================================
    RAISE NOTICE '2. CONTANDO PARCELAS...';
    
    -- Total de parcelas na conta
    SELECT COUNT(*) INTO v_total_installments
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true;
    
    -- Parcelas visíveis para o usuário B
    SELECT COUNT(*) INTO v_visible_installments
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true
      AND user_id = v_user_b_id;
    
    -- Parcelas com user_id diferente
    SELECT COUNT(*) INTO v_different_user_id
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true
      AND user_id != v_user_b_id;
    
    -- Parcelas deletadas
    SELECT COUNT(*) INTO v_deleted_installments
    FROM public.transactions
    WHERE account_id = v_account_id
      AND is_installment = true
      AND deleted = true;
    
    RAISE NOTICE '   Total de parcelas na conta: %', v_total_installments;
    RAISE NOTICE '   Parcelas visíveis para usuário B: %', v_visible_installments;
    RAISE NOTICE '   Parcelas com user_id diferente: %', v_different_user_id;
    RAISE NOTICE '   Parcelas deletadas: %', v_deleted_installments;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 3: ANALISAR SÉRIES DE PARCELAS
    -- =========================================================================
    RAISE NOTICE '3. ANALISANDO SÉRIES DE PARCELAS...';
    
    FOR v_series_info IN
        SELECT 
            series_id,
            COUNT(*) as total_in_series,
            MIN(current_installment) as first_installment,
            MAX(current_installment) as last_installment,
            MAX(total_installments) as expected_total,
            COUNT(CASE WHEN user_id = v_user_b_id THEN 1 END) as visible_to_user_b,
            COUNT(CASE WHEN user_id != v_user_b_id THEN 1 END) as wrong_user_id,
            COUNT(CASE WHEN deleted = true THEN 1 END) as deleted_count
        FROM public.transactions
        WHERE account_id = v_account_id
          AND is_installment = true
          AND series_id IS NOT NULL
        GROUP BY series_id
        ORDER BY series_id
    LOOP
        RAISE NOTICE '   Série: %', v_series_info.series_id;
        RAISE NOTICE '     - Total na série: %', v_series_info.total_in_series;
        RAISE NOTICE '     - Esperado: %', v_series_info.expected_total;
        RAISE NOTICE '     - Primeira parcela: %', v_series_info.first_installment;
        RAISE NOTICE '     - Última parcela: %', v_series_info.last_installment;
        RAISE NOTICE '     - Visíveis para usuário B: %', v_series_info.visible_to_user_b;
        RAISE NOTICE '     - Com user_id errado: %', v_series_info.wrong_user_id;
        RAISE NOTICE '     - Deletadas: %', v_series_info.deleted_count;
        
        IF v_series_info.total_in_series != v_series_info.expected_total THEN
            RAISE NOTICE '     ❌ PROBLEMA: Série incompleta!';
        END IF;
        
        IF v_series_info.wrong_user_id > 0 THEN
            RAISE NOTICE '     ❌ PROBLEMA: Parcelas com user_id errado!';
        END IF;
        
        RAISE NOTICE '';
    END LOOP;

    -- =========================================================================
    -- PASSO 4: LISTAR PARCELAS PROBLEMÁTICAS
    -- =========================================================================
    RAISE NOTICE '4. LISTANDO PARCELAS PROBLEMÁTICAS...';
    
    -- Parcelas com user_id errado
    IF v_different_user_id > 0 THEN
        RAISE NOTICE '   PARCELAS COM USER_ID ERRADO:';
        FOR v_series_info IN
            SELECT 
                id,
                description,
                current_installment,
                total_installments,
                series_id,
                user_id,
                created_at
            FROM public.transactions
            WHERE account_id = v_account_id
              AND is_installment = true
              AND user_id != v_user_b_id
            ORDER BY series_id, current_installment
        LOOP
            RAISE NOTICE '     - ID: %, Desc: %, Parcela: %/%, User: %, Criado: %', 
                v_series_info.id, 
                v_series_info.description, 
                v_series_info.current_installment,
                v_series_info.total_installments,
                v_series_info.user_id,
                v_series_info.created_at;
        END LOOP;
        RAISE NOTICE '';
    END IF;

    -- =========================================================================
    -- PASSO 5: VERIFICAR FILTROS NO FRONTEND
    -- =========================================================================
    RAISE NOTICE '5. POSSÍVEIS CAUSAS NO FRONTEND...';
    RAISE NOTICE '   - Filtro por data (mês/ano atual)';
    RAISE NOTICE '   - Filtro por categoria';
    RAISE NOTICE '   - Filtro por status (pago/não pago)';
    RAISE NOTICE '   - Paginação limitando resultados';
    RAISE NOTICE '   - Cache desatualizado';
    RAISE NOTICE '';

    -- =========================================================================
    -- RESULTADO FINAL E RECOMENDAÇÕES
    -- =========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RESUMO DO DIAGNÓSTICO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    IF v_different_user_id > 0 THEN
        RAISE NOTICE '❌ PROBLEMA ENCONTRADO: % parcelas com user_id errado', v_different_user_id;
        RAISE NOTICE 'SOLUÇÃO: Execute o script de correção novamente';
    ELSIF v_total_installments = 10 AND v_visible_installments = 9 THEN
        RAISE NOTICE '⚠️  PROBLEMA PARCIAL: 1 parcela não visível';
        RAISE NOTICE 'POSSÍVEIS CAUSAS:';
        RAISE NOTICE '  - Filtro de data no frontend';
        RAISE NOTICE '  - Parcela em mês diferente';
        RAISE NOTICE '  - Cache do navegador';
    ELSE
        RAISE NOTICE '✅ DADOS CORRETOS NO BANCO';
        RAISE NOTICE 'PROBLEMA PODE SER NO FRONTEND:';
        RAISE NOTICE '  - Verifique filtros de data';
        RAISE NOTICE '  - Limpe cache do navegador';
        RAISE NOTICE '  - Verifique paginação';
    END IF;
    RAISE NOTICE '';

END $$;