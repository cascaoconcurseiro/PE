-- ==============================================================================
-- SISTEMA DE RECUPERAÇÃO AUTOMÁTICA - TASK 5
-- DATA: 2025-12-21
-- OBJETIVO: Implementar sistema robusto de recuperação automática com retry e reconciliação
-- ==============================================================================

BEGIN;

-- ==================
-- TABELAS DE CONTROLE
-- ==================

-- Tabela para controlar operações falhadas e retry
CREATE TABLE IF NOT EXISTS shared_operation_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    operation_type TEXT NOT NULL CHECK (operation_type IN ('create_shared', 'sync_shared', 'respond_request')),
    operation_data JSONB NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    retry_count INTEGER DEFAULT 0,
    max_retries INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'circuit_open')),
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Tabela para controlar circuit breaker por operação
CREATE TABLE IF NOT EXISTS shared_circuit_breaker (
    operation_type TEXT PRIMARY KEY,
    failure_count INTEGER DEFAULT 0,
    last_failure_at TIMESTAMPTZ,
    circuit_state TEXT DEFAULT 'closed' CHECK (circuit_state IN ('closed', 'open', 'half_open')),
    next_attempt_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_operation_queue_status_retry ON shared_operation_queue(status, next_retry_at) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_operation_queue_user_type ON shared_operation_queue(user_id, operation_type);
CREATE INDEX IF NOT EXISTS idx_circuit_breaker_state ON shared_circuit_breaker(circuit_state, next_attempt_at);

-- ==================
-- FUNÇÕES DE RETRY E BACKOFF
-- ==================

-- Função para calcular próximo retry com backoff exponencial
CREATE OR REPLACE FUNCTION calculate_next_retry(
    retry_count INTEGER,
    base_delay_seconds INTEGER DEFAULT 2
) RETURNS TIMESTAMPTZ AS $$
BEGIN
    -- Backoff exponencial: base_delay * (2 ^ retry_count) + jitter
    -- Máximo de 5 minutos entre tentativas
    RETURN NOW() + INTERVAL '1 second' * LEAST(
        base_delay_seconds * POWER(2, retry_count) + (RANDOM() * 10),
        300
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Função para verificar estado do circuit breaker
CREATE OR REPLACE FUNCTION check_circuit_breaker(
    p_operation_type TEXT
) RETURNS TEXT AS $$
DECLARE
    v_circuit RECORD;
    v_failure_threshold INTEGER := 5;
    v_timeout_minutes INTEGER := 5;
BEGIN
    -- Buscar ou criar registro do circuit breaker
    INSERT INTO shared_circuit_breaker (operation_type)
    VALUES (p_operation_type)
    ON CONFLICT (operation_type) DO NOTHING;
    
    SELECT * INTO v_circuit
    FROM shared_circuit_breaker
    WHERE operation_type = p_operation_type;
    
    -- Se circuito está aberto, verificar se pode tentar novamente
    IF v_circuit.circuit_state = 'open' THEN
        IF NOW() >= v_circuit.next_attempt_at THEN
            -- Mudar para half-open para permitir uma tentativa
            UPDATE shared_circuit_breaker
            SET circuit_state = 'half_open',
                updated_at = NOW()
            WHERE operation_type = p_operation_type;
            RETURN 'half_open';
        ELSE
            RETURN 'open';
        END IF;
    END IF;
    
    -- Se muitas falhas recentes, abrir circuito
    IF v_circuit.failure_count >= v_failure_threshold AND
       v_circuit.last_failure_at > NOW() - INTERVAL '5 minutes' THEN
        UPDATE shared_circuit_breaker
        SET circuit_state = 'open',
            next_attempt_at = NOW() + INTERVAL '5 minutes',
            updated_at = NOW()
        WHERE operation_type = p_operation_type;
        RETURN 'open';
    END IF;
    
    RETURN v_circuit.circuit_state;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar sucesso no circuit breaker
CREATE OR REPLACE FUNCTION record_circuit_success(
    p_operation_type TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE shared_circuit_breaker
    SET failure_count = 0,
        circuit_state = 'closed',
        updated_at = NOW()
    WHERE operation_type = p_operation_type;
END;
$$ LANGUAGE plpgsql;

-- Função para registrar falha no circuit breaker
CREATE OR REPLACE FUNCTION record_circuit_failure(
    p_operation_type TEXT,
    p_error_message TEXT
) RETURNS VOID AS $$
BEGIN
    UPDATE shared_circuit_breaker
    SET failure_count = failure_count + 1,
        last_failure_at = NOW(),
        updated_at = NOW()
    WHERE operation_type = p_operation_type;
    
    -- Log da falha para auditoria
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data
    ) VALUES (
        p_operation_type,
        'ERROR',
        'Circuit breaker failure recorded',
        jsonb_build_object('error', p_error_message)
    );
END;
$$ LANGUAGE plpgsql;

-- ==================
-- FUNÇÕES DE QUEUE DE OPERAÇÕES
-- ==================

-- Função para adicionar operação à queue
CREATE OR REPLACE FUNCTION enqueue_operation(
    p_operation_type TEXT,
    p_operation_data JSONB,
    p_user_id UUID,
    p_max_retries INTEGER DEFAULT 3
) RETURNS UUID AS $$
DECLARE
    v_operation_id UUID;
    v_circuit_state TEXT;
BEGIN
    -- Verificar circuit breaker
    v_circuit_state := check_circuit_breaker(p_operation_type);
    
    IF v_circuit_state = 'open' THEN
        RAISE EXCEPTION 'Circuit breaker is open for operation type: %', p_operation_type;
    END IF;
    
    -- Inserir na queue
    INSERT INTO shared_operation_queue (
        operation_type,
        operation_data,
        user_id,
        max_retries,
        next_retry_at
    ) VALUES (
        p_operation_type,
        p_operation_data,
        p_user_id,
        p_max_retries,
        NOW()
    ) RETURNING id INTO v_operation_id;
    
    -- Log da operação
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data,
        user_id
    ) VALUES (
        p_operation_type,
        'INFO',
        'Operation enqueued',
        jsonb_build_object(
            'operation_id', v_operation_id,
            'circuit_state', v_circuit_state
        ),
        p_user_id
    );
    
    RETURN v_operation_id;
END;
$$ LANGUAGE plpgsql;

-- Função para processar próxima operação da queue
CREATE OR REPLACE FUNCTION process_next_operation()
RETURNS TABLE(
    operation_id UUID,
    operation_type TEXT,
    operation_data JSONB,
    user_id UUID,
    retry_count INTEGER
) AS $$
DECLARE
    v_operation RECORD;
BEGIN
    -- Buscar próxima operação pendente
    SELECT * INTO v_operation
    FROM shared_operation_queue
    WHERE status = 'pending'
      AND next_retry_at <= NOW()
    ORDER BY created_at
    LIMIT 1
    FOR UPDATE SKIP LOCKED;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Marcar como processando
    UPDATE shared_operation_queue
    SET status = 'processing',
        updated_at = NOW()
    WHERE id = v_operation.id;
    
    -- Retornar dados da operação
    RETURN QUERY SELECT
        v_operation.id,
        v_operation.operation_type,
        v_operation.operation_data,
        v_operation.user_id,
        v_operation.retry_count;
END;
$$ LANGUAGE plpgsql;

-- Função para marcar operação como concluída
CREATE OR REPLACE FUNCTION complete_operation(
    p_operation_id UUID
) RETURNS VOID AS $$
DECLARE
    v_operation RECORD;
BEGIN
    SELECT * INTO v_operation
    FROM shared_operation_queue
    WHERE id = p_operation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Operation not found: %', p_operation_id;
    END IF;
    
    -- Marcar como concluída
    UPDATE shared_operation_queue
    SET status = 'completed',
        completed_at = NOW(),
        updated_at = NOW()
    WHERE id = p_operation_id;
    
    -- Registrar sucesso no circuit breaker
    PERFORM record_circuit_success(v_operation.operation_type);
    
    -- Log de sucesso
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data,
        user_id
    ) VALUES (
        v_operation.operation_type,
        'INFO',
        'Operation completed successfully',
        jsonb_build_object('operation_id', p_operation_id),
        v_operation.user_id
    );
