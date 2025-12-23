-- ==============================================================================
-- SISTEMA DE RECONCILIAÇÃO AUTOMÁTICA - TASK 5.2
-- DATA: 2025-12-21
-- OBJETIVO: Detectar e corrigir inconsistências entre transações originais e espelho
-- ==============================================================================

BEGIN;

-- ==================
-- TABELAS DE CONTROLE DE RECONCILIAÇÃO
-- ==================

-- Tabela para registrar inconsistências detectadas
CREATE TABLE IF NOT EXISTS shared_inconsistencies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inconsistency_type TEXT NOT NULL CHECK (inconsistency_type IN (
        'missing_mirror', 'orphaned_mirror', 'data_mismatch', 'status_mismatch'
    )),
    original_transaction_id UUID,
    mirror_transaction_id UUID,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    details JSONB NOT NULL,
    resolution_status TEXT DEFAULT 'detected' CHECK (resolution_status IN (
        'detected', 'resolving', 'resolved', 'failed'
    )),
    resolution_attempts INTEGER DEFAULT 0,
    max_resolution_attempts INTEGER DEFAULT 3,
    detected_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tabela para histórico de reconciliações
CREATE TABLE IF NOT EXISTS shared_reconciliation_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inconsistency_id UUID REFERENCES shared_inconsistencies(id),
    action_taken TEXT NOT NULL,
    action_details JSONB,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    performed_at TIMESTAMPTZ DEFAULT NOW(),
    performed_by TEXT DEFAULT 'system'
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_inconsistencies_status ON shared_inconsistencies(resolution_status, detected_at);
CREATE INDEX IF NOT EXISTS idx_inconsistencies_user ON shared_inconsistencies(user_id, inconsistency_type);
CREATE INDEX IF NOT EXISTS idx_reconciliation_history_inconsistency ON shared_reconciliation_history(inconsistency_id);

-- ==================
-- FUNÇÕES DE DETECÇÃO DE INCONSISTÊNCIAS
-- ==================

-- Função para detectar transações espelho órfãs
CREATE OR REPLACE FUNCTION detect_orphaned_mirrors()
RETURNS INTEGER AS $$
DECLARE
    v_orphan RECORD;
    v_inconsistency_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- Buscar transações espelho sem transação original correspondente
    FOR v_orphan IN
        SELECT 
            stm.id as mirror_id,
            stm.user_id,
            stm.original_transaction_id,
            stm.shared_transaction_request_id
        FROM shared_transaction_mirrors stm
        LEFT JOIN transactions t ON t.id = stm.original_transaction_id
        WHERE t.id IS NULL
          AND NOT EXISTS (
              SELECT 1 FROM shared_inconsistencies si
              WHERE si.mirror_transaction_id = stm.id
                AND si.inconsistency_type = 'orphaned_mirror'
                AND si.resolution_status IN ('detected', 'resolving')
          )
    LOOP
        -- Registrar inconsistência
        INSERT INTO shared_inconsistencies (
            inconsistency_type,
            mirror_transaction_id,
            user_id,
            details
        ) VALUES (
            'orphaned_mirror',
            v_orphan.mirror_id,
            v_orphan.user_id,
            jsonb_build_object(
                'original_transaction_id', v_orphan.original_transaction_id,
                'request_id', v_orphan.shared_transaction_request_id,
                'detected_by', 'detect_orphaned_mirrors'
            )
        ) RETURNING id INTO v_inconsistency_id;
        
        v_count := v_count + 1;
        
        -- Log da detecção
        INSERT INTO shared_operation_logs (
            operation_type,
            log_level,
            message,
            context_data,
            user_id
        ) VALUES (
            'reconciliation',
            'WARNING',
            'Orphaned mirror transaction detected',
            jsonb_build_object(
                'inconsistency_id', v_inconsistency_id,
                'mirror_id', v_orphan.mirror_id
            ),
            v_orphan.user_id
        );
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Função para detectar transações sem espelho
CREATE OR REPLACE FUNCTION detect_missing_mirrors()
RETURNS INTEGER AS $$
DECLARE
    v_missing RECORD;
    v_inconsistency_id UUID;
    v_count INTEGER := 0;
