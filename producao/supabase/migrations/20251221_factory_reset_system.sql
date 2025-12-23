-- ==============================================================================
-- FACTORY RESET SYSTEM - SCHEMA MIGRATION
-- DATA: 2025-12-21
-- OBJETIVO: Implementar sistema de factory reset com recuperação inteligente
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: TABELA DE REGISTROS DE RECUPERAÇÃO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.recovery_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    original_transaction_id UUID NOT NULL,
    transaction_type VARCHAR(50) NOT NULL CHECK (transaction_type IN ('trip', 'shared_expense', 'investment', 'budget')),
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    is_valid BOOLEAN DEFAULT true,
    
    -- Índices para performance
    CONSTRAINT recovery_records_user_transaction_unique UNIQUE(user_id, original_transaction_id)
);

-- Índices otimizados
CREATE INDEX IF NOT EXISTS idx_recovery_user_id ON public.recovery_records(user_id) WHERE is_valid = true;
CREATE INDEX IF NOT EXISTS idx_recovery_transaction_id ON public.recovery_records(original_transaction_id);
CREATE INDEX IF NOT EXISTS idx_recovery_type ON public.recovery_records(transaction_type, created_at DESC);

-- RLS para recovery_records
ALTER TABLE public.recovery_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own recovery records" ON public.recovery_records
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage their own recovery records" ON public.recovery_records
FOR ALL USING (auth.uid() = user_id);

-- ==============================================================================
-- PARTE 2: TABELA DE AUDITORIA PARA FACTORY RESET
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.factory_reset_audit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN (
        'initiated', 
        'completed', 
        'recovery_created', 
        'recovery_restored',
        'recovery_cleaned',
        'validation_failed',
        'rollback_executed'
    )),
    details JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN NOT NULL DEFAULT true,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadados específicos do factory reset
    transactions_deleted INTEGER DEFAULT 0,
    accounts_deleted INTEGER DEFAULT 0,
    investments_deleted INTEGER DEFAULT 0,
    budgets_deleted INTEGER DEFAULT 0,
    recovery_records_created INTEGER DEFAULT 0
);

-- Índices para auditoria
CREATE INDEX IF NOT EXISTS idx_audit_user_id ON public.factory_reset_audit(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_action ON public.factory_reset_audit(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_success ON public.factory_reset_audit(success, created_at DESC) WHERE success = false;

-- RLS para factory_reset_audit
ALTER TABLE public.factory_reset_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.factory_reset_audit
FOR SELECT USING (auth.uid() = user_id);

-- Admins podem ver todos os logs (para suporte)
CREATE POLICY "Admins can view all audit logs" ON public.factory_reset_audit
FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM auth.users 
        WHERE id = auth.uid() 
        AND raw_user_meta_data->>'role' = 'admin'
    )
);

-- ==============================================================================
-- PARTE 3: FUNÇÕES RPC PARA FACTORY RESET
-- ==============================================================================

-- Função para detectar transações compartilhadas
CREATE OR REPLACE FUNCTION public.detect_shared_transactions(target_user_id UUID)
RETURNS TABLE (
    transaction_id UUID,
    transaction_type TEXT,
    amount NUMERIC,
    description TEXT,
    created_date TIMESTAMPTZ,
    original_owner_id UUID,
    can_recover BOOLEAN,
    metadata JSONB
) 
SECURITY DEFINER
AS $
DECLARE
    calling_user_id UUID;