END;
$$ LANGUAGE plpgsql;

-- Função para marcar operação como falhada e agendar retry
CREATE OR REPLACE FUNCTION fail_operation(
    p_operation_id UUID,
    p_error_message TEXT
) RETURNS VOID AS $$
DECLARE
    v_operation RECORD;
    v_next_retry TIMESTAMPTZ;
BEGIN
    SELECT * INTO v_operation
    FROM shared_operation_queue
    WHERE id = p_operation_id;
    
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Operation not found: %', p_operation_id;
    END IF;
    
    -- Incrementar contador de retry
    UPDATE shared_operation_queue
    SET retry_count = retry_count + 1,
        error_message = p_error_message,
        updated_at = NOW()
    WHERE id = p_operation_id;
    
    -- Verificar se ainda pode tentar novamente
    IF v_operation.retry_count + 1 >= v_operation.max_retries THEN
        -- Esgotar tentativas - marcar como falhada permanentemente
        UPDATE shared_operation_queue
        SET status = 'failed',
            updated_at = NOW()
        WHERE id = p_operation_id;
        
        -- Registrar falha no circuit breaker
        PERFORM record_circuit_failure(v_operation.operation_type, p_error_message);
    ELSE
        -- Agendar próximo retry
        v_next_retry := calculate_next_retry(v_operation.retry_count + 1);
        
        UPDATE shared_operation_queue
        SET status = 'pending',
            next_retry_at = v_next_retry,
            updated_at = NOW()
        WHERE id = p_operation_id;
    END IF;
    
    -- Log da falha
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data,
        user_id
    ) VALUES (
        v_operation.operation_type,
        'ERROR',
        'Operation failed',
        jsonb_build_object(
            'operation_id', p_operation_id,
            'error', p_error_message,
            'retry_count', v_operation.retry_count + 1,
            'max_retries', v_operation.max_retries
        ),
        v_operation.user_id
    );
