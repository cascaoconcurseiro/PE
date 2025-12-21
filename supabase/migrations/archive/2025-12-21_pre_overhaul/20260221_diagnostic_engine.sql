-- ==============================================================================
-- DIAGNOSTIC ENGINE: Missing Installment Fix
-- DATA: 2025-12-21
-- OBJETIVO: Implementar engine de diagnóstico para identificar parcelas faltantes
-- ==============================================================================

-- Criar função principal de diagnóstico
CREATE OR REPLACE FUNCTION public.diagnose_missing_installments(
    p_description_pattern TEXT DEFAULT '%Wesley%'
)
RETURNS TABLE (
    phase TEXT,
    status TEXT,
    message TEXT,
    details JSONB
) AS $
DECLARE
    v_user_a_id UUID;
    v_user_b_id UUID;
    v_account_id UUID;
    v_installment_info RECORD;
    v_count INTEGER;
    v_problems_found INTEGER := 0;
    v_total_installments INTEGER := 0;
    v_user_a_count INTEGER := 0;
    v_user_b_count INTEGER := 0;
BEGIN
    -- =========================================================================
    -- FASE 1: IDENTIFICAÇÃO DE USUÁRIOS E CONTA
    -- =========================================================================
    
    -- Retornar cabeçalho da fase
    phase := 'IDENTIFICATION';
    status := 'INFO';
    message := 'Iniciando identificação de usuários e conta';
    details := '{}';
    RETURN NEXT;
    
    -- Identificar usuário B (dono da conta) e conta
    SELECT DISTINCT a.user_id, a.id INTO v_user_b_id, v_account_id
    FROM public.accounts a
    JOIN public.transactions t ON t.account_id = a.id
    WHERE t.is_installment = true
      AND t.description LIKE p_description_pattern
      AND a.deleted = false
    LIMIT 1;
    
    IF v_user_b_id IS NULL OR v_account_id IS NULL THEN
        phase := 'IDENTIFICATION';
        status := 'ERROR';
        message := 'Não foi possível identificar usuário B ou conta';
        details := jsonb_build_object(
            'user_b_id', v_user_b_id,
            'account_id', v_account_id,
            'pattern', p_description_pattern
        );
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Identificar usuário A (quem pode ver mais parcelas)
    SELECT DISTINCT user_id INTO v_user_a_id
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern
      AND user_id != v_user_b_id
    LIMIT 1;
    
    -- Se não encontrou usuário A diferente, usar o mesmo que B
    IF v_user_a_id IS NULL THEN
        v_user_a_id := v_user_b_id;
    END IF;
    
    phase := 'IDENTIFICATION';
    status := 'SUCCESS';
    message := 'Usuários e conta identificados com sucesso';
    details := jsonb_build_object(
        'user_a_id', v_user_a_id,
        'user_b_id', v_user_b_id,
        'account_id', v_account_id,
        'pattern', p_description_pattern
    );
    RETURN NEXT;
    
    -- =========================================================================
    -- FASE 2: CONTAGEM DE PARCELAS POR USUÁRIO
    -- =========================================================================
    
    phase := 'COUNT_ANALYSIS';
    status := 'INFO';
    message := 'Analisando contagem de parcelas por usuário';
    details := '{}';
    RETURN NEXT;
    
    -- Contar parcelas visíveis para usuário A
    SELECT COUNT(*) INTO v_user_a_count
    FROM public.transactions
    WHERE user_id = v_user_a_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE p_description_pattern;
    
    -- Contar parcelas visíveis para usuário B
    SELECT COUNT(*) INTO v_user_b_count
    FROM public.transactions
    WHERE user_id = v_user_b_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE p_description_pattern;
    
    -- Contar total de parcelas (incluindo deletadas e com user_id incorreto)
    SELECT COUNT(*) INTO v_total_installments
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern;
    
    phase := 'COUNT_ANALYSIS';
    status := CASE 
        WHEN v_user_a_count = v_user_b_count THEN 'SUCCESS'
        ELSE 'WARNING'
    END;
    message := format('Usuário A vê %s parcelas, Usuário B vê %s parcelas (Total: %s)', 
                     v_user_a_count, v_user_b_count, v_total_installments);
    details := jsonb_build_object(
        'user_a_count', v_user_a_count,
        'user_b_count', v_user_b_count,
        'total_count', v_total_installments,
        'difference', v_user_a_count - v_user_b_count
    );
    RETURN NEXT;
    
    -- =========================================================================
    -- FASE 3: ANÁLISE DETALHADA DE CADA PARCELA
    -- =========================================================================
    
    phase := 'DETAILED_ANALYSIS';
    status := 'INFO';
    message := 'Iniciando análise detalhada de cada parcela';
    details := '{}';
    RETURN NEXT;
    
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
                WHEN user_id = v_user_b_id THEN 'CORRETO'
                ELSE 'INCORRETO'
            END as user_status,
            CASE 
                WHEN deleted = true THEN 'DELETADO'
                ELSE 'ATIVO'
            END as delete_status,
            CASE 
                WHEN account_id = v_account_id THEN 'CORRETO'
                ELSE 'INCORRETO'
            END as account_status,
            CASE 
                WHEN user_id = v_user_b_id AND deleted = false AND account_id = v_account_id THEN 'VISÍVEL'
                ELSE 'NÃO_VISÍVEL'
            END as visibility_status
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE p_description_pattern
        ORDER BY current_installment
    LOOP
        -- Verificar se há problemas com esta parcela
        IF v_installment_info.user_status = 'INCORRETO' OR 
           v_installment_info.delete_status = 'DELETADO' OR
           v_installment_info.account_status = 'INCORRETO' THEN
            v_problems_found := v_problems_found + 1;
        END IF;
        
        phase := 'DETAILED_ANALYSIS';
        status := CASE 
            WHEN v_installment_info.visibility_status = 'VISÍVEL' THEN 'SUCCESS'
            ELSE 'ERROR'
        END;
        message := format('Parcela %s/%s: %s', 
                         v_installment_info.current_installment, 
                         v_installment_info.total_installments,
                         v_installment_info.visibility_status);
        details := jsonb_build_object(
            'installment_id', v_installment_info.id,
            'current_installment', v_installment_info.current_installment,
            'total_installments', v_installment_info.total_installments,
            'amount', v_installment_info.amount,
            'date', v_installment_info.date,
            'type', v_installment_info.type,
            'category', v_installment_info.category,
            'user_id', v_installment_info.user_id,
            'account_id', v_installment_info.account_id,
            'deleted', v_installment_info.deleted,
            'user_status', v_installment_info.user_status,
            'delete_status', v_installment_info.delete_status,
            'account_status', v_installment_info.account_status,
            'visibility_status', v_installment_info.visibility_status,
            'created_at', v_installment_info.created_at,
            'updated_at', v_installment_info.updated_at
        );
        RETURN NEXT;
    END LOOP;
    
    -- =========================================================================
    -- FASE 4: DETECÇÃO DE PROBLEMAS ESPECÍFICOS
    -- =========================================================================
    
    phase := 'PROBLEM_DETECTION';
    status := 'INFO';
    message := 'Detectando problemas específicos';
    details := '{}';
    RETURN NEXT;
    
    -- Verificar parcelas com user_id incorreto
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern
      AND user_id != v_user_b_id;
    
    IF v_count > 0 THEN
        phase := 'PROBLEM_DETECTION';
        status := 'ERROR';
        message := format('Encontradas %s parcelas com user_id incorreto', v_count);
        details := jsonb_build_object(
            'problem_type', 'INCORRECT_USER_ID',
            'count', v_count,
            'expected_user_id', v_user_b_id,
            'installment_ids', (
                SELECT jsonb_agg(id)
                FROM public.transactions
                WHERE is_installment = true
                  AND description LIKE p_description_pattern
                  AND user_id != v_user_b_id
            )
        );
        RETURN NEXT;
    END IF;
    
    -- Verificar parcelas deletadas
    SELECT COUNT(*) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern
      AND deleted = true;
    
    IF v_count > 0 THEN
        phase := 'PROBLEM_DETECTION';
        status := 'ERROR';
        message := format('Encontradas %s parcelas deletadas', v_count);
        details := jsonb_build_object(
            'problem_type', 'DELETED_INSTALLMENTS',
            'count', v_count,
            'installment_ids', (
                SELECT jsonb_agg(id)
                FROM public.transactions
                WHERE is_installment = true
                  AND description LIKE p_description_pattern
                  AND deleted = true
            )
        );
        RETURN NEXT;
    END IF;
    
    -- Verificar parcelas em contas diferentes
    SELECT COUNT(DISTINCT account_id) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern;
    
    IF v_count > 1 THEN
        phase := 'PROBLEM_DETECTION';
        status := 'WARNING';
        message := format('Parcelas distribuídas em %s contas diferentes', v_count);
        details := jsonb_build_object(
            'problem_type', 'MULTIPLE_ACCOUNTS',
            'account_count', v_count,
            'expected_account_id', v_account_id,
            'account_distribution', (
                SELECT jsonb_object_agg(account_id, count)
                FROM (
                    SELECT account_id, COUNT(*) as count
                    FROM public.transactions
                    WHERE is_installment = true
                      AND description LIKE p_description_pattern
                    GROUP BY account_id
                ) sub
            )
        );
        RETURN NEXT;
    END IF;
    
    -- =========================================================================
    -- FASE 5: RESUMO FINAL
    -- =========================================================================
    
    phase := 'SUMMARY';
    status := CASE 
        WHEN v_problems_found = 0 THEN 'SUCCESS'
        WHEN v_problems_found <= 3 THEN 'WARNING'
        ELSE 'ERROR'
    END;
    message := format('Diagnóstico concluído: %s problemas encontrados', v_problems_found);
    details := jsonb_build_object(
        'total_problems', v_problems_found,
        'user_a_id', v_user_a_id,
        'user_b_id', v_user_b_id,
        'account_id', v_account_id,
        'user_a_visible_count', v_user_a_count,
        'user_b_visible_count', v_user_b_count,
        'total_installments', v_total_installments,
        'visibility_difference', v_user_a_count - v_user_b_count,
        'pattern_used', p_description_pattern,
        'diagnosis_timestamp', NOW()
    );
    RETURN NEXT;
    
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar comentário à função
COMMENT ON FUNCTION public.diagnose_missing_installments(TEXT) IS 
'Diagnostic Engine: Identifica e analisa problemas em parcelas importadas que aparecem diferentes para usuários diferentes';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.diagnose_missing_installments(TEXT) TO authenticated;