BEGIN
    -- Buscar solicitações aceitas sem transação espelho correspondente
    FOR v_missing IN
        SELECT 
            str.id as request_id,
            str.original_transaction_id,
            str.requested_to_user_id as user_id,
            str.amount,
            str.description
        FROM shared_transaction_requests str
        WHERE str.status = 'accepted'
          AND NOT EXISTS (
              SELECT 1 FROM shared_transaction_mirrors stm
              WHERE stm.shared_transaction_request_id = str.id
          )
          AND NOT EXISTS (
              SELECT 1 FROM shared_inconsistencies si
              WHERE si.original_transaction_id = str.original_transaction_id
                AND si.user_id = str.requested_to_user_id
                AND si.inconsistency_type = 'missing_mirror'
                AND si.resolution_status IN ('detected', 'resolving')
          )
    LOOP
        -- Registrar inconsistência
        INSERT INTO shared_inconsistencies (
            inconsistency_type,
            original_transaction_id,
            user_id,
            details
        ) VALUES (
            'missing_mirror',
            v_missing.original_transaction_id,
            v_missing.user_id,
            jsonb_build_object(
                'request_id', v_missing.request_id,
                'amount', v_missing.amount,
                'description', v_missing.description,
                'detected_by', 'detect_missing_mirrors'
            )
        ) RETURNING id INTO v_inconsistency_id;
        
        v_count := v_count + 1;
        
        -- Log da detecção
        INSERT INTO shared_operation_logs (
            operation_type,
            log_level,
            message,
            context_data,
            user_id
        ) VALUES (
            'reconciliation',
            'WARNING',
            'Missing mirror transaction detected',
            jsonb_build_object(
                'inconsistency_id', v_inconsistency_id,
                'request_id', v_missing.request_id
            ),
            v_missing.user_id
        );
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- Função para detectar divergências de dados
CREATE OR REPLACE FUNCTION detect_data_mismatches()
RETURNS INTEGER AS $$
DECLARE
    v_mismatch RECORD;
    v_inconsistency_id UUID;
    v_count INTEGER := 0;
    v_differences JSONB;
BEGIN
    -- Buscar transações com dados divergentes entre original e espelho
    FOR v_mismatch IN
        SELECT 
            t.id as original_id,
            stm.id as mirror_id,
            stm.user_id,
            t.description as orig_desc,
            stm.description as mirror_desc,
            t.amount as orig_amount,
            stm.amount as mirror_amount,
            t.category_id as orig_category,
            stm.category_id as mirror_category
        FROM transactions t
        JOIN shared_transaction_mirrors stm ON stm.original_transaction_id = t.id
        WHERE (
            t.description != stm.description OR
            t.amount != stm.amount OR
            t.category_id != stm.category_id
        )
        AND NOT EXISTS (
            SELECT 1 FROM shared_inconsistencies si
            WHERE si.original_transaction_id = t.id
              AND si.mirror_transaction_id = stm.id
              AND si.inconsistency_type = 'data_mismatch'
              AND si.resolution_status IN ('detected', 'resolving')
        )
    LOOP
        -- Construir objeto com as diferenças
        v_differences := jsonb_build_object(
            'description', jsonb_build_object(
                'original', v_mismatch.orig_desc,
                'mirror', v_mismatch.mirror_desc,
                'differs', v_mismatch.orig_desc != v_mismatch.mirror_desc
            ),
            'amount', jsonb_build_object(
                'original', v_mismatch.orig_amount,
                'mirror', v_mismatch.mirror_amount,
                'differs', v_mismatch.orig_amount != v_mismatch.mirror_amount
            ),
            'category_id', jsonb_build_object(
                'original', v_mismatch.orig_category,
                'mirror', v_mismatch.mirror_category,
                'differs', v_mismatch.orig_category != v_mismatch.mirror_category
            )
        );
        
        -- Registrar inconsistência
        INSERT INTO shared_inconsistencies (
            inconsistency_type,
            original_transaction_id,
            mirror_transaction_id,
            user_id,
            details
        ) VALUES (
            'data_mismatch',
            v_mismatch.original_id,
            v_mismatch.mirror_id,
            v_mismatch.user_id,
            jsonb_build_object(
                'differences', v_differences,
                'detected_by', 'detect_data_mismatches'
            )
        ) RETURNING id INTO v_inconsistency_id;
        
        v_count := v_count + 1;
        
        -- Log da detecção
        INSERT INTO shared_operation_logs (
            operation_type,
            log_level,
            message,
            context_data,
            user_id
        ) VALUES (
            'reconciliation',
            'WARNING',
            'Data mismatch detected between original and mirror',
            jsonb_build_object(
                'inconsistency_id', v_inconsistency_id,
                'original_id', v_mismatch.original_id,
                'mirror_id', v_mismatch.mirror_id,
                'differences', v_differences
            ),
            v_mismatch.user_id
        );
    END LOOP;
    
    RETURN v_count;