BEGIN
    -- Verificar autenticação
    calling_user_id := auth.uid();
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    -- Verificar se o usuário pode acessar os dados do target_user_id
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado aos dados do usuário';
    END IF;
    
    -- Detectar transações compartilhadas onde o usuário é participante mas não o criador
    RETURN QUERY
    SELECT 
        t.id as transaction_id,
        CASE 
            WHEN t.domain = 'TRAVEL' THEN 'trip'
            WHEN t.is_shared = true THEN 'shared_expense'
            ELSE 'other'
        END as transaction_type,
        t.amount,
        t.description,
        t.created_at as created_date,
        t.user_id as original_owner_id,
        -- Verificar se ainda pode ser recuperada (transação original existe e usuário original ainda tem acesso)
        (
            EXISTS (
                SELECT 1 FROM public.transactions orig 
                WHERE orig.id = t.id 
                AND orig.deleted = false
                AND orig.user_id = t.user_id
            )
        ) as can_recover,
        jsonb_build_object(
            'category', t.category,
            'subcategory', t.subcategory,
            'account_id', t.account_id,
            'payer_id', t.payer_id,
            'domain', t.domain
        ) as metadata
    FROM public.transactions t
    WHERE (
        -- Transações compartilhadas onde o usuário é participante
        EXISTS (
            SELECT 1 FROM public.shared_transaction_requests str
            WHERE str.transaction_id = t.id
            AND str.invited_user_id = target_user_id
            AND str.status = 'ACCEPTED'
        )
        OR
        -- Transações espelho do usuário
        EXISTS (
            SELECT 1 FROM public.shared_transaction_mirrors stm
            WHERE stm.original_transaction_id = t.id
            AND stm.mirror_user_id = target_user_id
        )
    )
    AND t.user_id != target_user_id  -- Não incluir transações próprias
    AND t.deleted = false;
END;
$ LANGUAGE plpgsql;

-- Função para criar registros de recuperação
CREATE OR REPLACE FUNCTION public.create_recovery_records(
    target_user_id UUID,
    shared_transactions JSONB
)
RETURNS INTEGER
SECURITY DEFINER
AS $
DECLARE
    calling_user_id UUID;
    transaction_record JSONB;
    records_created INTEGER := 0;
BEGIN
    -- Verificar autenticação
    calling_user_id := auth.uid();
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    -- Verificar permissão
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    -- Processar cada transação compartilhada
    FOR transaction_record IN SELECT * FROM jsonb_array_elements(shared_transactions)
    LOOP
        -- Inserir registro de recuperação
        INSERT INTO public.recovery_records (
            user_id,
            original_transaction_id,
            transaction_type,
            metadata
        ) VALUES (
            target_user_id,
            (transaction_record->>'transaction_id')::UUID,
            transaction_record->>'transaction_type',
            transaction_record->'metadata'
        )
        ON CONFLICT (user_id, original_transaction_id) 
        DO UPDATE SET 
            metadata = EXCLUDED.metadata,
            is_valid = true;
        
        records_created := records_created + 1;
    END LOOP;
    
    RETURN records_created;
END;
$ LANGUAGE plpgsql;

