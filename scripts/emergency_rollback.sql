-- ==============================================================================
-- SCRIPT DE ROLLBACK DE EMERGÊNCIA
-- DATA: 2025-12-21
-- OBJETIVO: Reverter sistema compartilhado para estado anterior em caso de problemas
-- ==============================================================================

-- INSTRUÇÕES DE USO:
-- 1. Execute este script apenas em caso de emergência
-- 2. Faça backup dos dados atuais antes de executar
-- 3. Teste em ambiente de desenvolvimento primeiro
-- 4. Monitore logs durante a execução

BEGIN;

-- ========================================
-- 1. VERIFICAÇÕES DE SEGURANÇA
-- ========================================

DO $$
DECLARE
    current_user_count INTEGER;
    current_transaction_count INTEGER;
BEGIN
    -- Verificar se há usuários ativos
    SELECT COUNT(*) INTO current_user_count FROM auth.users WHERE deleted_at IS NULL;
    
    -- Verificar se há transações recentes
    SELECT COUNT(*) INTO current_transaction_count 
    FROM public.transactions 
    WHERE created_at > NOW() - INTERVAL '1 hour';
    
    -- Alertas de segurança
    IF current_user_count > 100 THEN
        RAISE WARNING 'ATENÇÃO: % usuários ativos no sistema', current_user_count;
    END IF;
    
    IF current_transaction_count > 50 THEN
        RAISE WARNING 'ATENÇÃO: % transações criadas na última hora', current_transaction_count;
    END IF;
    
    RAISE NOTICE 'Verificações de segurança concluídas. Prosseguindo com rollback...';
END $$;

-- ========================================
-- 2. BACKUP DE EMERGÊNCIA DOS DADOS ATUAIS
-- ========================================

-- Criar tabela de backup para dados atuais
CREATE TABLE IF NOT EXISTS public.emergency_backup_transactions AS
SELECT * FROM public.transactions WHERE 1=0; -- Estrutura sem dados

CREATE TABLE IF NOT EXISTS public.emergency_backup_shared_requests AS
SELECT * FROM public.shared_transaction_requests WHERE 1=0;

-- Fazer backup dos dados atuais
INSERT INTO public.emergency_backup_transactions
SELECT * FROM public.transactions
WHERE updated_at > NOW() - INTERVAL '24 hours';

INSERT INTO public.emergency_backup_shared_requests
SELECT * FROM public.shared_transaction_requests
WHERE created_at > NOW() - INTERVAL '24 hours';

RAISE NOTICE 'Backup de emergência dos dados atuais concluído';

-- ========================================
-- 3. DESABILITAR TRIGGERS TEMPORARIAMENTE
-- ========================================

ALTER TABLE public.transactions DISABLE TRIGGER ALL;
ALTER TABLE public.shared_transaction_requests DISABLE TRIGGER ALL;
ALTER TABLE public.family_members DISABLE TRIGGER ALL;

RAISE NOTICE 'Triggers desabilitados temporariamente';

-- ========================================
-- 4. RESTAURAR FUNÇÕES ORIGINAIS
-- ========================================

-- Remover funções problemáticas v2
DROP FUNCTION IF EXISTS public.create_shared_transaction_v2(TEXT, NUMERIC, TEXT, DATE, UUID, JSONB, UUID, JSONB);
DROP FUNCTION IF EXISTS public.respond_to_shared_request_v2(UUID, TEXT, UUID);
DROP FUNCTION IF EXISTS public.sync_shared_transaction_v2(UUID);

-- Restaurar função create_transaction original
CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Validação de autenticação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Domain Resolution: TRAVEL se tem trip, senão PERSONAL
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- Validação de Transferência
    IF p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL THEN
        RAISE EXCEPTION 'Transferência requer conta de destino.';
    END IF;

    -- Inserção da transação
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id,
        created_at, updated_at
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with,
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END,
        NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

RAISE NOTICE 'Funções originais restauradas';

-- ========================================
-- 5. REMOVER TABELAS ADICIONADAS NA REESTRUTURAÇÃO
-- ========================================