-- ==============================================================================
-- FUNÇÕES AUXILIARES DO DIAGNOSTIC ENGINE
-- ==============================================================================

-- Função para identificar usuários A e B
CREATE OR REPLACE FUNCTION public.identify_installment_users(
    p_description_pattern TEXT DEFAULT '%Wesley%'
)
RETURNS TABLE (
    user_a_id UUID,
    user_b_id UUID,
    account_id UUID,
    user_a_count INTEGER,
    user_b_count INTEGER
) AS $
DECLARE
    v_user_a_id UUID;
    v_user_b_id UUID;
    v_account_id UUID;
    v_user_a_count INTEGER;
    v_user_b_count INTEGER;
BEGIN
    -- Identificar usuário B (dono da conta)
    SELECT DISTINCT a.user_id, a.id INTO v_user_b_id, v_account_id
    FROM public.accounts a
    JOIN public.transactions t ON t.account_id = a.id
    WHERE t.is_installment = true
      AND t.description LIKE p_description_pattern
      AND a.deleted = false
    LIMIT 1;
    
    -- Identificar usuário A (pode ser diferente se houver user_id incorreto)
    SELECT DISTINCT t.user_id INTO v_user_a_id
    FROM public.transactions t
    WHERE t.is_installment = true
      AND t.description LIKE p_description_pattern
      AND t.user_id != v_user_b_id
    LIMIT 1;
    
    -- Se não encontrou usuário A diferente, usar o mesmo que B
    IF v_user_a_id IS NULL THEN
        v_user_a_id := v_user_b_id;
    END IF;
    
    -- Contar parcelas para cada usuário
    SELECT COUNT(*) INTO v_user_a_count
    FROM public.transactions
    WHERE user_id = v_user_a_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE p_description_pattern;
    
    SELECT COUNT(*) INTO v_user_b_count
    FROM public.transactions
    WHERE user_id = v_user_b_id
      AND deleted = false
      AND is_installment = true
      AND description LIKE p_description_pattern;
    
    -- Retornar resultados
    user_a_id := v_user_a_id;
    user_b_id := v_user_b_id;
    account_id := v_account_id;
    user_a_count := v_user_a_count;
    user_b_count := v_user_b_count;
    
    RETURN NEXT;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para analisar uma parcela específica