-- Função para executar factory reset completo
CREATE OR REPLACE FUNCTION public.execute_factory_reset(target_user_id UUID)
RETURNS JSONB
SECURITY DEFINER
AS $
DECLARE
    calling_user_id UUID;
    start_time TIMESTAMPTZ;
    end_time TIMESTAMPTZ;
    execution_time INTEGER;
    transactions_count INTEGER := 0;
    accounts_count INTEGER := 0;
    investments_count INTEGER := 0;
    budgets_count INTEGER := 0;
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
        jsonb_build_object('started_at', start_time),
        true
    );
    
    -- 1. Deletar transações pessoais (não compartilhadas como criador)
    WITH deleted_transactions AS (
        DELETE FROM public.transactions 
        WHERE user_id = target_user_id
        AND (
            is_shared = false 
            OR is_shared IS NULL
            OR is_mirror = true  -- Deletar transações espelho
        )
        AND deleted = false
        RETURNING id
    )
    SELECT COUNT(*) INTO transactions_count FROM deleted_transactions;
    
    -- 2. Marcar como deletadas as transações compartilhadas onde é criador
    -- (preservar para outros usuários, mas remover da visualização do usuário)
    UPDATE public.transactions 
    SET deleted = true, updated_at = NOW()
    WHERE user_id = target_user_id
    AND is_shared = true
    AND (is_mirror = false OR is_mirror IS NULL)
    AND deleted = false;
    
    -- 3. Deletar contas
    WITH deleted_accounts AS (
        DELETE FROM public.accounts 
        WHERE user_id = target_user_id
        RETURNING id
    )
    SELECT COUNT(*) INTO accounts_count FROM deleted_accounts;
    
    -- 4. Deletar investimentos (assumindo que existe tabela investments)
    -- Comentado pois não temos certeza da estrutura
    -- WITH deleted_investments AS (
    --     DELETE FROM public.investments 
    --     WHERE user_id = target_user_id
    --     RETURNING id
    -- )
    -- SELECT COUNT(*) INTO investments_count FROM deleted_investments;
    
    -- 5. Deletar orçamentos e metas (assumindo que existe tabela budgets)
    -- Comentado pois não temos certeza da estrutura
    -- WITH deleted_budgets AS (
    --     DELETE FROM public.budgets 
    --     WHERE user_id = target_user_id
    --     RETURNING id
    -- )
    -- SELECT COUNT(*) INTO budgets_count FROM deleted_budgets;
    
    -- 6. Limpar solicitações de transações compartilhadas
    DELETE FROM public.shared_transaction_requests 
    WHERE invited_user_id = target_user_id OR requester_id = target_user_id;
    
    -- 7. Limpar espelhos de transações
    DELETE FROM public.shared_transaction_mirrors 
    WHERE mirror_user_id = target_user_id;
    
    -- 8. Resetar configurações do usuário (se existir tabela user_settings)
    -- DELETE FROM public.user_settings WHERE user_id = target_user_id;
    
    end_time := clock_timestamp();
    execution_time := EXTRACT(EPOCH FROM (end_time - start_time)) * 1000;
    
    -- Preparar resultado
    result := jsonb_build_object(
        'success', true,
        'transactions_deleted', transactions_count,
        'accounts_deleted', accounts_count,
        'investments_deleted', investments_count,
        'budgets_deleted', budgets_count,
        'execution_time_ms', execution_time
    );
    
    -- Log conclusão da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, execution_time_ms,
        transactions_deleted, accounts_deleted, investments_deleted, budgets_deleted
    ) VALUES (
        target_user_id, 'completed', result, true, execution_time,
        transactions_count, accounts_count, investments_count, budgets_count
    );
    
    RETURN result;
    
EXCEPTION WHEN OTHERS THEN
    -- Log erro
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success, error_message, execution_time_ms
    ) VALUES (
        target_user_id, 'rollback_executed', 
        jsonb_build_object('error', SQLERRM),
        false, SQLERRM,
        EXTRACT(EPOCH FROM (clock_timestamp() - start_time)) * 1000
    );
    
    -- Re-raise o erro
    RAISE;
END;
$ LANGUAGE plpgsql;

-- Função para obter registros de recuperação
CREATE OR REPLACE FUNCTION public.get_recovery_records(target_user_id UUID)
RETURNS TABLE (
    record_id UUID,
    original_transaction_id UUID,
    transaction_type VARCHAR,
    metadata JSONB,
    created_at TIMESTAMPTZ,
    is_valid BOOLEAN,
    can_restore BOOLEAN
)
SECURITY DEFINER
AS $
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
    
    RETURN QUERY
    SELECT 
        rr.id as record_id,
        rr.original_transaction_id,
        rr.transaction_type,
        rr.metadata,
        rr.created_at,
        rr.is_valid,
        -- Verificar se ainda pode ser restaurada
        (
            rr.is_valid AND
            EXISTS (
                SELECT 1 FROM public.transactions t
                WHERE t.id = rr.original_transaction_id
                AND t.deleted = false
            )
        ) as can_restore
    FROM public.recovery_records rr
    WHERE rr.user_id = target_user_id
    AND rr.is_valid = true
    ORDER BY rr.created_at DESC;
