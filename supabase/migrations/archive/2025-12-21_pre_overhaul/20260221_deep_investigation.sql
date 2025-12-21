-- ==============================================================================
-- INVESTIGAÇÃO PROFUNDA: POR QUE A PARCELA NÃO APARECE
-- DATA: 2025-12-21
-- OBJETIVO: Simular exatamente como o frontend busca os dados
-- ==============================================================================

DO $$
DECLARE
    v_user_b_id UUID;
    v_account_id UUID;
    v_installment_info RECORD;
    v_count INTEGER;
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'INVESTIGAÇÃO PROFUNDA - PARCELA FALTANTE';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 1: IDENTIFICAR USUÁRIO B E CONTA
    -- =========================================================================
    -- Buscar o usuário que deveria ver as parcelas
    SELECT DISTINCT a.user_id, a.id INTO v_user_b_id, v_account_id
    FROM public.accounts a
    JOIN public.transactions t ON t.account_id = a.id
    WHERE t.is_installment = true
      AND t.description LIKE '%Wesley%'
      AND a.deleted = false
    LIMIT 1;
    
    RAISE NOTICE '1. IDENTIFICAÇÃO:';
    RAISE NOTICE '   Usuário B ID: %', v_user_b_id;
    RAISE NOTICE '   Conta ID: %', v_account_id;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 2: SIMULAR QUERY DO FRONTEND - LANÇAMENTOS
    -- =========================================================================
    RAISE NOTICE '2. SIMULANDO QUERY DO FRONTEND (Tela Lançamentos):';
    RAISE NOTICE '';
    
    -- Query típica do frontend para lançamentos
    RAISE NOTICE '   Query: SELECT * FROM transactions WHERE user_id = % AND deleted = false', v_user_b_id;
    
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE user_id = v_user_b_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE '%Wesley%';
    
    RAISE NOTICE '   Resultado: % parcelas encontradas', v_count;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 3: VERIFICAR FILTROS ADICIONAIS
    -- =========================================================================
    RAISE NOTICE '3. VERIFICANDO FILTROS ADICIONAIS:';
    RAISE NOTICE '';
    
    -- Filtro por data (Janeiro 2026)
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE user_id = v_user_b_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE '%Wesley%'
      AND EXTRACT(YEAR FROM date) = 2026
      AND EXTRACT(MONTH FROM date) = 1;
    
    RAISE NOTICE '   Com filtro Janeiro 2026: % parcelas', v_count;
    
    -- Filtro por tipo DESPESA
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE user_id = v_user_b_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE '%Wesley%'
      AND type = 'DESPESA';
    
    RAISE NOTICE '   Apenas DESPESAS: % parcelas', v_count;
    
    -- Filtro por conta específica
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE user_id = v_user_b_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE '%Wesley%'
      AND account_id = v_account_id;
    
    RAISE NOTICE '   Na conta específica: % parcelas', v_count;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 4: LISTAR TODAS AS PARCELAS COM STATUS DETALHADO
    -- =========================================================================
    RAISE NOTICE '4. LISTAGEM COMPLETA COM STATUS:';
    RAISE NOTICE '';
    
    FOR v_installment_info IN
        SELECT 
            id,
            description,
            current_installment,
            total_installments,
            amount,
            date,
            type,
            category,
            user_id,
            account_id,
            deleted,
            created_at,
            updated_at,
            CASE 
                WHEN user_id = v_user_b_id THEN '✅ USER_ID CORRETO'
                ELSE '❌ USER_ID ERRADO: ' || user_id
            END as user_status,
            CASE 
                WHEN deleted = true THEN '❌ DELETADO'
                ELSE '✅ ATIVO'
            END as delete_status,
            CASE 
                WHEN account_id = v_account_id THEN '✅ CONTA CORRETA'
                ELSE '❌ CONTA ERRADA: ' || account_id
            END as account_status
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE '%Wesley%'
        ORDER BY current_installment
    LOOP
        RAISE NOTICE 'PARCELA %/%:', v_installment_info.current_installment, v_installment_info.total_installments;
        RAISE NOTICE '  ID: %', v_installment_info.id;
        RAISE NOTICE '  Descrição: %', v_installment_info.description;
        RAISE NOTICE '  Valor: R$ %', v_installment_info.amount;
        RAISE NOTICE '  Data: %', v_installment_info.date;
        RAISE NOTICE '  Tipo: %', v_installment_info.type;
        RAISE NOTICE '  Categoria: %', v_installment_info.category;
        RAISE NOTICE '  %', v_installment_info.user_status;
        RAISE NOTICE '  %', v_installment_info.delete_status;
        RAISE NOTICE '  %', v_installment_info.account_status;
        RAISE NOTICE '  Criado: %', v_installment_info.created_at;
        RAISE NOTICE '  Atualizado: %', v_installment_info.updated_at;
        
        -- Verificar se esta parcela seria visível no frontend
        IF v_installment_info.user_id = v_user_b_id 
           AND v_installment_info.deleted = false 
           AND v_installment_info.account_id = v_account_id THEN
            RAISE NOTICE '  🟢 VISÍVEL NO FRONTEND';
        ELSE
            RAISE NOTICE '  🔴 NÃO VISÍVEL NO FRONTEND';
        END IF;
        RAISE NOTICE '';
    END LOOP;

    -- =========================================================================
    -- PASSO 5: VERIFICAR PROBLEMAS ESPECÍFICOS
    -- =========================================================================
    RAISE NOTICE '5. VERIFICANDO PROBLEMAS ESPECÍFICOS:';
    RAISE NOTICE '';
    
    -- Parcelas com user_id diferente
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%'
      AND user_id != v_user_b_id;
    
    IF v_count > 0 THEN
        RAISE NOTICE '   ❌ PROBLEMA: % parcelas com user_id errado', v_count;
        
        FOR v_installment_info IN
            SELECT id, current_installment, user_id
            FROM public.transactions
            WHERE is_installment = true
              AND description LIKE '%Wesley%'
              AND user_id != v_user_b_id
        LOOP
            RAISE NOTICE '     - Parcela %: user_id = %', v_installment_info.current_installment, v_installment_info.user_id;
        END LOOP;
    ELSE
        RAISE NOTICE '   ✅ Todos os user_id estão corretos';
    END IF;
    
    -- Parcelas deletadas
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%'
      AND deleted = true;
    
    IF v_count > 0 THEN
        RAISE NOTICE '   ❌ PROBLEMA: % parcelas deletadas', v_count;
    ELSE
        RAISE NOTICE '   ✅ Nenhuma parcela deletada';
    END IF;
    
    -- Parcelas em contas diferentes
    SELECT COUNT(DISTINCT account_id) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE '%Wesley%';
    
    IF v_count > 1 THEN
        RAISE NOTICE '   ⚠️  ATENÇÃO: Parcelas em % contas diferentes', v_count;
        
        FOR v_installment_info IN
            SELECT DISTINCT account_id, COUNT(*) as count
            FROM public.transactions
            WHERE is_installment = true
              AND description LIKE '%Wesley%'
            GROUP BY account_id
        LOOP
            RAISE NOTICE '     - Conta %: % parcelas', v_installment_info.account_id, v_installment_info.count;
        END LOOP;
    ELSE
        RAISE NOTICE '   ✅ Todas as parcelas na mesma conta';
    END IF;
    RAISE NOTICE '';

    -- =========================================================================
    -- PASSO 6: RECOMENDAÇÕES FINAIS
    -- =========================================================================
    RAISE NOTICE '========================================';
    RAISE NOTICE 'RECOMENDAÇÕES FINAIS';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Verifique os resultados acima';
    RAISE NOTICE '2. Identifique parcelas com 🔴 NÃO VISÍVEL NO FRONTEND';
    RAISE NOTICE '3. Corrija os problemas identificados';
    RAISE NOTICE '4. Limpe cache do navegador (Ctrl+Shift+R)';
    RAISE NOTICE '5. Verifique filtros na aplicação';
    RAISE NOTICE '';

END $$;