CREATE OR REPLACE FUNCTION public.analyze_installment(
    p_installment_id UUID,
    p_expected_user_id UUID,
    p_expected_account_id UUID
)
RETURNS TABLE (
    installment_id UUID,
    current_installment INTEGER,
    total_installments INTEGER,
    user_status TEXT,
    delete_status TEXT,
    account_status TEXT,
    visibility_status TEXT,
    problems JSONB
) AS $
DECLARE
    v_installment RECORD;
    v_problems JSONB := '[]';
BEGIN
    -- Buscar dados da parcela
    SELECT * INTO v_installment
    FROM public.transactions
    WHERE id = p_installment_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Parcela não encontrada: %', p_installment_id;
    END IF;
    
    -- Analisar status do user_id
    user_status := CASE 
        WHEN v_installment.user_id = p_expected_user_id THEN 'CORRETO'
        ELSE 'INCORRETO'
    END;
    
    -- Analisar status de deleção
    delete_status := CASE 
        WHEN v_installment.deleted = true THEN 'DELETADO'
        ELSE 'ATIVO'
    END;
    
    -- Analisar status da conta
    account_status := CASE 
        WHEN v_installment.account_id = p_expected_account_id THEN 'CORRETO'
        ELSE 'INCORRETO'
    END;
    
    -- Determinar visibilidade
    visibility_status := CASE 
        WHEN v_installment.user_id = p_expected_user_id 
             AND v_installment.deleted = false 
             AND v_installment.account_id = p_expected_account_id THEN 'VISÍVEL'
        ELSE 'NÃO_VISÍVEL'
    END;
    
    -- Coletar problemas
    IF user_status = 'INCORRETO' THEN
        v_problems := v_problems || jsonb_build_object(
            'type', 'INCORRECT_USER_ID',
            'current', v_installment.user_id,
            'expected', p_expected_user_id
        );
    END IF;
    
    IF delete_status = 'DELETADO' THEN
        v_problems := v_problems || jsonb_build_object(
            'type', 'DELETED',
            'current', true,
            'expected', false
        );
    END IF;
    
    IF account_status = 'INCORRETO' THEN
        v_problems := v_problems || jsonb_build_object(
            'type', 'INCORRECT_ACCOUNT',
            'current', v_installment.account_id,
            'expected', p_expected_account_id
        );
    END IF;
    
    -- Retornar resultados
    installment_id := p_installment_id;
    current_installment := v_installment.current_installment;
    total_installments := v_installment.total_installments;
    problems := v_problems;
    
    RETURN NEXT;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para detectar problemas específicos