END;
$$ LANGUAGE plpgsql;

-- ==================
-- FUNÇÕES DE RESOLUÇÃO AUTOMÁTICA
-- ==================

-- Função para resolver transações espelho órfãs
CREATE OR REPLACE FUNCTION resolve_orphaned_mirror(
    p_inconsistency_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_inconsistency RECORD;
    v_success BOOLEAN := FALSE;
    v_error_msg TEXT;
BEGIN
    -- Buscar dados da inconsistência
    SELECT * INTO v_inconsistency
    FROM shared_inconsistencies
    WHERE id = p_inconsistency_id
      AND inconsistency_type = 'orphaned_mirror'
      AND resolution_status = 'detected';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Marcar como resolvendo
    UPDATE shared_inconsistencies
    SET resolution_status = 'resolving',
        resolution_attempts = resolution_attempts + 1,
        updated_at = NOW()
    WHERE id = p_inconsistency_id;
    
    BEGIN
        -- Remover transação espelho órfã
        DELETE FROM shared_transaction_mirrors
        WHERE id = v_inconsistency.mirror_transaction_id;
        
        -- Registrar ação no histórico
        INSERT INTO shared_reconciliation_history (
            inconsistency_id,
            action_taken,
            action_details,
            success
        ) VALUES (
            p_inconsistency_id,
            'delete_orphaned_mirror',
            jsonb_build_object(
                'mirror_id', v_inconsistency.mirror_transaction_id,
                'reason', 'Original transaction not found'
            ),
            TRUE
        );
        
        v_success := TRUE;
        
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := SQLERRM;
        
        -- Registrar falha no histórico
        INSERT INTO shared_reconciliation_history (
            inconsistency_id,
            action_taken,
            action_details,
            success,
            error_message
        ) VALUES (
            p_inconsistency_id,
            'delete_orphaned_mirror',
            jsonb_build_object(
                'mirror_id', v_inconsistency.mirror_transaction_id
            ),
            FALSE,
            v_error_msg
        );
    END;
    
    -- Atualizar status da inconsistência
    UPDATE shared_inconsistencies
    SET resolution_status = CASE WHEN v_success THEN 'resolved' ELSE 'failed' END,
        resolved_at = CASE WHEN v_success THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_inconsistency_id;
    
    RETURN v_success;
END;
$$ LANGUAGE plpgsql;

-- Função para resolver transações espelho faltantes
CREATE OR REPLACE FUNCTION resolve_missing_mirror(
    p_inconsistency_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_inconsistency RECORD;
    v_request RECORD;
    v_original RECORD;
    v_mirror_id UUID;
    v_success BOOLEAN := FALSE;
    v_error_msg TEXT;
BEGIN
    -- Buscar dados da inconsistência
    SELECT * INTO v_inconsistency
    FROM shared_inconsistencies
    WHERE id = p_inconsistency_id
      AND inconsistency_type = 'missing_mirror'
      AND resolution_status = 'detected';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Buscar dados da solicitação
    SELECT * INTO v_request
    FROM shared_transaction_requests
    WHERE id = (v_inconsistency.details->>'request_id')::UUID;
    
    -- Buscar dados da transação original
    SELECT * INTO v_original
    FROM transactions
    WHERE id = v_inconsistency.original_transaction_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Marcar como resolvendo
    UPDATE shared_inconsistencies
    SET resolution_status = 'resolving',
        resolution_attempts = resolution_attempts + 1,
        updated_at = NOW()
    WHERE id = p_inconsistency_id;
    
    BEGIN
        -- Criar transação espelho faltante
        INSERT INTO shared_transaction_mirrors (
            original_transaction_id,
            shared_transaction_request_id,
            user_id,
            description,
            amount,
            category_id,
            account_id,
            transaction_date,
            due_date,
            status,
            installment_number,
            total_installments
        ) VALUES (
            v_original.id,
            v_request.id,
            v_inconsistency.user_id,
            v_original.description,
            v_request.amount,
            v_original.category_id,
            v_request.account_id,
            v_original.transaction_date,
            v_original.due_date,
            'pending',
            COALESCE(v_original.installment_number, 1),
            COALESCE(v_original.total_installments, 1)
        ) RETURNING id INTO v_mirror_id;
        
        -- Registrar ação no histórico
        INSERT INTO shared_reconciliation_history (
            inconsistency_id,
            action_taken,
            action_details,
            success
        ) VALUES (
            p_inconsistency_id,
            'create_missing_mirror',
            jsonb_build_object(
                'mirror_id', v_mirror_id,
                'original_id', v_original.id,
                'request_id', v_request.id
            ),
            TRUE
        );
        
        v_success := TRUE;
        
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := SQLERRM;
        
        -- Registrar falha no histórico
        INSERT INTO shared_reconciliation_history (
            inconsistency_id,
            action_taken,
            action_details,
            success,
            error_message
        ) VALUES (
            p_inconsistency_id,
            'create_missing_mirror',
            jsonb_build_object(
                'original_id', v_original.id,
                'request_id', v_request.id
            ),
            FALSE,
            v_error_msg
        );
    END;
    
    -- Atualizar status da inconsistência
    UPDATE shared_inconsistencies
    SET resolution_status = CASE WHEN v_success THEN 'resolved' ELSE 'failed' END,
        resolved_at = CASE WHEN v_success THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_inconsistency_id;
    
    RETURN v_success;
END;
$$ LANGUAGE plpgsql;

-- Função para resolver divergências de dados
CREATE OR REPLACE FUNCTION resolve_data_mismatch(
    p_inconsistency_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_inconsistency RECORD;
    v_original RECORD;
    v_success BOOLEAN := FALSE;
    v_error_msg TEXT;
BEGIN
    -- Buscar dados da inconsistência
    SELECT * INTO v_inconsistency
    FROM shared_inconsistencies
    WHERE id = p_inconsistency_id
      AND inconsistency_type = 'data_mismatch'
      AND resolution_status = 'detected';
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Buscar dados da transação original (fonte da verdade)
    SELECT * INTO v_original
    FROM transactions
    WHERE id = v_inconsistency.original_transaction_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Marcar como resolvendo
    UPDATE shared_inconsistencies
    SET resolution_status = 'resolving',
        resolution_attempts = resolution_attempts + 1,
        updated_at = NOW()
    WHERE id = p_inconsistency_id;
    
    BEGIN
        -- Atualizar transação espelho com dados da original
        UPDATE shared_transaction_mirrors
        SET description = v_original.description,
            category_id = v_original.category_id,
            updated_at = NOW()
        WHERE id = v_inconsistency.mirror_transaction_id;
        
        -- Registrar ação no histórico
        INSERT INTO shared_reconciliation_history (
            inconsistency_id,
            action_taken,
            action_details,
            success
        ) VALUES (
            p_inconsistency_id,
            'sync_mirror_data',
            jsonb_build_object(
                'mirror_id', v_inconsistency.mirror_transaction_id,
                'original_id', v_original.id,
                'synced_fields', ARRAY['description', 'category_id']
            ),
            TRUE
        );
        
        v_success := TRUE;
        
    EXCEPTION WHEN OTHERS THEN
        v_error_msg := SQLERRM;
        
        -- Registrar falha no histórico
        INSERT INTO shared_reconciliation_history (
            inconsistency_id,
            action_taken,
            action_details,
            success,
            error_message
        ) VALUES (
            p_inconsistency_id,
            'sync_mirror_data',
            jsonb_build_object(
                'mirror_id', v_inconsistency.mirror_transaction_id,
                'original_id', v_original.id
            ),
            FALSE,
            v_error_msg
        );
    END;
    
    -- Atualizar status da inconsistência
    UPDATE shared_inconsistencies
    SET resolution_status = CASE WHEN v_success THEN 'resolved' ELSE 'failed' END,
        resolved_at = CASE WHEN v_success THEN NOW() ELSE NULL END,
        updated_at = NOW()
    WHERE id = p_inconsistency_id;
    
    RETURN v_success;
END;
$$ LANGUAGE plpgsql;
-- ==================
-- FUNÇÃO PRINCIPAL DE RECONCILIAÇÃO
-- ==================

-- Função para executar reconciliação completa
CREATE OR REPLACE FUNCTION run_full_reconciliation()
RETURNS JSONB AS $$
DECLARE
    v_orphaned_count INTEGER;
    v_missing_count INTEGER;
    v_mismatch_count INTEGER;
    v_resolved_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_inconsistency RECORD;
    v_resolution_success BOOLEAN;
    v_start_time TIMESTAMPTZ := NOW();
BEGIN
    -- Log início da reconciliação
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data
    ) VALUES (
        'reconciliation',
        'INFO',
        'Starting full reconciliation process',
        jsonb_build_object('started_at', v_start_time)
    );
    
    -- 1. Detectar inconsistências
    v_orphaned_count := detect_orphaned_mirrors();
    v_missing_count := detect_missing_mirrors();
    v_mismatch_count := detect_data_mismatches();
    
    -- 2. Resolver inconsistências detectadas
    FOR v_inconsistency IN
        SELECT id, inconsistency_type, resolution_attempts, max_resolution_attempts
        FROM shared_inconsistencies
        WHERE resolution_status = 'detected'
          AND resolution_attempts < max_resolution_attempts
        ORDER BY detected_at
    LOOP
        v_resolution_success := FALSE;
        
        -- Resolver baseado no tipo
        CASE v_inconsistency.inconsistency_type
            WHEN 'orphaned_mirror' THEN
                v_resolution_success := resolve_orphaned_mirror(v_inconsistency.id);
            WHEN 'missing_mirror' THEN
                v_resolution_success := resolve_missing_mirror(v_inconsistency.id);
            WHEN 'data_mismatch' THEN
                v_resolution_success := resolve_data_mismatch(v_inconsistency.id);
        END CASE;
        
        IF v_resolution_success THEN
            v_resolved_count := v_resolved_count + 1;
        ELSE
            v_failed_count := v_failed_count + 1;
        END IF;
    END LOOP;
    
    -- Log resultado da reconciliação
    INSERT INTO shared_operation_logs (
        operation_type,
        log_level,
        message,
        context_data
    ) VALUES (
        'reconciliation',
        'INFO',
        'Full reconciliation process completed',
        jsonb_build_object(
            'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time)),
            'orphaned_detected', v_orphaned_count,
            'missing_detected', v_missing_count,
            'mismatches_detected', v_mismatch_count,
            'resolved_count', v_resolved_count,
            'failed_count', v_failed_count
        )
    );
    
    RETURN jsonb_build_object(
        'success', true,
        'summary', jsonb_build_object(
            'orphaned_detected', v_orphaned_count,
            'missing_detected', v_missing_count,
            'mismatches_detected', v_mismatch_count,
            'resolved_count', v_resolved_count,
            'failed_count', v_failed_count,
            'duration_seconds', EXTRACT(EPOCH FROM (NOW() - v_start_time))
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Função para reconciliação específica de um usuário
CREATE OR REPLACE FUNCTION run_user_reconciliation(
    p_user_id UUID
) RETURNS JSONB AS $$
DECLARE
    v_resolved_count INTEGER := 0;
    v_failed_count INTEGER := 0;
    v_inconsistency RECORD;
    v_resolution_success BOOLEAN;
BEGIN
    -- Resolver inconsistências pendentes do usuário
    FOR v_inconsistency IN
        SELECT id, inconsistency_type, resolution_attempts, max_resolution_attempts
        FROM shared_inconsistencies
        WHERE user_id = p_user_id
          AND resolution_status = 'detected'
          AND resolution_attempts < max_resolution_attempts
        ORDER BY detected_at
    LOOP
        v_resolution_success := FALSE;
        
        -- Resolver baseado no tipo
        CASE v_inconsistency.inconsistency_type
            WHEN 'orphaned_mirror' THEN
                v_resolution_success := resolve_orphaned_mirror(v_inconsistency.id);
            WHEN 'missing_mirror' THEN
                v_resolution_success := resolve_missing_mirror(v_inconsistency.id);
            WHEN 'data_mismatch' THEN
                v_resolution_success := resolve_data_mismatch(v_inconsistency.id);
        END CASE;
        
        IF v_resolution_success THEN
            v_resolved_count := v_resolved_count + 1;
        ELSE
            v_failed_count := v_failed_count + 1;
        END IF;
    END LOOP;
    
    RETURN jsonb_build_object(
        'success', true,
        'user_id', p_user_id,
        'resolved_count', v_resolved_count,
        'failed_count', v_failed_count
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================
-- FUNÇÕES DE MONITORAMENTO E RELATÓRIOS
-- ==================

-- Função para obter estatísticas de inconsistências
CREATE OR REPLACE FUNCTION get_inconsistency_stats()
RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'by_type', jsonb_object_agg(
                inconsistency_type,
                jsonb_build_object(
                    'total', count(*),
                    'detected', count(*) FILTER (WHERE resolution_status = 'detected'),
                    'resolving', count(*) FILTER (WHERE resolution_status = 'resolving'),
                    'resolved', count(*) FILTER (WHERE resolution_status = 'resolved'),
                    'failed', count(*) FILTER (WHERE resolution_status = 'failed')
                )
            ),
            'total_inconsistencies', count(*),
            'resolution_rate', ROUND(
                count(*) FILTER (WHERE resolution_status = 'resolved')::DECIMAL / 
                NULLIF(count(*), 0) * 100, 2
            ),
            'oldest_unresolved', MIN(detected_at) FILTER (WHERE resolution_status = 'detected')
        )
        FROM shared_inconsistencies
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Função para obter relatório de reconciliação
CREATE OR REPLACE FUNCTION get_reconciliation_report(
    p_days_back INTEGER DEFAULT 7
) RETURNS JSONB AS $$
BEGIN
    RETURN (
        SELECT jsonb_build_object(
            'period_days', p_days_back,
            'inconsistencies_detected', count(DISTINCT si.id),
            'resolution_attempts', count(srh.id),
            'successful_resolutions', count(srh.id) FILTER (WHERE srh.success = true),
            'failed_resolutions', count(srh.id) FILTER (WHERE srh.success = false),
            'success_rate', ROUND(
                count(srh.id) FILTER (WHERE srh.success = true)::DECIMAL /
                NULLIF(count(srh.id), 0) * 100, 2
            ),
            'actions_by_type', jsonb_object_agg(
                srh.action_taken,
                count(srh.id)
            ) FILTER (WHERE srh.action_taken IS NOT NULL)
        )
        FROM shared_inconsistencies si
        LEFT JOIN shared_reconciliation_history srh ON srh.inconsistency_id = si.id
        WHERE si.detected_at >= NOW() - INTERVAL '1 day' * p_days_back
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================
-- TRIGGERS E AUTOMAÇÃO
-- ==================

-- Trigger para atualizar updated_at
CREATE TRIGGER update_inconsistencies_updated_at
    BEFORE UPDATE ON shared_inconsistencies
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Função para executar reconciliação automática após detecção
CREATE OR REPLACE FUNCTION auto_reconcile_on_detection()
RETURNS TRIGGER AS $$
BEGIN
    -- Tentar resolver automaticamente inconsistências simples
    IF NEW.inconsistency_type IN ('orphaned_mirror', 'missing_mirror') THEN
        PERFORM enqueue_operation(
            'reconcile_inconsistency',
            jsonb_build_object('inconsistency_id', NEW.id),
            NEW.user_id,
            1 -- Apenas uma tentativa automática
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para reconciliação automática
CREATE TRIGGER auto_reconcile_trigger
    AFTER INSERT ON shared_inconsistencies
    FOR EACH ROW
    EXECUTE FUNCTION auto_reconcile_on_detection();

-- ==================
-- POLÍTICAS RLS
-- ==================

-- Habilitar RLS
ALTER TABLE shared_inconsistencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_reconciliation_history ENABLE ROW LEVEL SECURITY;

-- Políticas para inconsistências - usuários só veem suas próprias
CREATE POLICY "Users can view their own inconsistencies" ON shared_inconsistencies
    FOR SELECT USING (auth.uid() = user_id);

-- Políticas para histórico - usuários só veem histórico de suas inconsistências
CREATE POLICY "Users can view their reconciliation history" ON shared_reconciliation_history
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM shared_inconsistencies si
            WHERE si.id = inconsistency_id
              AND si.user_id = auth.uid()
        )
    );

-- ==================
-- FUNÇÕES DE MANUTENÇÃO
-- ==================

-- Função para limpar inconsistências antigas resolvidas
CREATE OR REPLACE FUNCTION cleanup_resolved_inconsistencies(
    p_days_old INTEGER DEFAULT 30
) RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Remover histórico primeiro (FK constraint)
    DELETE FROM shared_reconciliation_history
    WHERE inconsistency_id IN (
        SELECT id FROM shared_inconsistencies
        WHERE resolution_status = 'resolved'
          AND resolved_at < NOW() - INTERVAL '1 day' * p_days_old
    );
    
    -- Remover inconsistências resolvidas antigas
    DELETE FROM shared_inconsistencies
    WHERE resolution_status = 'resolved'
      AND resolved_at < NOW() - INTERVAL '1 day' * p_days_old;
    
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
        'Cleanup resolved inconsistencies',
        jsonb_build_object('deleted_count', v_deleted_count)
    );
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==================
-- COMENTÁRIOS E DOCUMENTAÇÃO
-- ==================

COMMENT ON TABLE shared_inconsistencies IS 'Registro de inconsistências detectadas no sistema compartilhado';
COMMENT ON TABLE shared_reconciliation_history IS 'Histórico de ações de reconciliação executadas';
COMMENT ON FUNCTION run_full_reconciliation IS 'Executa processo completo de reconciliação detectando e resolvendo inconsistências';
COMMENT ON FUNCTION detect_orphaned_mirrors IS 'Detecta transações espelho sem transação original correspondente';
COMMENT ON FUNCTION detect_missing_mirrors IS 'Detecta solicitações aceitas sem transação espelho correspondente';
COMMENT ON FUNCTION detect_data_mismatches IS 'Detecta divergências de dados entre transações originais e espelho';

COMMIT;