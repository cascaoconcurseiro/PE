-- ==============================================================================
-- FACTORY RESET VERIFICATION AND FIXES
-- DATA: 2025-12-21
-- OBJETIVO: Verificar e corrigir problemas no factory reset
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- FUNÇÃO DE VERIFICAÇÃO DE COMPLETUDE DO FACTORY RESET
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_factory_reset_completeness(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    remaining_transactions INTEGER := 0;
    remaining_accounts INTEGER := 0;
    remaining_shared_requests INTEGER := 0;
    remaining_mirrors INTEGER := 0;
    result JSONB;
BEGIN
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    -- Contar transações restantes (incluindo as marcadas como deleted=false)
    SELECT COUNT(*) INTO remaining_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND deleted = false;
    
    -- Contar contas restantes
    SELECT COUNT(*) INTO remaining_accounts
    FROM public.accounts 
    WHERE user_id = target_user_id;
    
    -- Contar solicitações compartilhadas restantes
    SELECT COUNT(*) INTO remaining_shared_requests
    FROM public.shared_transaction_requests 
    WHERE invited_user_id = target_user_id OR requester_id = target_user_id;
    
    -- Contar espelhos restantes
    SELECT COUNT(*) INTO remaining_mirrors
    FROM public.shared_transaction_mirrors 
    WHERE mirror_user_id = target_user_id;
    
    result := jsonb_build_object(
        'is_complete', (remaining_transactions = 0 AND remaining_accounts = 0 AND remaining_shared_requests = 0 AND remaining_mirrors = 0),
        'remaining_transactions', remaining_transactions,
        'remaining_accounts', remaining_accounts,
        'remaining_shared_requests', remaining_shared_requests,
        'remaining_mirrors', remaining_mirrors,
        'checked_at', NOW()
    );
    
    -- Log da verificação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success
    ) VALUES (
        target_user_id, 'verification_check', result, true
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO CORRIGIDA DE FACTORY RESET - VERSÃO MAIS AGRESSIVA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.execute_factory_reset_complete(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    execution_time INTEGER;
    transactions_count INTEGER := 0;
    accounts_count INTEGER := 0;
    shared_requests_count INTEGER := 0;
    mirrors_count INTEGER := 0;
    result JSONB;
BEGIN
    start_time := clock_timestamp();
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    -- Log início da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success
    ) VALUES (
        target_user_id, 'initiated', 
        jsonb_build_object('started_at', start_time, 'version', 'complete'),
        true
    );
    
    -- 1. DELETAR TODAS AS TRANSAÇÕES DO USUÁRIO - SEM EXCEÇÕES
    -- Isso inclui transações compartilhadas onde o usuário é criador
    WITH deleted_transactions AS (
        DELETE FROM public.transactions 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO transactions_count FROM deleted_transactions;
    
    -- 2. Deletar todas as contas
    WITH deleted_accounts AS (
        DELETE FROM public.accounts 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO accounts_count FROM deleted_accounts;
    
    -- 3. Limpar TODAS as solicitações de transações compartilhadas
    WITH deleted_requests AS (
        DELETE FROM public.shared_transaction_requests 
        WHERE invited_user_id = target_user_id OR requester_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO shared_requests_count FROM deleted_requests;
    
    -- 4. Limpar TODOS os espelhos de transações
    WITH deleted_mirrors AS (
        DELETE FROM public.shared_transaction_mirrors 
        WHERE mirror_user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO mirrors_count FROM deleted_mirrors;
    
    -- 5. Limpar outras tabelas relacionadas se existirem
    -- Investimentos (se a tabela existir)
    -- DELETE FROM public.investments WHERE user_id = target_user_id;
    
    -- Orçamentos (se a tabela existir)
    -- DELETE FROM public.budgets WHERE user_id = target_user_id;
    
    -- Configurações do usuário (se a tabela existir)
    -- DELETE FROM public.user_settings WHERE user_id = target_user_id;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Preparar resultado
    result := jsonb_build_object(
        'success', true,
        'transactions_deleted', transactions_count,
        'accounts_deleted', accounts_count,
        'shared_requests_deleted', shared_requests_count,
        'mirrors_deleted', mirrors_count,
        'execution_time_ms', execution_time,
        'version', 'complete'
    );
    
    -- Log conclusão da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, execution_time_ms,
        transactions_deleted, accounts_deleted
    ) VALUES (
        target_user_id, 'completed', result, true, execution_time,
        transactions_count, accounts_count
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log erro
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, error_message, execution_time_ms
    ) VALUES (
        target_user_id, 'rollback_executed', 
        jsonb_build_object('error', SQLERRM, 'version', 'complete'),
        false, SQLERRM,
        EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000
    );
    
    -- Re-raise o erro
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO PARA LISTAR TRANSAÇÕES VISÍVEIS NO FLUXO DE CAIXA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_user_visible_transactions(target_user_id UUID)
RETURNS TABLE (
    transaction_id UUID,
    amount NUMERIC,
    description TEXT,
    created_at TIMESTAMPTZ,
    is_shared BOOLEAN,
    is_mirror BOOLEAN,
    deleted BOOLEAN,
    source TEXT
)
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
BEGIN
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    -- Retornar todas as transações que o usuário pode ver no fluxo de caixa
    RETURN QUERY
    -- Transações próprias
    SELECT 
        t.id as transaction_id,
        t.amount,
        t.description,
        t.created_at,
        t.is_shared,
        t.is_mirror,
        t.deleted,
        'own_transaction' as source
    FROM public.transactions t
    WHERE t.user_id = target_user_id
    AND t.deleted = false
    
    UNION ALL
    
    -- Transações compartilhadas onde o usuário é participante
    SELECT 
        t.id as transaction_id,
        t.amount,
        t.description,
        t.created_at,
        t.is_shared,
        false as is_mirror,
        t.deleted,
        'shared_participation' as source
    FROM public.transactions t
    INNER JOIN public.shared_transaction_requests str ON str.transaction_id = t.id
    WHERE str.invited_user_id = target_user_id
    AND str.status = 'ACCEPTED'
    AND t.deleted = false
    AND t.user_id != target_user_id
    
    ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO PARA DIAGNÓSTICO COMPLETO DO USUÁRIO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.diagnose_user_data(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    own_transactions INTEGER := 0;
    shared_as_creator INTEGER := 0;
    shared_as_participant INTEGER := 0;
    mirror_transactions INTEGER := 0;
    accounts_count INTEGER := 0;
    recovery_records_count INTEGER := 0;
    visible_in_cashflow INTEGER := 0;
    result JSONB;
BEGIN
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    -- Contar transações próprias
    SELECT COUNT(*) INTO own_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND (is_shared = false OR is_shared IS NULL)
    AND (is_mirror = false OR is_mirror IS NULL)
    AND deleted = false;
    
    -- Contar transações compartilhadas onde é criador
    SELECT COUNT(*) INTO shared_as_creator
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND is_shared = true
    AND (is_mirror = false OR is_mirror IS NULL)
    AND deleted = false;
    
    -- Contar participações em transações compartilhadas
    SELECT COUNT(*) INTO shared_as_participant
    FROM public.shared_transaction_requests str
    INNER JOIN public.transactions t ON t.id = str.transaction_id
    WHERE str.invited_user_id = target_user_id
    AND str.status = 'ACCEPTED'
    AND t.deleted = false
    AND t.user_id != target_user_id;
    
    -- Contar transações espelho
    SELECT COUNT(*) INTO mirror_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND is_mirror = true
    AND deleted = false;
    
    -- Contar contas
    SELECT COUNT(*) INTO accounts_count
    FROM public.accounts 
    WHERE user_id = target_user_id;
    
    -- Contar registros de recuperação
    SELECT COUNT(*) INTO recovery_records_count
    FROM public.recovery_records 
    WHERE user_id = target_user_id 
    AND is_valid = true;
    
    -- Contar transações visíveis no fluxo de caixa
    SELECT COUNT(*) INTO visible_in_cashflow
    FROM public.get_user_visible_transactions(target_user_id);
    
    result := jsonb_build_object(
        'user_id', target_user_id,
        'own_transactions', own_transactions,
        'shared_as_creator', shared_as_creator,
        'shared_as_participant', shared_as_participant,
        'mirror_transactions', mirror_transactions,
        'accounts_count', accounts_count,
        'recovery_records_count', recovery_records_count,
        'visible_in_cashflow', visible_in_cashflow,
        'diagnosed_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMIT;

-- ==============================================================================
-- NOTAS SOBRE AS CORREÇÕES
-- ==============================================================================

/*
PROBLEMAS IDENTIFICADOS E CORRIGIDOS:

1. FACTORY RESET INCOMPLETO:
   - A função original tentava preservar transações compartilhadas onde o usuário era criador
   - Isso causava transações ainda aparecendo no fluxo de caixa
   - Nova função execute_factory_reset_complete() deleta TODAS as transações sem exceção

2. VERIFICAÇÃO DE COMPLETUDE:
   - Função verify_factory_reset_completeness() para verificar se o reset foi completo
   - Conta todos os dados restantes que deveriam ter sido removidos

3. DIAGNÓSTICO DETALHADO:
   - Função diagnose_user_data() para entender exatamente que dados o usuário tem
   - Identifica diferentes tipos de transações e suas origens

4. VISIBILIDADE NO FLUXO DE CAIXA:
   - Função get_user_visible_transactions() mostra exatamente o que aparece no fluxo
   - Ajuda a identificar por que transações ainda aparecem após reset

PRÓXIMOS PASSOS:
1. Testar a nova função execute_factory_reset_complete()
2. Verificar se resolve o problema do fluxo de caixa
3. Implementar serviços TypeScript usando a função corrigida
4. Criar testes para validar a correção
*/