-- Remover tabelas que foram adicionadas durante a reestruturação
DROP TABLE IF EXISTS public.shared_transaction_mirrors CASCADE;
DROP TABLE IF EXISTS public.shared_system_audit_logs CASCADE;
DROP TABLE IF EXISTS public.shared_system_metrics CASCADE;

RAISE NOTICE 'Tabelas da reestruturação removidas';

-- ========================================
-- 6. RESTAURAR RLS POLICIES ORIGINAIS
-- ========================================

-- Remover policies da reestruturação
DROP POLICY IF EXISTS "Enhanced shared transaction access" ON public.transactions;
DROP POLICY IF EXISTS "Improved shared request management" ON public.shared_transaction_requests;

-- Restaurar policies originais
DROP POLICY IF EXISTS "Users can view their own or shared transactions" ON public.transactions;
CREATE POLICY "Users can view their own or shared transactions"
ON public.transactions
FOR SELECT
USING (
  auth.uid() = user_id -- Owner
  OR
  exists (
    select 1 from public.shared_transaction_requests
    where transaction_id = public.transactions.id
    and invited_user_id = auth.uid()
    and status IN ('PENDING', 'ACCEPTED')
  )
);

RAISE NOTICE 'RLS policies originais restauradas';

-- ========================================
-- 7. REABILITAR TRIGGERS
-- ========================================

ALTER TABLE public.transactions ENABLE TRIGGER ALL;
ALTER TABLE public.shared_transaction_requests ENABLE TRIGGER ALL;
ALTER TABLE public.family_members ENABLE TRIGGER ALL;

RAISE NOTICE 'Triggers reabilitados';

-- ========================================
-- 8. VALIDAÇÃO PÓS-ROLLBACK
-- ========================================

DO $$
DECLARE
    transaction_count INTEGER;
    request_count INTEGER;
    function_exists BOOLEAN;
BEGIN
    -- Verificar integridade dos dados
    SELECT COUNT(*) INTO transaction_count FROM public.transactions;
    SELECT COUNT(*) INTO request_count FROM public.shared_transaction_requests;
    
    -- Verificar se função principal existe
    SELECT EXISTS(
        SELECT 1 FROM pg_proc 
        WHERE proname = 'create_transaction' 
        AND pg_get_function_identity_arguments(oid) LIKE '%p_description%'
    ) INTO function_exists;
    
    -- Relatório de validação
    RAISE NOTICE 'VALIDAÇÃO PÓS-ROLLBACK:';
    RAISE NOTICE '- Transações: %', transaction_count;
    RAISE NOTICE '- Solicitações compartilhadas: %', request_count;
    RAISE NOTICE '- Função create_transaction existe: %', function_exists;
    
    IF NOT function_exists THEN
        RAISE EXCEPTION 'ERRO: Função create_transaction não foi restaurada corretamente';
    END IF;
END $$;

-- ========================================
-- 9. LOG DO ROLLBACK
-- ========================================

INSERT INTO public.backup_metadata (
    backup_type, 
    description, 
    notes
) VALUES (
    'EMERGENCY_ROLLBACK',
    'Rollback de emergência executado - sistema restaurado para estado anterior',
    'Rollback executado em ' || NOW()::TEXT || '. Dados de emergência salvos em emergency_backup_* tables.'
);

COMMIT;

-- ========================================
-- 10. INSTRUÇÕES PÓS-ROLLBACK
-- ========================================

DO $$
BEGIN
    RAISE NOTICE '========================================';
    RAISE NOTICE 'ROLLBACK DE EMERGÊNCIA CONCLUÍDO';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Verificar se aplicação frontend está funcionando';
    RAISE NOTICE '2. Testar funcionalidades básicas de transações';
    RAISE NOTICE '3. Verificar logs de erro na aplicação';
    RAISE NOTICE '4. Considerar restaurar dados de emergency_backup_* se necessário';
    RAISE NOTICE '5. Investigar causa raiz dos problemas antes de tentar reestruturação novamente';
    RAISE NOTICE '';
    RAISE NOTICE 'DADOS DE BACKUP DISPONÍVEIS EM:';
    RAISE NOTICE '- emergency_backup_transactions';
    RAISE NOTICE '- emergency_backup_shared_requests';
    RAISE NOTICE '- supabase/backups/pre_shared_system_overhaul_backup.sql';
END $$;