END;
$$ LANGUAGE plpgsql;

-- ==================
-- FUNÇÕES DE LIMPEZA E MANUTENÇÃO
-- ==================

-- Função para limpar operações antigas concluídas
CREATE OR REPLACE FUNCTION cleanup_completed_operations(
    p_days_old INTEGER DEFAULT 7
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    DELETE FROM shared_operation_queue
    WHERE status = 'completed'
      AND completed_at < NOW() - INTERVAL '1 day' * p_days_old;
    
    GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
    
    -- Log da limpeza
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data
    ) VALUES (
        'maintenance',
        'INFO',
        'Cleanup completed operations',
        jsonb_build_object('deleted_count', v_deleted_count)
    );
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Função para resetar circuit breakers antigos
CREATE OR REPLACE FUNCTION reset_old_circuit_breakers(
    p_hours_old INTEGER DEFAULT 24
) RETURNS INTEGER AS $$
DECLARE
    v_reset_count INTEGER;
BEGIN
    UPDATE shared_circuit_breaker
    SET failure_count = 0,
        circuit_state = 'closed',
        updated_at = NOW()
    WHERE circuit_state = 'open'
      AND last_failure_at < NOW() - INTERVAL '1 hour' * p_hours_old;
    
    GET DIAGNOSTICS v_reset_count = ROW_COUNT;
    
    -- Log do reset
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data
    ) VALUES (
        'maintenance',
        'INFO',
        'Reset old circuit breakers',
        jsonb_build_object('reset_count', v_reset_count)
    );
    
    RETURN v_reset_count;
END;
$$ LANGUAGE plpgsql;

-- ==================
-- FUNÇÕES WRAPPER PARA OPERAÇÕES COM RETRY
-- ==================

