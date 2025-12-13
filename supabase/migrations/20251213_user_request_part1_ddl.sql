-- 1. ADICIONAR COLUNAS DE CONTROLE (Se não existirem)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'mirror_transaction_id') THEN
        ALTER TABLE transactions ADD COLUMN mirror_transaction_id UUID UNIQUE DEFAULT NULL;
        CREATE INDEX idx_transactions_mirror_id ON transactions(mirror_transaction_id);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'connection_status') THEN
        ALTER TABLE family_members ADD COLUMN connection_status TEXT DEFAULT 'ACTIVE' CHECK (connection_status IN ('ACTIVE', 'BLOCKED', 'PAUSED'));
        ALTER TABLE family_members ADD COLUMN linked_user_id UUID DEFAULT NULL; -- Garantir que existe
    END IF;
END $$;
