-- ==============================================================================
-- MIGRATION: SHARED ENGINE AUDIT & RECOVERY (SECTION 4)
-- DATA: 2025-12-13
-- DESCRIÇÃO: Tabela de auditoria e função administrativa de recuperação de desastres
-- ==============================================================================

-- 1. TABELA DE OBSERVABILIDADE (SYSTEM LOGS)
CREATE TABLE IF NOT EXISTS system_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    level TEXT CHECK (level IN ('INFO', 'WARN', 'ERROR', 'CRITICAL')),
    source TEXT NOT NULL, -- Ex: 'shared_engine'
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Index para busca rápida de logs de erro
CREATE INDEX IF NOT EXISTS idx_system_logs_level_source ON system_logs(level, source);


-- 2. FUNÇÃO: REPROCESSAMENTO E RECUPERAÇÃO DE DESASTRES (Disaster Recovery)
-- Esta função força o espelhamento de transações antigas ou quebradas
CREATE OR REPLACE FUNCTION rebuild_mirrored_transactions(target_user_id UUID, specific_transaction_id UUID DEFAULT NULL)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    rec RECORD;
    count_processed INT := 0;
    count_errors INT := 0;
BEGIN
    -- Se specific_transaction_id for fornecido, reprocessa apenas ela
    -- Caso contrário, reprocessa todas do user target
    
    FOR rec IN 
        SELECT * FROM transactions 
        WHERE (specific_transaction_id IS NULL OR id = specific_transaction_id)
          AND is_shared = TRUE 
          AND mirror_transaction_id IS NULL -- Só as originais
          AND user_id = target_user_id -- Origem
    LOOP
        BEGIN
            -- Força o update "fake" para disparar a trigger de espelhamento novamente
            -- A trigger handle_transaction_mirroring_v4 cuidará de criar se não existir (Idempotência)
            UPDATE transactions 
            SET updated_at = NOW() 
            WHERE id = rec.id;
            
            count_processed := count_processed + 1;
        EXCEPTION WHEN OTHERS THEN
            count_errors := count_errors + 1;
            INSERT INTO system_logs (level, source, message, metadata)
            VALUES ('ERROR', 'rebuild_script', 'Falha ao reprocessar transação ' || rec.id, jsonb_build_object('error', SQLERRM));
        END;
    END LOOP;

    RETURN format('Reprocessamento concluído. Sucesso: %s. Erros: %s.', count_processed, count_errors);
END;
$$;