-- Wrapper para create_shared_transaction_v2 com retry automático
CREATE OR REPLACE FUNCTION create_shared_transaction_with_retry(
    p_transaction_data JSONB,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_operation_id UUID;
    v_result JSONB;
BEGIN
    -- Tentar executar diretamente primeiro
    BEGIN
        SELECT create_shared_transaction_v2(
            p_transaction_data->>'description',
            (p_transaction_data->>'amount')::DECIMAL,
            p_transaction_data->>'category_id',
            p_transaction_data->>'account_id',
            (p_transaction_data->'shared_with')::JSONB,
            p_user_id,
            COALESCE((p_transaction_data->>'installments')::INTEGER, 1),
            p_transaction_data->>'due_date'
        ) INTO v_result;
        
        RETURN jsonb_build_object(
            'success', true,
            'data', v_result,
            'executed_immediately', true
        );
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar, adicionar à queue para retry
        v_operation_id := enqueue_operation(
            'create_shared',
            p_transaction_data,
            p_user_id
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'queued', true,
            'operation_id', v_operation_id,
            'error', SQLERRM
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- Wrapper para sync_shared_transaction_v2 com retry automático
CREATE OR REPLACE FUNCTION sync_shared_transaction_with_retry(
    p_transaction_id UUID,
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_operation_id UUID;
    v_result JSONB;
    v_operation_data JSONB;
BEGIN
    v_operation_data := jsonb_build_object(
        'transaction_id', p_transaction_id
    );
    
    -- Tentar executar diretamente primeiro
    BEGIN
        SELECT sync_shared_transaction_v2(p_transaction_id, p_user_id) INTO v_result;
        
        RETURN jsonb_build_object(
            'success', true,
            'data', v_result,
            'executed_immediately', true
        );
    EXCEPTION WHEN OTHERS THEN
        -- Se falhar, adicionar à queue para retry
        v_operation_id := enqueue_operation(
            'sync_shared',
            v_operation_data,
            p_user_id
        );
        
        RETURN jsonb_build_object(
            'success', false,
            'queued', true,
            'operation_id', v_operation_id,
            'error', SQLERRM
        );
    END;
END;
$$ LANGUAGE plpgsql;

-- ==================
-- TRIGGERS E AUTOMAÇÃO
-- ==================

-- Trigger para atualizar updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_operation_queue_updated_at
    BEFORE UPDATE ON shared_operation_queue
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_circuit_breaker_updated_at
    BEFORE UPDATE ON shared_circuit_breaker
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- ==================
-- POLÍTICAS RLS
-- ==================

-- Habilitar RLS nas novas tabelas
ALTER TABLE shared_operation_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_circuit_breaker ENABLE ROW LEVEL SECURITY;

-- Política para operation_queue - usuários só veem suas próprias operações
CREATE POLICY "Users can view their own operations" ON shared_operation_queue
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own operations" ON shared_operation_queue
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Política para circuit_breaker - apenas leitura para usuários autenticados
CREATE POLICY "Authenticated users can view circuit breaker status" ON shared_circuit_breaker
    FOR SELECT USING (auth.role() = 'authenticated');

-- ==================
-- FUNÇÕES DE MONITORAMENTO
-- ==================

-- Função para obter estatísticas da queue
CREATE OR REPLACE FUNCTION get_operation_queue_stats()
RETURNS JSONB AS $$
DECLARE
    v_stats JSONB;
BEGIN
    SELECT jsonb_build_object(
        'pending_operations', COUNT(*) FILTER (WHERE status = 'pending'),
        'processing_operations', COUNT(*) FILTER (WHERE status = 'processing'),
        'failed_operations', COUNT(*) FILTER (WHERE status = 'failed'),
        'completed_today', COUNT(*) FILTER (WHERE status = 'completed' AND completed_at > CURRENT_DATE),
        'avg_retry_count', ROUND(AVG(retry_count) FILTER (WHERE status = 'completed'), 2),
        'oldest_pending', MIN(created_at) FILTER (WHERE status = 'pending')
    ) INTO v_stats
    FROM shared_operation_queue;
    
    RETURN v_stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter status dos circuit breakers
CREATE OR REPLACE FUNCTION get_circuit_breaker_status()
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT jsonb_agg(
            jsonb_build_object(
                'operation_type', operation_type,
                'circuit_state', circuit_state,
                'failure_count', failure_count,
                'last_failure_at', last_failure_at,
                'next_attempt_at', next_attempt_at
            )
        )
        FROM shared_circuit_breaker
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================
-- INICIALIZAÇÃO
-- ==================

-- Inserir registros iniciais dos circuit breakers
INSERT INTO shared_circuit_breaker (operation_type) VALUES 
    ('create_shared'),
    ('sync_shared'),
    ('respond_request')
ON CONFLICT (operation_type) DO NOTHING;

-- Comentários para documentação
COMMENT ON TABLE shared_operation_queue IS 'Queue de operações compartilhadas com sistema de retry automático';
COMMENT ON TABLE shared_circuit_breaker IS 'Controle de circuit breaker para operações compartilhadas';
COMMENT ON FUNCTION enqueue_operation IS 'Adiciona operação à queue com verificação de circuit breaker';
COMMENT ON FUNCTION process_next_operation IS 'Processa próxima operação pendente da queue';
COMMENT ON FUNCTION calculate_next_retry IS 'Calcula próximo retry com backoff exponencial';

COMMIT;