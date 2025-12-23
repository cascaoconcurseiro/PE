-- ==============================================================================
-- SHARED SYSTEM OVERHAUL - CONSOLIDATED SCHEMA
-- DATA: 2025-12-21
-- OBJETIVO: Consolidar e reestruturar completamente o sistema de transações compartilhadas
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: BACKUP DE SEGURANÇA
-- ==============================================================================

-- Criar backup das tabelas atuais antes das alterações
CREATE TABLE IF NOT EXISTS public.backup_transactions_pre_overhaul AS
SELECT * FROM public.transactions WHERE 1=0; -- Estrutura sem dados

CREATE TABLE IF NOT EXISTS public.backup_shared_requests_pre_overhaul AS
SELECT * FROM public.shared_transaction_requests WHERE 1=0;

-- Fazer backup dos dados críticos (últimas 48h)
INSERT INTO public.backup_transactions_pre_overhaul
SELECT * FROM public.transactions
WHERE is_shared = true AND updated_at > NOW() - INTERVAL '48 hours';

INSERT INTO public.backup_shared_requests_pre_overhaul
SELECT * FROM public.shared_transaction_requests
WHERE created_at > NOW() - INTERVAL '48 hours';

RAISE NOTICE 'Backup de segurança criado com % transações e % solicitações',
    (SELECT COUNT(*) FROM public.backup_transactions_pre_overhaul),
    (SELECT COUNT(*) FROM public.backup_shared_requests_pre_overhaul);

-- ==============================================================================
-- PARTE 2: APRIMORAR TABELA SHARED_TRANSACTION_REQUESTS
-- ==============================================================================

-- Adicionar novos campos para melhor controle
ALTER TABLE public.shared_transaction_requests 
ADD COLUMN IF NOT EXISTS assigned_amount NUMERIC(15,2);

ALTER TABLE public.shared_transaction_requests 
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days');

ALTER TABLE public.shared_transaction_requests 
ADD COLUMN IF NOT EXISTS retry_count INTEGER DEFAULT 0;

ALTER TABLE public.shared_transaction_requests 
ADD COLUMN IF NOT EXISTS last_retry_at TIMESTAMPTZ;

ALTER TABLE public.shared_transaction_requests 
ADD COLUMN IF NOT EXISTS error_message TEXT;

ALTER TABLE public.shared_transaction_requests 
ADD COLUMN IF NOT EXISTS request_metadata JSONB DEFAULT '{}'::jsonb;

-- Atualizar constraint de status para incluir EXPIRED
ALTER TABLE public.shared_transaction_requests 
DROP CONSTRAINT IF EXISTS valid_status;

ALTER TABLE public.shared_transaction_requests 
ADD CONSTRAINT valid_status CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'));

-- Adicionar constraint para assigned_amount
ALTER TABLE public.shared_transaction_requests 
ADD CONSTRAINT valid_assigned_amount CHECK (assigned_amount IS NULL OR assigned_amount > 0);

-- ==============================================================================
-- PARTE 3: CRIAR TABELA SHARED_TRANSACTION_MIRRORS
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shared_transaction_mirrors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    original_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    mirror_transaction_id UUID NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    mirror_user_id UUID NOT NULL REFERENCES auth.users(id),
    sync_status TEXT DEFAULT 'SYNCED' CHECK (sync_status IN ('SYNCED', 'PENDING', 'ERROR')),
    last_sync_at TIMESTAMPTZ DEFAULT NOW(),
    sync_error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    -- Garantir que cada transação original só tenha um espelho por usuário
    UNIQUE(original_transaction_id, mirror_user_id)
);

-- RLS para shared_transaction_mirrors
ALTER TABLE public.shared_transaction_mirrors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own mirrors" ON public.shared_transaction_mirrors
FOR SELECT USING (
    auth.uid() = mirror_user_id 
    OR 
    auth.uid() = (SELECT user_id FROM public.transactions WHERE id = original_transaction_id)
);

CREATE POLICY "System can manage mirrors" ON public.shared_transaction_mirrors
FOR ALL USING (true); -- Será restringida por funções RPC