CREATE OR REPLACE FUNCTION public.detect_installment_problems(
    p_description_pattern TEXT DEFAULT '%Wesley%'
)
RETURNS TABLE (
    problem_type TEXT,
    severity TEXT,
    count INTEGER,
    installment_ids UUID[],
    details JSONB
) AS $
DECLARE
    v_user_b_id UUID;
    v_account_id UUID;
    v_count INTEGER;
    v_ids UUID[];
BEGIN
    -- Identificar usuário B e conta esperada
    SELECT user_b_id, account_id INTO v_user_b_id, v_account_id
    FROM public.identify_installment_users(p_description_pattern)
    LIMIT 1;
    
    IF v_user_b_id IS NULL THEN
        RAISE EXCEPTION 'Não foi possível identificar usuário B para o padrão: %', p_description_pattern;
    END IF;
    
    -- Problema 1: User_ID incorreto
    SELECT COUNT(*), array_agg(id) INTO v_count, v_ids
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern
      AND user_id != v_user_b_id;
    
    IF v_count > 0 THEN
        problem_type := 'INCORRECT_USER_ID';
        severity := 'HIGH';
        count := v_count;
        installment_ids := v_ids;
        details := jsonb_build_object(
            'expected_user_id', v_user_b_id,
            'description', format('Parcelas com user_id diferente do dono da conta (%s)', v_user_b_id)
        );
        RETURN NEXT;
    END IF;
    
    -- Problema 2: Parcelas deletadas
    SELECT COUNT(*), array_agg(id) INTO v_count, v_ids
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern
      AND deleted = true;
    
    IF v_count > 0 THEN
        problem_type := 'DELETED_INSTALLMENTS';
        severity := 'HIGH';
        count := v_count;
        installment_ids := v_ids;
        details := jsonb_build_object(
            'description', 'Parcelas marcadas como deletadas incorretamente'
        );
        RETURN NEXT;
    END IF;
    
    -- Problema 3: Contas diferentes
    SELECT COUNT(DISTINCT account_id) INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern;
    
    IF v_count > 1 THEN
        SELECT array_agg(DISTINCT id) INTO v_ids
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE p_description_pattern
          AND account_id != v_account_id;
        
        problem_type := 'MULTIPLE_ACCOUNTS';
        severity := 'MEDIUM';
        count := array_length(v_ids, 1);
        installment_ids := v_ids;
        details := jsonb_build_object(
            'expected_account_id', v_account_id,
            'account_count', v_count,
            'description', format('Parcelas distribuídas em %s contas diferentes', v_count)
        );
        RETURN NEXT;
    END IF;
    
    -- Problema 4: Sequência incompleta
    SELECT total_installments INTO v_count
    FROM public.transactions
    WHERE is_installment = true
      AND description LIKE p_description_pattern
    LIMIT 1;
    
    IF v_count IS NOT NULL THEN
        SELECT COUNT(*) INTO v_count
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE p_description_pattern;
        
        -- Verificar se há parcelas faltantes na sequência
        IF EXISTS (
            SELECT 1
            FROM generate_series(1, (
                SELECT MAX(total_installments)
                FROM public.transactions
                WHERE is_installment = true
                  AND description LIKE p_description_pattern
            )) AS expected_installment
            WHERE NOT EXISTS (
                SELECT 1
                FROM public.transactions
                WHERE is_installment = true
                  AND description LIKE p_description_pattern
                  AND current_installment = expected_installment
            )
        ) THEN
            problem_type := 'INCOMPLETE_SEQUENCE';
            severity := 'MEDIUM';
            count := 1;
            installment_ids := '{}';
            details := jsonb_build_object(
                'description', 'Sequência de parcelas incompleta - algumas parcelas podem estar faltando'
            );
            RETURN NEXT;
        END IF;
    END IF;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar comentários às funções auxiliares
COMMENT ON FUNCTION public.identify_installment_users(TEXT) IS 
'Identifica usuários A e B e suas contagens de parcelas visíveis';

COMMENT ON FUNCTION public.analyze_installment(UUID, UUID, UUID) IS 
'Analisa uma parcela específica e identifica problemas';

COMMENT ON FUNCTION public.detect_installment_problems(TEXT) IS 
'Detecta problemas específicos em um conjunto de parcelas';

-- Conceder permissões às funções auxiliares
GRANT EXECUTE ON FUNCTION public.identify_installment_users(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.analyze_installment(UUID, UUID, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.detect_installment_problems(TEXT) TO authenticated;