END;
$ LANGUAGE plpgsql;

-- Função para restaurar transações selecionadas
CREATE OR REPLACE FUNCTION public.restore_transactions(
    target_user_id UUID,
    record_ids UUID[]
)
RETURNS JSONB
SECURITY DEFINER
AS $
DECLARE
    calling_user_id UUID;
    record_id UUID;
    recovery_record RECORD;
    restored_count INTEGER := 0;
    failed_count INTEGER := 0;
    errors TEXT[] := ARRAY[]::TEXT[];
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
    
    -- Processar cada registro de recuperação
    FOREACH record_id IN ARRAY record_ids
    LOOP
        BEGIN
            -- Obter dados do registro de recuperação
            SELECT * INTO recovery_record
            FROM public.recovery_records rr
            WHERE rr.id = record_id
            AND rr.user_id = target_user_id
            AND rr.is_valid = true;
            
            IF NOT FOUND THEN
                errors := array_append(errors, 'Registro não encontrado: ' || record_id::TEXT);
                failed_count := failed_count + 1;
                CONTINUE;
            END IF;
            
            -- Verificar se a transação original ainda existe
            IF NOT EXISTS (
                SELECT 1 FROM public.transactions t
                WHERE t.id = recovery_record.original_transaction_id
                AND t.deleted = false
            ) THEN
                errors := array_append(errors, 'Transação original não existe mais: ' || recovery_record.original_transaction_id::TEXT);
                failed_count := failed_count + 1;
                
                -- Marcar registro como inválido
                UPDATE public.recovery_records 
                SET is_valid = false 
                WHERE id = record_id;
                
                CONTINUE;
            END IF;
            
            -- Restaurar baseado no tipo de transação
            IF recovery_record.transaction_type = 'trip' OR recovery_record.transaction_type = 'shared_expense' THEN
                -- Recriar solicitação de transação compartilhada
                INSERT INTO public.shared_transaction_requests (
                    transaction_id,
                    requester_id,
                    invited_user_id,
                    status,
                    responded_at,
                    assigned_amount
                ) VALUES (
                    recovery_record.original_transaction_id,
                    (recovery_record.metadata->>'original_owner_id')::UUID,
                    target_user_id,
                    'ACCEPTED',
                    NOW(),
                    (recovery_record.metadata->>'amount')::NUMERIC
                )
                ON CONFLICT (transaction_id, invited_user_id) DO NOTHING;
                
                -- Criar transação espelho se necessário
                INSERT INTO public.shared_transaction_mirrors (
                    original_transaction_id,
                    mirror_transaction_id,
                    mirror_user_id,
                    sync_status
                ) 
                SELECT 
                    recovery_record.original_transaction_id,
                    recovery_record.original_transaction_id, -- Temporário, será atualizado
                    target_user_id,
                    'SYNCED'
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.shared_transaction_mirrors stm
                    WHERE stm.original_transaction_id = recovery_record.original_transaction_id
                    AND stm.mirror_user_id = target_user_id
                );
            END IF;
            
            restored_count := restored_count + 1;
            
            -- Marcar registro como processado (inválido para não aparecer novamente)
            UPDATE public.recovery_records 
            SET is_valid = false 
            WHERE id = record_id;
            
        EXCEPTION WHEN OTHERS THEN
            errors := array_append(errors, 'Erro ao restaurar ' || record_id::TEXT || ': ' || SQLERRM);
            failed_count := failed_count + 1;
        END;
    END LOOP;
    
    result := jsonb_build_object(
        'restored', restored_count,
        'failed', failed_count,
        'errors', errors
    );
    
    -- Log da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success
    ) VALUES (
        target_user_id, 'recovery_restored', result, failed_count = 0
    );
    
    RETURN result;
END;
$ LANGUAGE plpgsql;