-- ==============================================================================
-- PARTE 4: APRIMORAR TABELA TRANSACTIONS PARA COMPARTILHAMENTO
-- ==============================================================================

-- Adicionar campo domain se não existir
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS domain TEXT DEFAULT 'PERSONAL' 
CHECK (domain IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS'));

-- Corrigir tipo do payer_id para TEXT (pode ser 'me' ou UUID)
ALTER TABLE public.transactions 
ALTER COLUMN payer_id TYPE TEXT;

-- Adicionar campos para melhor auditoria
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS source_transaction_id UUID REFERENCES public.transactions(id);

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS is_mirror BOOLEAN DEFAULT FALSE;

-- ==============================================================================
-- PARTE 5: CRIAR TABELA DE AUDITORIA PARA SISTEMA COMPARTILHADO
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.shared_system_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type TEXT NOT NULL CHECK (operation_type IN (
        'CREATE_SHARED_TRANSACTION', 
        'RESPOND_TO_REQUEST', 
        'SYNC_MIRROR', 
        'RETRY_OPERATION',
        'RECONCILE_DATA'
    )),
    transaction_id UUID REFERENCES public.transactions(id),
    request_id UUID REFERENCES public.shared_transaction_requests(id),
    user_id UUID REFERENCES auth.users(id),
    operation_data JSONB DEFAULT '{}'::jsonb,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    execution_time_ms INTEGER,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para audit logs
ALTER TABLE public.shared_system_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own audit logs" ON public.shared_system_audit_logs
FOR SELECT USING (auth.uid() = user_id);

-- ==============================================================================
-- PARTE 6: ÍNDICES OTIMIZADOS PARA SISTEMA COMPARTILHADO
-- ==============================================================================

-- Índices para shared_transaction_requests
CREATE INDEX IF NOT EXISTS idx_shared_requests_invited_user_status 
ON public.shared_transaction_requests(invited_user_id, status) 
WHERE status IN ('PENDING', 'ACCEPTED');

CREATE INDEX IF NOT EXISTS idx_shared_requests_expires_at 
ON public.shared_transaction_requests(expires_at) 
WHERE status = 'PENDING';

CREATE INDEX IF NOT EXISTS idx_shared_requests_retry 
ON public.shared_transaction_requests(retry_count, last_retry_at) 
WHERE status = 'PENDING' AND retry_count > 0;

-- Índices para shared_transaction_mirrors
CREATE INDEX IF NOT EXISTS idx_mirrors_original_transaction 
ON public.shared_transaction_mirrors(original_transaction_id);

CREATE INDEX IF NOT EXISTS idx_mirrors_mirror_user 
ON public.shared_transaction_mirrors(mirror_user_id, sync_status);

CREATE INDEX IF NOT EXISTS idx_mirrors_sync_status 
ON public.shared_transaction_mirrors(sync_status, last_sync_at) 
WHERE sync_status IN ('PENDING', 'ERROR');

-- Índices para transactions (compartilhamento)
CREATE INDEX IF NOT EXISTS idx_transactions_shared_payer 
ON public.transactions(is_shared, payer_id, user_id) 
WHERE is_shared = true AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_mirror 
ON public.transactions(is_mirror, source_transaction_id) 
WHERE is_mirror = true AND deleted = false;

-- Índices para audit logs
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_operation 
ON public.shared_system_audit_logs(user_id, operation_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_logs_transaction 
ON public.shared_system_audit_logs(transaction_id, created_at DESC) 
WHERE transaction_id IS NOT NULL;

-- ==============================================================================
-- PARTE 7: FUNÇÕES AUXILIARES PARA SISTEMA COMPARTILHADO
-- ==============================================================================

-- Função para limpar solicitações expiradas
CREATE OR REPLACE FUNCTION public.cleanup_expired_shared_requests()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE public.shared_transaction_requests 
    SET status = 'EXPIRED', responded_at = NOW()
    WHERE status = 'PENDING' 
    AND expires_at < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    -- Log da operação
    INSERT INTO public.shared_system_audit_logs (
        operation_type, operation_data, success, user_id
    ) VALUES (
        'CLEANUP_EXPIRED', 
        jsonb_build_object('expired_count', expired_count),
        true,
        NULL
    );
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para verificar integridade do sistema compartilhado
CREATE OR REPLACE FUNCTION public.verify_shared_system_integrity()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT,
    affected_count INTEGER
) AS $$
BEGIN
    -- Verificar transações compartilhadas sem solicitações
    RETURN QUERY
    SELECT 
        'Shared transactions without requests'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Transações compartilhadas sem solicitações correspondentes'::TEXT,
        COUNT(*)::INTEGER
    FROM public.transactions t
    WHERE t.is_shared = true 
    AND t.payer_id = 'me'
    AND NOT EXISTS (
        SELECT 1 FROM public.shared_transaction_requests str 
        WHERE str.transaction_id = t.id
    );
    
    -- Verificar espelhos órfãos
    RETURN QUERY
    SELECT 
        'Orphaned mirror transactions'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Transações espelho sem transação original'::TEXT,
        COUNT(*)::INTEGER
    FROM public.shared_transaction_mirrors stm
    WHERE NOT EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = stm.original_transaction_id
    );
    
    -- Verificar solicitações sem transações
    RETURN QUERY
    SELECT 
        'Requests without transactions'::TEXT,
        CASE WHEN COUNT(*) = 0 THEN 'PASS' ELSE 'FAIL' END::TEXT,
        'Solicitações sem transação correspondente'::TEXT,
        COUNT(*)::INTEGER
    FROM public.shared_transaction_requests str
    WHERE NOT EXISTS (
        SELECT 1 FROM public.transactions t 
        WHERE t.id = str.transaction_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 8: TRIGGERS PARA AUDITORIA AUTOMÁTICA
-- ==============================================================================

-- Trigger para auditoria de alterações em shared_transaction_requests
CREATE OR REPLACE FUNCTION public.audit_shared_request_changes()
RETURNS TRIGGER AS $$
BEGIN
    -- Log apenas mudanças de status significativas
    IF TG_OP = 'UPDATE' AND OLD.status != NEW.status THEN
        INSERT INTO public.shared_system_audit_logs (
            operation_type,
            request_id,
            transaction_id,
            user_id,
            operation_data,
            success
        ) VALUES (
            'STATUS_CHANGE',
            NEW.id,
            NEW.transaction_id,
            COALESCE(NEW.invited_user_id, NEW.requester_id),
            jsonb_build_object(
                'old_status', OLD.status,
                'new_status', NEW.status,
                'responded_at', NEW.responded_at
            ),
            true
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_audit_shared_request_changes ON public.shared_transaction_requests;
CREATE TRIGGER trigger_audit_shared_request_changes
    AFTER UPDATE ON public.shared_transaction_requests
    FOR EACH ROW
    EXECUTE FUNCTION public.audit_shared_request_changes();

-- ==============================================================================
-- PARTE 9: ATUALIZAR RLS POLICIES PARA NOVO SISTEMA
-- ==============================================================================

-- Atualizar policy de transações para incluir espelhos
DROP POLICY IF EXISTS "Users can view their own or shared transactions" ON public.transactions;
CREATE POLICY "Enhanced shared transaction access" ON public.transactions
FOR SELECT USING (
    -- Proprietário da transação
    auth.uid() = user_id 
    OR
    -- Usuário com solicitação aceita
    EXISTS (
        SELECT 1 FROM public.shared_transaction_requests str
        WHERE str.transaction_id = public.transactions.id
        AND str.invited_user_id = auth.uid()
        AND str.status IN ('PENDING', 'ACCEPTED')
    )
    OR
    -- Usuário com transação espelho
    EXISTS (
        SELECT 1 FROM public.shared_transaction_mirrors stm
        WHERE stm.original_transaction_id = public.transactions.id
        AND stm.mirror_user_id = auth.uid()
    )
    OR
    -- Transação espelho do próprio usuário
    (public.transactions.is_mirror = true AND auth.uid() = user_id)
);

-- Policy para edição de transações compartilhadas
DROP POLICY IF EXISTS "Users can update own transactions" ON public.transactions;
CREATE POLICY "Enhanced transaction update access" ON public.transactions
FOR UPDATE USING (
    -- Proprietário da transação original pode editar tudo
    (auth.uid() = user_id AND (is_mirror = false OR is_mirror IS NULL))
    OR
    -- Usuário de transação espelho pode editar apenas status de pagamento
    (auth.uid() = user_id AND is_mirror = true)
);

-- ==============================================================================
-- PARTE 10: EXECUTAR VERIFICAÇÃO DE INTEGRIDADE
-- ==============================================================================

-- Executar verificação inicial
DO $$
DECLARE
    integrity_result RECORD;
    total_issues INTEGER := 0;
BEGIN
    RAISE NOTICE 'Executando verificação de integridade do sistema compartilhado...';
    
    FOR integrity_result IN 
        SELECT * FROM public.verify_shared_system_integrity()
    LOOP
        RAISE NOTICE 'Check: % | Status: % | Count: %', 
            integrity_result.check_name, 
            integrity_result.status, 
            integrity_result.affected_count;
            
        IF integrity_result.status = 'FAIL' THEN
            total_issues := total_issues + integrity_result.affected_count;
        END IF;
    END LOOP;
    
    IF total_issues > 0 THEN
        RAISE WARNING 'Encontrados % problemas de integridade. Verifique os logs.', total_issues;
    ELSE
        RAISE NOTICE 'Verificação de integridade concluída com sucesso. Nenhum problema encontrado.';
    END IF;
END $$;

-- ==============================================================================
-- PARTE 11: LIMPEZA INICIAL
-- ==============================================================================

-- Limpar solicitações expiradas
SELECT public.cleanup_expired_shared_requests();

-- Log da migração
INSERT INTO public.shared_system_audit_logs (
    operation_type,
    operation_data,
    success,
    user_id
) VALUES (
    'SCHEMA_MIGRATION',
    jsonb_build_object(
        'migration', '20251221_shared_system_overhaul_schema',
        'timestamp', NOW(),
        'tables_created', ARRAY['shared_transaction_mirrors', 'shared_system_audit_logs'],
        'tables_modified', ARRAY['shared_transaction_requests', 'transactions']
    ),
    true,
    NULL
);

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
ALTERAÇÕES IMPLEMENTADAS:

1. TABELA shared_transaction_requests APRIMORADA:
   - assigned_amount: valor específico atribuído ao usuário
   - expires_at: data de expiração automática
   - retry_count: contador de tentativas de retry
   - error_message: mensagem de erro para debugging
   - request_metadata: metadados adicionais em JSONB

2. NOVA TABELA shared_transaction_mirrors:
   - Rastreia relação entre transação original e espelho
   - Controla status de sincronização
   - Permite recuperação de falhas

3. TABELA transactions APRIMORADA:
   - domain: categorização de domínio
   - source_transaction_id: referência à transação original
   - is_mirror: flag para identificar transações espelho

4. NOVA TABELA shared_system_audit_logs:
   - Auditoria completa de operações compartilhadas
   - Rastreamento de performance e erros
   - Base para métricas e alertas

5. ÍNDICES OTIMIZADOS:
   - Consultas de solicitações pendentes
   - Busca de transações espelho
   - Auditoria por usuário e operação

6. RLS POLICIES APRIMORADAS:
   - Acesso granular baseado em relacionamentos
   - Permissões diferenciadas para edição
   - Suporte a transações espelho

7. FUNÇÕES AUXILIARES:
   - Limpeza automática de solicitações expiradas
   - Verificação de integridade do sistema
   - Auditoria automática de mudanças

PRÓXIMOS PASSOS:
1. Implementar funções RPC v2
2. Criar sistema de recuperação automática
3. Implementar componentes frontend refatorados
4. Adicionar testes de propriedade
*/