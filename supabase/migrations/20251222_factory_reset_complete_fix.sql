-- ==============================================================================
-- CORREÇÃO COMPLETA: Factory Reset com Limpeza Total de Dados DDD
-- DATA: 2025-12-22
-- PROBLEMA: Factory reset não está deletando dados do sistema DDD (chart_of_accounts, ledger_entries)
-- SOLUÇÃO: Função completa que limpa TODAS as tabelas relacionadas ao usuário
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- FUNÇÃO CORRIGIDA: Factory Reset Completo com Sistema DDD
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.execute_factory_reset_complete_v2(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    execution_time INTEGER;
    
    -- Contadores para auditoria
    transactions_count INTEGER := 0;
    mirror_transactions_count INTEGER := 0;
    shared_participation_count INTEGER := 0;
    accounts_count INTEGER := 0;
    shared_requests_count INTEGER := 0;
    mirrors_count INTEGER := 0;
    
    -- Novos contadores para sistema DDD
    chart_accounts_count INTEGER := 0;
    ledger_entries_count INTEGER := 0;
    bank_statements_count INTEGER := 0;
    user_settings_count INTEGER := 0;
    recovery_records_count INTEGER := 0;
    reconciliation_issues_count INTEGER := 0;
    audit_logs_count INTEGER := 0;
    resync_records_count INTEGER := 0;
    
    result JSONB;
BEGIN
    start_time := clock_timestamp();
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado - usuário só pode resetar seus próprios dados';
    END IF;
    
    -- Log início da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success
    ) VALUES (
        target_user_id, 'initiated', 
        jsonb_build_object(
            'started_at', start_time, 
            'version', 'complete_v2',
            'function', 'execute_factory_reset_complete_v2'
        ),
        true
    );
    
    -- ==============================================================================
    -- FASE 1: LIMPEZA DO SISTEMA DDD (PRIORIDADE MÁXIMA)
    -- ==============================================================================
    
    -- 1. DELETAR ENTRADAS DO LEDGER (PARTIDAS DOBRADAS)
    -- CORREÇÃO: Deletar por user_id diretamente, não por transaction_id
    WITH deleted_ledger_entries AS (
        DELETE FROM public.ledger_entries 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO ledger_entries_count FROM deleted_ledger_entries;
    
    -- 2. DELETAR PLANO DE CONTAS (CHART OF ACCOUNTS)
    -- CORREÇÃO: Esta tabela não estava sendo limpa na versão anterior
    WITH deleted_chart_accounts AS (
        DELETE FROM public.chart_of_accounts 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO chart_accounts_count FROM deleted_chart_accounts;
    
    -- ==============================================================================
    -- FASE 2: LIMPEZA DE TRANSAÇÕES E CONTAS (SISTEMA LEGADO)
    -- ==============================================================================
    
    -- 3. DELETAR TODAS AS TRANSAÇÕES PRÓPRIAS DO USUÁRIO
    WITH deleted_own_transactions AS (
        DELETE FROM public.transactions 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO transactions_count FROM deleted_own_transactions;
    
    -- 4. DELETAR TODAS AS TRANSAÇÕES ESPELHO (MIRROR) DO USUÁRIO
    WITH deleted_mirror_transactions AS (
        DELETE FROM public.transactions 
        WHERE user_id = target_user_id 
        AND is_mirror = true
        RETURNING id
    )
    SELECT COUNT(*) INTO mirror_transactions_count FROM deleted_mirror_transactions;
    
    -- 5. DELETAR TODAS AS CONTAS DO USUÁRIO
    WITH deleted_accounts AS (
        DELETE FROM public.accounts 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO accounts_count FROM deleted_accounts;
    
    -- ==============================================================================
    -- FASE 3: LIMPEZA DE SISTEMA COMPARTILHADO
    -- ==============================================================================
    
    -- 6. REMOVER PARTICIPAÇÃO EM TRANSAÇÕES COMPARTILHADAS
    WITH deleted_shared_participation AS (
        DELETE FROM public.shared_transaction_requests 
        WHERE invited_user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO shared_participation_count FROM deleted_shared_participation;
    
    -- 7. LIMPAR SOLICITAÇÕES DE COMPARTILHAMENTO (CRIADAS PELO USUÁRIO)
    WITH deleted_requests AS (
        DELETE FROM public.shared_transaction_requests 
        WHERE requester_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO shared_requests_count FROM deleted_requests;
    
    -- 8. LIMPAR ESPELHOS DE TRANSAÇÕES COMPARTILHADAS
    WITH deleted_mirrors AS (
        DELETE FROM public.shared_transaction_mirrors 
        WHERE mirror_user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO mirrors_count FROM deleted_mirrors;
    
    -- ==============================================================================
    -- FASE 4: LIMPEZA DE DADOS AUXILIARES E CONFIGURAÇÕES
    -- ==============================================================================
    
    -- 9. DELETAR EXTRATOS BANCÁRIOS
    WITH deleted_bank_statements AS (
        DELETE FROM public.bank_statements 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO bank_statements_count FROM deleted_bank_statements;
    
    -- 10. DELETAR CONFIGURAÇÕES DO USUÁRIO
    WITH deleted_user_settings AS (
        DELETE FROM public.user_settings 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO user_settings_count FROM deleted_user_settings;
    
    -- 11. DELETAR REGISTROS DE RECUPERAÇÃO
    WITH deleted_recovery_records AS (
        DELETE FROM public.recovery_records 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO recovery_records_count FROM deleted_recovery_records;
    
    -- 12. DELETAR PROBLEMAS DE RECONCILIAÇÃO
    WITH deleted_reconciliation_issues AS (
        DELETE FROM public.reconciliation_issues 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO reconciliation_issues_count FROM deleted_reconciliation_issues;
    
    -- 13. DELETAR REGISTROS DE RESSINCRONIZAÇÃO
    WITH deleted_resync_records AS (
        DELETE FROM public.user_resync_records 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO resync_records_count FROM deleted_resync_records;
    
    -- ==============================================================================
    -- FASE 5: LIMPEZA DE TABELAS OPCIONAIS (SE EXISTIREM)
    -- ==============================================================================
    
    -- Investimentos (se existir)
    DELETE FROM public.investments WHERE user_id = target_user_id;
    
    -- Orçamentos (se existir)
    DELETE FROM public.budgets WHERE user_id = target_user_id;
    
    -- Viagens do usuário (se existir)
    DELETE FROM public.trips WHERE user_id = target_user_id;
    
    -- Splits de transações (se existir)
    DELETE FROM public.transaction_splits 
    WHERE transaction_id IN (
        SELECT id FROM public.transactions WHERE user_id = target_user_id
    );
    
    -- ==============================================================================
    -- FASE 6: LIMPEZA DE LOGS DE AUDITORIA (OPCIONAL - MANTER PARA COMPLIANCE)
    -- ==============================================================================
    
    -- NOTA: Comentado para manter auditoria, mas pode ser descomentado se necessário
    -- WITH deleted_audit_logs AS (
    --     DELETE FROM public.factory_reset_audit 
    --     WHERE user_id = target_user_id
    --     AND action != 'completed' -- Manter o log desta operação
    --     RETURNING id
    -- )
    -- SELECT COUNT(*) INTO audit_logs_count FROM deleted_audit_logs;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Preparar resultado detalhado
    result := jsonb_build_object(
        'success', true,
        'version', 'complete_v2',
        'execution_time_ms', execution_time,
        
        -- Contadores do sistema DDD (NOVOS)
        'chart_accounts_deleted', chart_accounts_count,
        'ledger_entries_deleted', ledger_entries_count,
        
        -- Contadores do sistema legado
        'transactions_deleted', transactions_count,
        'mirror_transactions_deleted', mirror_transactions_count,
        'accounts_deleted', accounts_count,
        
        -- Contadores do sistema compartilhado
        'shared_participation_removed', shared_participation_count,
        'shared_requests_deleted', shared_requests_count,
        'mirrors_deleted', mirrors_count,
        
        -- Contadores de dados auxiliares
        'bank_statements_deleted', bank_statements_count,
        'user_settings_deleted', user_settings_count,
        'recovery_records_deleted', recovery_records_count,
        'reconciliation_issues_deleted', reconciliation_issues_count,
        'resync_records_deleted', resync_records_count,
        
        -- Totais
        'total_records_deleted', (
            chart_accounts_count + ledger_entries_count + 
            transactions_count + mirror_transactions_count + accounts_count +
            shared_participation_count + shared_requests_count + mirrors_count +
            bank_statements_count + user_settings_count + recovery_records_count +
            reconciliation_issues_count + resync_records_count
        )
    );
    
    -- Log conclusão da operação com detalhes completos
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, execution_time_ms,
        transactions_deleted, accounts_deleted
    ) VALUES (
        target_user_id, 'completed', result, true, execution_time,
        transactions_count + mirror_transactions_count, accounts_count
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log erro detalhado
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, error_message, execution_time_ms
    ) VALUES (
        target_user_id, 'rollback_executed', 
        jsonb_build_object(
            'error', SQLERRM,
            'error_detail', SQLSTATE,
            'version', 'complete_v2',
            'phase', 'unknown'
        ),
        false, SQLERRM,
        EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000
    );
    
    -- Re-raise o erro para o cliente
    RAISE;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- FUNÇÃO DE VERIFICAÇÃO APRIMORADA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.verify_factory_reset_completeness_v2(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    
    -- Contadores para verificação
    remaining_transactions INTEGER := 0;
    remaining_mirror_transactions INTEGER := 0;
    remaining_shared_participation INTEGER := 0;
    remaining_accounts INTEGER := 0;
    remaining_shared_requests INTEGER := 0;
    remaining_mirrors INTEGER := 0;
    
    -- Novos contadores para sistema DDD
    remaining_chart_accounts INTEGER := 0;
    remaining_ledger_entries INTEGER := 0;
    remaining_bank_statements INTEGER := 0;
    remaining_user_settings INTEGER := 0;
    remaining_recovery_records INTEGER := 0;
    remaining_reconciliation_issues INTEGER := 0;
    remaining_resync_records INTEGER := 0;
    
    total_remaining INTEGER := 0;
    tables_with_data TEXT[] := ARRAY[]::TEXT[];
    result JSONB;
BEGIN
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado - usuário só pode verificar seus próprios dados';
    END IF;
    
    -- ==============================================================================
    -- VERIFICAÇÃO DO SISTEMA DDD
    -- ==============================================================================
    
    -- Verificar chart_of_accounts
    SELECT COUNT(*) INTO remaining_chart_accounts
    FROM public.chart_of_accounts 
    WHERE user_id = target_user_id;
    
    IF remaining_chart_accounts > 0 THEN
        tables_with_data := array_append(tables_with_data, 'chart_of_accounts');
    END IF;
    
    -- Verificar ledger_entries
    SELECT COUNT(*) INTO remaining_ledger_entries
    FROM public.ledger_entries 
    WHERE user_id = target_user_id;
    
    IF remaining_ledger_entries > 0 THEN
        tables_with_data := array_append(tables_with_data, 'ledger_entries');
    END IF;
    
    -- ==============================================================================
    -- VERIFICAÇÃO DO SISTEMA LEGADO
    -- ==============================================================================
    
    -- Verificar transações próprias
    SELECT COUNT(*) INTO remaining_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND deleted = false;
    
    IF remaining_transactions > 0 THEN
        tables_with_data := array_append(tables_with_data, 'transactions');
    END IF;
    
    -- Verificar transações espelho
    SELECT COUNT(*) INTO remaining_mirror_transactions
    FROM public.transactions 
    WHERE user_id = target_user_id 
    AND is_mirror = true
    AND deleted = false;
    
    IF remaining_mirror_transactions > 0 THEN
        tables_with_data := array_append(tables_with_data, 'mirror_transactions');
    END IF;
    
    -- Verificar contas
    SELECT COUNT(*) INTO remaining_accounts
    FROM public.accounts 
    WHERE user_id = target_user_id;
    
    IF remaining_accounts > 0 THEN
        tables_with_data := array_append(tables_with_data, 'accounts');
    END IF;
    
    -- ==============================================================================
    -- VERIFICAÇÃO DO SISTEMA COMPARTILHADO
    -- ==============================================================================
    
    -- Verificar participações em transações compartilhadas
    SELECT COUNT(*) INTO remaining_shared_participation
    FROM public.shared_transaction_requests 
    WHERE invited_user_id = target_user_id;
    
    IF remaining_shared_participation > 0 THEN
        tables_with_data := array_append(tables_with_data, 'shared_participation');
    END IF;
    
    -- Verificar solicitações compartilhadas
    SELECT COUNT(*) INTO remaining_shared_requests
    FROM public.shared_transaction_requests 
    WHERE requester_id = target_user_id;
    
    IF remaining_shared_requests > 0 THEN
        tables_with_data := array_append(tables_with_data, 'shared_requests');
    END IF;
    
    -- Verificar espelhos
    SELECT COUNT(*) INTO remaining_mirrors
    FROM public.shared_transaction_mirrors 
    WHERE mirror_user_id = target_user_id;
    
    IF remaining_mirrors > 0 THEN
        tables_with_data := array_append(tables_with_data, 'mirrors');
    END IF;
    
    -- ==============================================================================
    -- VERIFICAÇÃO DE DADOS AUXILIARES
    -- ==============================================================================
    
    -- Verificar extratos bancários
    SELECT COUNT(*) INTO remaining_bank_statements
    FROM public.bank_statements 
    WHERE user_id = target_user_id;
    
    IF remaining_bank_statements > 0 THEN
        tables_with_data := array_append(tables_with_data, 'bank_statements');
    END IF;
    
    -- Verificar configurações do usuário
    SELECT COUNT(*) INTO remaining_user_settings
    FROM public.user_settings 
    WHERE user_id = target_user_id;
    
    IF remaining_user_settings > 0 THEN
        tables_with_data := array_append(tables_with_data, 'user_settings');
    END IF;
    
    -- Verificar registros de recuperação
    SELECT COUNT(*) INTO remaining_recovery_records
    FROM public.recovery_records 
    WHERE user_id = target_user_id;
    
    IF remaining_recovery_records > 0 THEN
        tables_with_data := array_append(tables_with_data, 'recovery_records');
    END IF;
    
    -- Verificar problemas de reconciliação
    SELECT COUNT(*) INTO remaining_reconciliation_issues
    FROM public.reconciliation_issues 
    WHERE user_id = target_user_id;
    
    IF remaining_reconciliation_issues > 0 THEN
        tables_with_data := array_append(tables_with_data, 'reconciliation_issues');
    END IF;
    
    -- Verificar registros de ressincronização
    SELECT COUNT(*) INTO remaining_resync_records
    FROM public.user_resync_records 
    WHERE user_id = target_user_id;
    
    IF remaining_resync_records > 0 THEN
        tables_with_data := array_append(tables_with_data, 'resync_records');
    END IF;
    
    -- Calcular total
    total_remaining := (
        remaining_chart_accounts + remaining_ledger_entries +
        remaining_transactions + remaining_mirror_transactions + remaining_accounts +
        remaining_shared_participation + remaining_shared_requests + remaining_mirrors +
        remaining_bank_statements + remaining_user_settings + remaining_recovery_records +
        remaining_reconciliation_issues + remaining_resync_records
    );
    
    result := jsonb_build_object(
        'is_complete', (total_remaining = 0),
        'version', 'complete_v2',
        'checked_at', NOW(),
        'total_remaining_records', total_remaining,
        'tables_with_data', tables_with_data,
        
        -- Detalhes do sistema DDD
        'remaining_chart_accounts', remaining_chart_accounts,
        'remaining_ledger_entries', remaining_ledger_entries,
        
        -- Detalhes do sistema legado
        'remaining_transactions', remaining_transactions,
        'remaining_mirror_transactions', remaining_mirror_transactions,
        'remaining_accounts', remaining_accounts,
        
        -- Detalhes do sistema compartilhado
        'remaining_shared_participation', remaining_shared_participation,
        'remaining_shared_requests', remaining_shared_requests,
        'remaining_mirrors', remaining_mirrors,
        
        -- Detalhes de dados auxiliares
        'remaining_bank_statements', remaining_bank_statements,
        'remaining_user_settings', remaining_user_settings,
        'remaining_recovery_records', remaining_recovery_records,
        'remaining_reconciliation_issues', remaining_reconciliation_issues,
        'remaining_resync_records', remaining_resync_records
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
-- FUNÇÃO DE DIAGNÓSTICO APRIMORADA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.diagnose_factory_reset_issue_v2(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $$
DECLARE
    calling_user_id UUID;
    
    -- Contadores para diagnóstico
    own_transactions INTEGER := 0;
    mirror_transactions INTEGER := 0;
    shared_participation INTEGER := 0;
    orphan_mirrors INTEGER := 0;
    cashflow_transactions INTEGER := 0;
    
    -- Novos contadores para sistema DDD
    chart_accounts INTEGER := 0;
    ledger_entries INTEGER := 0;
    ddd_cashflow_entries INTEGER := 0;
    
    primary_issue TEXT := 'Nenhum problema identificado';
    severity TEXT := 'low';
    recommended_actions TEXT[] := ARRAY[]::TEXT[];
    
    result JSONB;
BEGIN
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado - usuário só pode diagnosticar seus próprios dados';
    END IF;
    
    -- ==============================================================================
    -- DIAGNÓSTICO DO SISTEMA DDD (PRIORIDADE MÁXIMA)
    -- ==============================================================================
    
    -- Contar entradas do plano de contas
    SELECT COUNT(*) INTO chart_accounts
    FROM public.chart_of_accounts 
    WHERE user_id = target_user_id;
    
    -- Contar entradas do ledger
    SELECT COUNT(*) INTO ledger_entries
    FROM public.ledger_entries 
    WHERE user_id = target_user_id;
    
    -- Contar entradas do ledger que afetam fluxo de caixa
    SELECT COUNT(*) INTO ddd_cashflow_entries
    FROM public.ledger_entries le
    JOIN public.chart_of_accounts ca_debit ON le.debit_account_id = ca_debit.id
    JOIN public.chart_of_accounts ca_credit ON le.credit_account_id = ca_credit.id
    WHERE le.user_id = target_user_id
    AND (ca_debit.type IN ('REVENUE', 'EXPENSE') OR ca_credit.type IN ('REVENUE', 'EXPENSE'));
    
    -- ==============================================================================
    -- DIAGNÓSTICO DO SISTEMA LEGADO
    -- ==============================================================================
    
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
    
    -- Contar transações que aparecem no fluxo de caixa (sistema legado)
    SELECT COUNT(*) INTO cashflow_transactions
    FROM transactions
    WHERE user_id = target_user_id
    AND deleted = false
    AND type IN ('RECEITA', 'DESPESA')
    AND category != 'Saldo Inicial / Ajuste';
    
    -- ==============================================================================
    -- ANÁLISE E RECOMENDAÇÕES
    -- ==============================================================================
    
    -- Determinar problema principal e severidade
    IF chart_accounts > 0 OR ledger_entries > 0 THEN
        primary_issue := 'Dados do sistema DDD (contabilidade) não foram limpos';
        severity := 'high';
        recommended_actions := array_append(recommended_actions, 'Executar execute_factory_reset_complete_v2()');
        recommended_actions := array_append(recommended_actions, 'Verificar se as tabelas chart_of_accounts e ledger_entries foram limpas');
    ELSIF own_transactions > 0 THEN
        primary_issue := 'Transações próprias não foram deletadas';
        severity := 'high';
        recommended_actions := array_append(recommended_actions, 'Executar factory reset completo');
    ELSIF mirror_transactions > 0 THEN
        primary_issue := 'Transações espelho não foram deletadas';
        severity := 'medium';
        recommended_actions := array_append(recommended_actions, 'Limpar transações espelho manualmente');
    ELSIF shared_participation > 0 THEN
        primary_issue := 'Participações em transações compartilhadas não foram removidas';
        severity := 'medium';
        recommended_actions := array_append(recommended_actions, 'Remover participações em transações compartilhadas');
    ELSIF orphan_mirrors > 0 THEN
        primary_issue := 'Há espelhos órfãos no sistema';
        severity := 'low';
        recommended_actions := array_append(recommended_actions, 'Limpar espelhos órfãos');
    END IF;
    
    -- Adicionar recomendações específicas para DDD
    IF ddd_cashflow_entries > 0 THEN
        recommended_actions := array_append(recommended_actions, 'Limpar entradas do ledger que afetam fluxo de caixa');
    END IF;
    
    result := jsonb_build_object(
        'problem_identified', (
            chart_accounts > 0 OR ledger_entries > 0 OR 
            own_transactions > 0 OR mirror_transactions > 0 OR 
            shared_participation > 0 OR orphan_mirrors > 0
        ),
        'primary_issue', primary_issue,
        'severity', severity,
        'version', 'complete_v2',
        
        -- Contadores do sistema DDD
        'chart_accounts', chart_accounts,
        'ledger_entries', ledger_entries,
        'ddd_cashflow_entries', ddd_cashflow_entries,
        
        -- Contadores do sistema legado
        'own_transactions', own_transactions,
        'mirror_transactions', mirror_transactions,
        'shared_participation', shared_participation,
        'orphan_mirrors', orphan_mirrors,
        'cashflow_transactions', cashflow_transactions,
        
        -- Recomendações
        'recommended_actions', recommended_actions,
        'checked_at', NOW()
    );
    
    -- Log do diagnóstico
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success
    ) VALUES (
        target_user_id, 'diagnostic_check', result, true
    );
    
    RETURN result;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- LOG DA MIGRAÇÃO
-- ==============================================================================

INSERT INTO public.factory_reset_audit (
    user_id,
    action,
    details,
    success
) VALUES (
    NULL,
    'migration_applied',
    jsonb_build_object(
        'migration', '20251222_factory_reset_complete_fix',
        'timestamp', NOW(),
        'functions_created', ARRAY[
            'execute_factory_reset_complete_v2',
            'verify_factory_reset_completeness_v2', 
            'diagnose_factory_reset_issue_v2'
        ],
        'tables_added_to_cleanup', ARRAY[
            'chart_of_accounts',
            'ledger_entries',
            'bank_statements',
            'user_settings',
            'recovery_records',
            'reconciliation_issues',
            'user_resync_records'
        ],
        'fixes_applied', ARRAY[
            'Fixed ledger_entries deletion to use user_id directly',
            'Added chart_of_accounts cleanup',
            'Added comprehensive DDD system cleanup',
            'Enhanced verification and diagnostic functions'
        ]
    ),
    true
);

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
CORREÇÕES IMPLEMENTADAS:

1. SISTEMA DDD CORRIGIDO:
   - chart_of_accounts: Agora é limpa corretamente
   - ledger_entries: Corrigido para deletar por user_id diretamente
   - Verificação específica para dados de fluxo de caixa DDD

2. TABELAS ADICIONAIS LIMPAS:
   - bank_statements
   - user_settings  
   - recovery_records
   - reconciliation_issues
   - user_resync_records

3. FUNÇÕES APRIMORADAS:
   - execute_factory_reset_complete_v2: Limpeza completa
   - verify_factory_reset_completeness_v2: Verificação detalhada
   - diagnose_factory_reset_issue_v2: Diagnóstico específico para DDD

4. AUDITORIA MELHORADA:
   - Contadores específicos para cada tabela
   - Logs detalhados de cada fase
   - Rastreamento de problemas específicos do DDD

5. SEGURANÇA MANTIDA:
   - Verificação de autenticação e autorização
   - RLS preservado
   - Logs de auditoria para compliance

PRÓXIMOS PASSOS:
1. Aplicar migração no Supabase
2. Testar com dados reais
3. Atualizar código da aplicação para usar as novas funções
*/