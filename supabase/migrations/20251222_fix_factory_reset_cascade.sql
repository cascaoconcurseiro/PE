-- ==============================================================================
-- CORREÇÃO: Factory Reset com Efeito Cascata Completo
-- DATA: 2025-12-22
-- PROBLEMA: Factory reset não está excluindo todos os dados relacionados
-- SOLUÇÃO: Deletar TODAS as transações relacionadas ao usuário (próprias, espelhos, compartilhadas)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- FUNÇÃO CORRIGIDA: Factory Reset com Cascata Completa
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
    mirror_transactions_count INTEGER := 0;
    shared_participation_count INTEGER := 0;
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
        jsonb_build_object('started_at', start_time, 'version', 'cascade_complete'),
        true
    );
    
    -- 1. DELETAR TODAS AS TRANSAÇÕES PRÓPRIAS DO USUÁRIO
    WITH deleted_own_transactions AS (
        DELETE FROM public.transactions 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO transactions_count FROM deleted_own_transactions;
    
    -- 2. DELETAR TODAS AS TRANSAÇÕES ESPELHO (MIRROR) DO USUÁRIO
    -- Estas são transações criadas automaticamente quando o usuário participa de transações compartilhadas
    WITH deleted_mirror_transactions AS (
        DELETE FROM public.transactions 
        WHERE user_id = target_user_id 
        AND is_mirror = true
        RETURNING id
    )
    SELECT COUNT(*) INTO mirror_transactions_count FROM deleted_mirror_transactions;
    
    -- 3. REMOVER PARTICIPAÇÃO EM TRANSAÇÕES COMPARTILHADAS
    -- Deletar registros onde o usuário é participante de transações de outros usuários
    WITH deleted_shared_participation AS (
        DELETE FROM public.shared_transaction_requests 
        WHERE invited_user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO shared_participation_count FROM deleted_shared_participation;
    
    -- 4. DELETAR TODAS AS CONTAS DO USUÁRIO
    WITH deleted_accounts AS (
        DELETE FROM public.accounts 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO accounts_count FROM deleted_accounts;
    
    -- 5. LIMPAR SOLICITAÇÕES DE COMPARTILHAMENTO (CRIADAS PELO USUÁRIO)
    WITH deleted_requests AS (
        DELETE FROM public.shared_transaction_requests 
        WHERE requester_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO shared_requests_count FROM deleted_requests;
    
    -- 6. LIMPAR ESPELHOS DE TRANSAÇÕES COMPARTILHADAS
    WITH deleted_mirrors AS (
        DELETE FROM public.shared_transaction_mirrors 
        WHERE mirror_user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO mirrors_count FROM deleted_mirrors;
    
    -- 7. LIMPAR OUTRAS TABELAS RELACIONADAS
    -- Investimentos (se existir)
    DELETE FROM public.investments WHERE user_id = target_user_id;
    
    -- Orçamentos (se existir)
    DELETE FROM public.budgets WHERE user_id = target_user_id;
    
    -- Configurações do usuário (se existir)
    DELETE FROM public.user_settings WHERE user_id = target_user_id;
    
    -- Splits de transações (se existir)
    DELETE FROM public.transaction_splits 
    WHERE transaction_id IN (
        SELECT id FROM public.transactions WHERE user_id = target_user_id
    );
    
    -- Entradas do ledger (se existir)
    DELETE FROM public.ledger_entries 
    WHERE transaction_id IN (
        SELECT id FROM public.transactions WHERE user_id = target_user_id
    );
    
    -- Extratos bancários (se existir)
    DELETE FROM public.bank_statements WHERE user_id = target_user_id;
    
    -- Viagens do usuário (se existir)
    DELETE FROM public.trips WHERE user_id = target_user_id;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Preparar resultado
    result := jsonb_build_object(
        'success', true,
        'transactions_deleted', transactions_count,
        'mirror_transactions_deleted', mirror_transactions_count,
        'shared_participation_removed', shared_participation_count,
        'accounts_deleted', accounts_count,
        'shared_requests_deleted', shared_requests_count,
        'mirrors_deleted', mirrors_count,
        'execution_time_ms', execution_time,
        'version', 'cascade_complete'
    );
    
    -- Log conclusão da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, execution_time_ms,
        transactions_deleted, accounts_deleted
    ) VALUES (
        target_user_id, 'completed', result, true, execution_time,
        transactions_count + mirror_transactions_count, accounts_count
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log erro
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, error_message, execution_time_ms
    ) VALUES (
        target_user_id, 'rollback_executed', 
        jsonb_build_object('error', SQLERRM, 'version', 'cascade_complete'),
        false, SQLERRM,
        EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000
    );
    
    -- Re-raise o erro
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO DE VERIFICAÇÃO ATUALIZADA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_factory_reset_completeness(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    remaining_transactions INTEGER := 0;
    remaining_mirror_transactions INTEGER := 0;
    remaining_shared_participation INTEGER := 0;
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
    
    -- Contar transações próprias restantes
    SELECT COUNT(*) INTO remaining_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND deleted = false;
    
    -- Contar transações espelho restantes
    SELECT COUNT(*) INTO remaining_mirror_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND is_mirror = true
    AND deleted = false;
    
    -- Contar participações em transações compartilhadas restantes
    SELECT COUNT(*) INTO remaining_shared_participation
    FROM public.shared_transaction_requests 
    WHERE invited_user_id = target_user_id;
    
    -- Contar contas restantes
    SELECT COUNT(*) INTO remaining_accounts
    FROM public.accounts 
    WHERE user_id = target_user_id;
    
    -- Contar solicitações compartilhadas restantes
    SELECT COUNT(*) INTO remaining_shared_requests
    FROM public.shared_transaction_requests 
    WHERE requester_id = target_user_id;
    
    -- Contar espelhos restantes
    SELECT COUNT(*) INTO remaining_mirrors
    FROM public.shared_transaction_mirrors 
    WHERE mirror_user_id = target_user_id;
    
    result := jsonb_build_object(
        'is_complete', (
            remaining_transactions = 0 AND 
            remaining_mirror_transactions = 0 AND
            remaining_shared_participation = 0 AND
            remaining_accounts = 0 AND 
            remaining_shared_requests = 0 AND 
            remaining_mirrors = 0
        ),
        'remaining_transactions', remaining_transactions,
        'remaining_mirror_transactions', remaining_mirror_transactions,
        'remaining_shared_participation', remaining_shared_participation,
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
-- FUNÇÃO PARA DIAGNÓSTICO DETALHADO
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.diagnose_factory_reset_issue(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    own_transactions INTEGER := 0;
    mirror_transactions INTEGER := 0;
    shared_participation INTEGER := 0;
    orphan_mirrors INTEGER := 0;
    cashflow_transactions INTEGER := 0;
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
    AND deleted = false;
    
    -- Contar transações espelho
    SELECT COUNT(*) INTO mirror_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND is_mirror = true
    AND deleted = false;
    
    -- Contar participações em transações compartilhadas
    SELECT COUNT(*) INTO shared_participation
    FROM public.transactions t
    INNER JOIN public.shared_transaction_requests str ON str.transaction_id = t.id
    WHERE str.invited_user_id = target_user_id
    AND str.status = 'ACCEPTED'
    AND t.deleted = false
    AND t.user_id != target_user_id;
    
    -- Contar espelhos órfãos
    SELECT COUNT(*) INTO orphan_mirrors
    FROM public.transactions t
    WHERE user_id = target_user_id
    AND is_mirror = true
    AND source_transaction_id IS NOT NULL
    AND NOT EXISTS (
        SELECT 1 FROM public.transactions t2 
        WHERE t2.id = t.source_transaction_id 
        AND t2.deleted = false
    );
    
    -- Contar transações que aparecem no fluxo de caixa
    SELECT COUNT(*) INTO cashflow_transactions
    FROM transactions
    WHERE user_id = target_user_id
    AND deleted = false
    AND type IN ('RECEITA', 'DESPESA')
    AND category != 'Saldo Inicial / Ajuste';
    
    result := jsonb_build_object(
        'own_transactions', own_transactions,
        'mirror_transactions', mirror_transactions,
        'shared_participation', shared_participation,
        'orphan_mirrors', orphan_mirrors,
        'cashflow_transactions', cashflow_transactions,
        'problem_identified', (own_transactions > 0 OR mirror_transactions > 0 OR shared_participation > 0),
        'diagnosis', CASE 
            WHEN own_transactions > 0 THEN 'Transações próprias não foram deletadas'
            WHEN mirror_transactions > 0 THEN 'Transações espelho não foram deletadas'
            WHEN shared_participation > 0 THEN 'Participações em transações compartilhadas não foram removidas'
            WHEN orphan_mirrors > 0 THEN 'Há espelhos órfãos no sistema'
            ELSE 'Factory reset foi executado corretamente'
        END,
        'checked_at', NOW()
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

COMMIT;