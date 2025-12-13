-- ==============================================================================
-- MIGRATION: SHARED TRANSACTION MIRRORING & CONNECTION LIFECYCLE (DDL)
-- DATA: 2025-12-13
-- DESCRIÇÃO: Adiciona colunas e índices para suportar o espelhamento financeiro
-- ==============================================================================

-- 1. TRANSACTIONS: Adicionar Coluna de Espelhamento (Loop Breaker)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'mirror_transaction_id') THEN
        ALTER TABLE transactions 
        ADD COLUMN mirror_transaction_id UUID UNIQUE DEFAULT NULL;
        
        -- Comentário explicativo no banco
        COMMENT ON COLUMN transactions.mirror_transaction_id IS 'ID da transação original que gerou esta cópia (Shadow Transaction). Se preenchido, esta transação é read-only para valores financeiros.';
    END IF;
END $$;

-- 2. TRANSACTIONS: Índice de Performance para Espelhamento
CREATE INDEX IF NOT EXISTS idx_transactions_mirror_id 
ON transactions(mirror_transaction_id);

-- 3. FAMILY_MEMBERS: Adicionar Status de Conexão (Offboarding)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'connection_status') THEN
        ALTER TABLE family_members 
        ADD COLUMN connection_status TEXT DEFAULT 'ACTIVE' 
        CHECK (connection_status IN ('ACTIVE', 'BLOCKED', 'PAUSED'));
        
        COMMENT ON COLUMN family_members.connection_status IS 'Controla se o espelhamento de novas transações é permitido para este membro.';
    END IF;

    -- Garantir que linked_user_id existe (Requisito de Identidade)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'linked_user_id') THEN
        ALTER TABLE family_members 
        ADD COLUMN linked_user_id UUID DEFAULT NULL;
    END IF;
END $$;

-- 4. FAMILY_MEMBERS: Índice para busca rápida de conexões
CREATE INDEX IF NOT EXISTS idx_family_linked_user 
ON family_members(linked_user_id);

CREATE INDEX IF NOT EXISTS idx_family_email 
ON family_members(email);
