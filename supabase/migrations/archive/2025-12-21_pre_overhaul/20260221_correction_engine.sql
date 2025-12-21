-- ==============================================================================
-- CORRECTION ENGINE: Missing Installment Fix
-- DATA: 2025-12-21
-- OBJETIVO: Implementar engine de correção para corrigir parcelas faltantes
-- ==============================================================================

-- Função principal de correção
CREATE OR REPLACE FUNCTION public.fix_missing_installments(
    p_description_pattern TEXT DEFAULT '%Wesley%',
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    action TEXT,
    installment_id UUID,
    old_user_id UUID,
    new_user_id UUID,
    old_deleted BOOLEAN,
    new_deleted BOOLEAN,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_user_b_id UUID;
    v_account_id UUID;
    v_installment RECORD;
    v_corrections_made INTEGER := 0;
    v_errors_found INTEGER := 0;
BEGIN
    -- =========================================================================
    -- FASE 1: IDENTIFICAÇÃO E VALIDAÇÃO
    -- =========================================================================
    
    -- Identificar usuário B (dono da conta) e conta
    SELECT user_b_id, account_id INTO v_user_b_id, v_account_id
    FROM public.identify_installment_users(p_description_pattern)
    LIMIT 1;
    
    IF v_user_b_id IS NULL OR v_account_id IS NULL THEN
        action := 'ERROR';
        installment_id := NULL;
        old_user_id := NULL;
        new_user_id := NULL;
        old_deleted := NULL;
        new_deleted := NULL;
        success := false;
        message := 'Não foi possível identificar usuário B ou conta para o padrão: ' || p_description_pattern;
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Validar que a conta existe e não está deletada
    IF NOT EXISTS (
        SELECT 1 FROM public.accounts 
        WHERE id = v_account_id AND deleted = false
    ) THEN
        action := 'ERROR';
        installment_id := NULL;
        old_user_id := NULL;
        new_user_id := NULL;
        old_deleted := NULL;
        new_deleted := NULL;
        success := false;
        message := 'Conta de destino não existe ou está deletada: ' || v_account_id;
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Retornar informações iniciais
    action := 'INFO';
    installment_id := NULL;
    old_user_id := NULL;
    new_user_id := v_user_b_id;
    old_deleted := NULL;
    new_deleted := NULL;
    success := true;
    message := CASE 
        WHEN p_dry_run THEN 'MODO DRY-RUN: Simulando correções (nenhuma mudança será feita)'
        ELSE 'MODO REAL: Aplicando correções no banco de dados'
    END || ' - Usuário B: ' || v_user_b_id || ', Conta: ' || v_account_id;
    RETURN NEXT;
    
    -- =========================================================================
    -- FASE 2: CORREÇÃO DE USER_ID INCORRETO
    -- =========================================================================
    
    FOR v_installment IN
        SELECT id, user_id, deleted, current_installment, total_installments
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE p_description_pattern
          AND user_id != v_user_b_id
        ORDER BY current_installment
    LOOP
        BEGIN
            IF NOT p_dry_run THEN
                -- Aplicar correção real
                UPDATE public.transactions
                SET user_id = v_user_b_id,
                    updated_at = NOW()
                WHERE id = v_installment.id;
            END IF;
            
            -- Registrar ação
            action := 'UPDATE_USER_ID';
            installment_id := v_installment.id;
            old_user_id := v_installment.user_id;
            new_user_id := v_user_b_id;
            old_deleted := v_installment.deleted;
            new_deleted := v_installment.deleted;
            success := true;
            message := format('Parcela %s/%s: user_id corrigido de %s para %s', 
                            v_installment.current_installment, 
                            v_installment.total_installments,
                            v_installment.user_id, 
                            v_user_b_id);
            RETURN NEXT;
            
            v_corrections_made := v_corrections_made + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Registrar erro
                action := 'ERROR_UPDATE_USER_ID';
                installment_id := v_installment.id;
                old_user_id := v_installment.user_id;
                new_user_id := v_user_b_id;
                old_deleted := v_installment.deleted;
                new_deleted := v_installment.deleted;
                success := false;
                message := format('Erro ao corrigir user_id da parcela %s/%s: %s', 
                                v_installment.current_installment, 
                                v_installment.total_installments,
                                SQLERRM);
                RETURN NEXT;
                
                v_errors_found := v_errors_found + 1;
        END;
    END LOOP;
    
    -- =========================================================================
    -- FASE 3: RESTAURAÇÃO DE PARCELAS DELETADAS
    -- =========================================================================
    
    FOR v_installment IN
        SELECT id, user_id, deleted, current_installment, total_installments
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE p_description_pattern
          AND deleted = true
        ORDER BY current_installment
    LOOP
        BEGIN
            IF NOT p_dry_run THEN
                -- Aplicar restauração real
                UPDATE public.transactions
                SET deleted = false,
                    user_id = v_user_b_id, -- Garantir user_id correto também
                    updated_at = NOW()
                WHERE id = v_installment.id;
            END IF;
            
            -- Registrar ação
            action := 'RESTORE_DELETED';
            installment_id := v_installment.id;
            old_user_id := v_installment.user_id;
            new_user_id := v_user_b_id;
            old_deleted := true;
            new_deleted := false;
            success := true;
            message := format('Parcela %s/%s: restaurada (deleted=false) e user_id corrigido para %s', 
                            v_installment.current_installment, 
                            v_installment.total_installments,
                            v_user_b_id);
            RETURN NEXT;
            
            v_corrections_made := v_corrections_made + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Registrar erro
                action := 'ERROR_RESTORE_DELETED';
                installment_id := v_installment.id;
                old_user_id := v_installment.user_id;
                new_user_id := v_user_b_id;
                old_deleted := true;
                new_deleted := false;
                success := false;
                message := format('Erro ao restaurar parcela %s/%s: %s', 
                                v_installment.current_installment, 
                                v_installment.total_installments,
                                SQLERRM);
                RETURN NEXT;
                
                v_errors_found := v_errors_found + 1;
        END;
    END LOOP;
    
    -- =========================================================================
    -- FASE 4: CORREÇÃO DE CONTA INCORRETA (SE NECESSÁRIO)
    -- =========================================================================
    
    FOR v_installment IN
        SELECT id, user_id, account_id, deleted, current_installment, total_installments
        FROM public.transactions
        WHERE is_installment = true
          AND description LIKE p_description_pattern
          AND account_id != v_account_id
        ORDER BY current_installment
    LOOP
        BEGIN
            IF NOT p_dry_run THEN
                -- Aplicar correção real
                UPDATE public.transactions
                SET account_id = v_account_id,
                    user_id = v_user_b_id, -- Garantir user_id correto também
                    updated_at = NOW()
                WHERE id = v_installment.id;
            END IF;
            
            -- Registrar ação
            action := 'UPDATE_ACCOUNT_ID';
            installment_id := v_installment.id;
            old_user_id := v_installment.user_id;
            new_user_id := v_user_b_id;
            old_deleted := v_installment.deleted;
            new_deleted := v_installment.deleted;
            success := true;
            message := format('Parcela %s/%s: account_id corrigido de %s para %s', 
                            v_installment.current_installment, 
                            v_installment.total_installments,
                            v_installment.account_id, 
                            v_account_id);
            RETURN NEXT;
            
            v_corrections_made := v_corrections_made + 1;
            
        EXCEPTION
            WHEN OTHERS THEN
                -- Registrar erro
                action := 'ERROR_UPDATE_ACCOUNT_ID';
                installment_id := v_installment.id;
                old_user_id := v_installment.user_id;
                new_user_id := v_user_b_id;
                old_deleted := v_installment.deleted;
                new_deleted := v_installment.deleted;
                success := false;
                message := format('Erro ao corrigir account_id da parcela %s/%s: %s', 
                                v_installment.current_installment, 
                                v_installment.total_installments,
                                SQLERRM);
                RETURN NEXT;
                
                v_errors_found := v_errors_found + 1;
        END;
    END LOOP;
    
    -- =========================================================================
    -- FASE 5: RESUMO FINAL
    -- =========================================================================
    
    action := 'SUMMARY';
    installment_id := NULL;
    old_user_id := NULL;
    new_user_id := v_user_b_id;
    old_deleted := NULL;
    new_deleted := NULL;
    success := (v_errors_found = 0);
    message := format('%s concluída: %s correções aplicadas, %s erros encontrados', 
                     CASE WHEN p_dry_run THEN 'Simulação' ELSE 'Correção' END,
                     v_corrections_made, 
                     v_errors_found);
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- FUNÇÕES AUXILIARES DO CORRECTION ENGINE
-- ==============================================================================

-- Função para corrigir user_id de uma parcela específica
CREATE OR REPLACE FUNCTION public.fix_installment_user_id(
    p_installment_id UUID,
    p_new_user_id UUID,
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    success BOOLEAN,
    old_user_id UUID,
    new_user_id UUID,
    message TEXT
) AS $$
DECLARE
    v_installment RECORD;
BEGIN
    -- Buscar dados da parcela
    SELECT * INTO v_installment
    FROM public.transactions
    WHERE id = p_installment_id;
    
    IF NOT FOUND THEN
        success := false;
        old_user_id := NULL;
        new_user_id := p_new_user_id;
        message := 'Parcela não encontrada: ' || p_installment_id;
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Verificar se a conta do novo usuário existe
    IF NOT EXISTS (
        SELECT 1 FROM public.accounts 
        WHERE user_id = p_new_user_id AND deleted = false
    ) THEN
        success := false;
        old_user_id := v_installment.user_id;
        new_user_id := p_new_user_id;
        message := 'Usuário de destino não possui contas válidas: ' || p_new_user_id;
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Aplicar correção (se não for dry-run)
    IF NOT p_dry_run THEN
        UPDATE public.transactions
        SET user_id = p_new_user_id,
            updated_at = NOW()
        WHERE id = p_installment_id;
    END IF;
    
    -- Retornar resultado
    success := true;
    old_user_id := v_installment.user_id;
    new_user_id := p_new_user_id;
    message := CASE 
        WHEN p_dry_run THEN 'Simulação: user_id seria alterado de ' || v_installment.user_id || ' para ' || p_new_user_id
        ELSE 'user_id alterado de ' || v_installment.user_id || ' para ' || p_new_user_id
    END;
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para restaurar parcela deletada
CREATE OR REPLACE FUNCTION public.restore_deleted_installment(
    p_installment_id UUID,
    p_correct_user_id UUID,
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    success BOOLEAN,
    old_deleted BOOLEAN,
    new_deleted BOOLEAN,
    old_user_id UUID,
    new_user_id UUID,
    message TEXT
) AS $$
DECLARE
    v_installment RECORD;
BEGIN
    -- Buscar dados da parcela
    SELECT * INTO v_installment
    FROM public.transactions
    WHERE id = p_installment_id;
    
    IF NOT FOUND THEN
        success := false;
        old_deleted := NULL;
        new_deleted := NULL;
        old_user_id := NULL;
        new_user_id := p_correct_user_id;
        message := 'Parcela não encontrada: ' || p_installment_id;
        RETURN NEXT;
        RETURN;
    END IF;
    
    -- Aplicar restauração (se não for dry-run)
    IF NOT p_dry_run THEN
        UPDATE public.transactions
        SET deleted = false,
            user_id = p_correct_user_id,
            updated_at = NOW()
        WHERE id = p_installment_id;
    END IF;
    
    -- Retornar resultado
    success := true;
    old_deleted := v_installment.deleted;
    new_deleted := false;
    old_user_id := v_installment.user_id;
    new_user_id := p_correct_user_id;
    message := CASE 
        WHEN p_dry_run THEN 'Simulação: parcela seria restaurada (deleted=false) e user_id corrigido para ' || p_correct_user_id
        ELSE 'Parcela restaurada (deleted=false) e user_id corrigido para ' || p_correct_user_id
    END;
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para aplicar correções em lote de forma atômica
CREATE OR REPLACE FUNCTION public.fix_installments_batch(
    p_installment_ids UUID[],
    p_target_user_id UUID,
    p_dry_run BOOLEAN DEFAULT true
)
RETURNS TABLE (
    total_processed INTEGER,
    total_corrected INTEGER,
    total_errors INTEGER,
    success BOOLEAN,
    message TEXT
) AS $$
DECLARE
    v_installment_id UUID;
    v_processed INTEGER := 0;
    v_corrected INTEGER := 0;
    v_errors INTEGER := 0;
    v_result RECORD;
BEGIN
    -- Processar cada parcela
    FOREACH v_installment_id IN ARRAY p_installment_ids
    LOOP
        v_processed := v_processed + 1;
        
        BEGIN
            -- Tentar corrigir user_id
            SELECT * INTO v_result
            FROM public.fix_installment_user_id(v_installment_id, p_target_user_id, p_dry_run)
            LIMIT 1;
            
            IF v_result.success THEN
                v_corrected := v_corrected + 1;
            ELSE
                v_errors := v_errors + 1;
            END IF;
            
        EXCEPTION
            WHEN OTHERS THEN
                v_errors := v_errors + 1;
        END;
    END LOOP;
    
    -- Retornar resumo
    total_processed := v_processed;
    total_corrected := v_corrected;
    total_errors := v_errors;
    success := (v_errors = 0);
    message := format('Lote processado: %s parcelas, %s corrigidas, %s erros', 
                     v_processed, v_corrected, v_errors);
    RETURN NEXT;
    
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Adicionar comentários às funções
COMMENT ON FUNCTION public.fix_missing_installments(TEXT, BOOLEAN) IS 
'Correction Engine: Corrige problemas identificados em parcelas importadas (user_id incorreto, parcelas deletadas, etc.)';

COMMENT ON FUNCTION public.fix_installment_user_id(UUID, UUID, BOOLEAN) IS 
'Corrige o user_id de uma parcela específica';

COMMENT ON FUNCTION public.restore_deleted_installment(UUID, UUID, BOOLEAN) IS 
'Restaura uma parcela deletada e corrige seu user_id';

COMMENT ON FUNCTION public.fix_installments_batch(UUID[], UUID, BOOLEAN) IS 
'Aplica correções em lote de forma atômica';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.fix_missing_installments(TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fix_installment_user_id(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.restore_deleted_installment(UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.fix_installments_batch(UUID[], UUID, BOOLEAN) TO authenticated;