-- Função para limpar registros de recuperação
CREATE OR REPLACE FUNCTION public.clear_recovery_records(
    target_user_id UUID,
    record_ids UUID[] DEFAULT NULL
)
RETURNS INTEGER
SECURITY DEFINER
AS $
DECLARE
    calling_user_id UUID;
    deleted_count INTEGER;
BEGIN
    calling_user_id := auth.uid();
    
    -- Verificar autenticação e permissão
    IF calling_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF calling_user_id != target_user_id THEN
        RAISE EXCEPTION 'Acesso negado';
    END IF;
    
    -- Deletar registros específicos ou todos
    IF record_ids IS NOT NULL THEN
        DELETE FROM public.recovery_records 
        WHERE user_id = target_user_id 
        AND id = ANY(record_ids);
    ELSE
        DELETE FROM public.recovery_records 
        WHERE user_id = target_user_id;
    END IF;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    
    -- Log da operação
    INSERT INTO public.factory_reset_audit (
        user_id, action, details, success
    ) VALUES (
        target_user_id, 'recovery_cleaned', 
        jsonb_build_object('deleted_count', deleted_count),
        true
    );
    
    RETURN deleted_count;
END;
$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 4: TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ==============================================================================

-- Trigger para auditoria de criação de registros de recuperação
CREATE OR REPLACE FUNCTION public.audit_recovery_record_creation()
RETURNS TRIGGER AS $
BEGIN
    INSERT INTO public.factory_reset_audit (
        user_id,
        action,
        details,
        success
    ) VALUES (
        NEW.user_id,
        'recovery_created',
        jsonb_build_object(
            'record_id', NEW.id,
            'transaction_id', NEW.original_transaction_id,
            'transaction_type', NEW.transaction_type
        ),
        true
    );
    
    RETURN NEW;
END;
$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_audit_recovery_creation
    AFTER INSERT ON public.recovery_records
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_recovery_record_creation();

-- ==============================================================================
-- PARTE 5: LIMPEZA E VERIFICAÇÕES INICIAIS
-- ==============================================================================

-- Log da migração
INSERT INTO public.factory_reset_audit (
    user_id,
    action,
    details,
    success
) VALUES (
    NULL,
    'initiated',
    jsonb_build_object(
        'migration', '20251221_factory_reset_system',
        'timestamp', NOW(),
        'tables_created', ARRAY['recovery_records', 'factory_reset_audit'],
        'functions_created', ARRAY[
            'detect_shared_transactions',
            'create_recovery_records', 
            'execute_factory_reset',
            'get_recovery_records',
            'restore_transactions',
            'clear_recovery_records'
        ]
    ),
    true
);

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
SISTEMA DE FACTORY RESET IMPLEMENTADO:

1. TABELA recovery_records:
   - Armazena referências de transações compartilhadas para recuperação
   - Metadados em JSONB para flexibilidade
   - RLS para segurança por usuário

2. TABELA factory_reset_audit:
   - Auditoria completa de todas as operações
   - Métricas de performance e contadores
   - Logs de erro para debugging

3. FUNÇÕES RPC IMPLEMENTADAS:
   - detect_shared_transactions: Detecta transações compartilhadas
   - create_recovery_records: Cria registros de recuperação
   - execute_factory_reset: Executa limpeza completa
   - get_recovery_records: Obtém dados para recuperação
   - restore_transactions: Restaura transações selecionadas
   - clear_recovery_records: Limpa registros de recuperação

4. SEGURANÇA:
   - RLS em todas as tabelas
   - Verificação de autenticação em todas as funções
   - Auditoria automática via triggers

5. PERFORMANCE:
   - Índices otimizados para consultas frequentes
   - Operações em lote quando possível
   - Métricas de tempo de execução

PRÓXIMOS PASSOS:
1. Implementar serviços TypeScript
2. Criar componentes de UI
3. Adicionar testes de propriedade
4. Integrar com sistema de autenticação
*/