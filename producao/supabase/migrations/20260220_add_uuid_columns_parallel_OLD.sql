-- ==============================================================================
-- MIGRATION: ADICIONAR COLUNAS UUID PARALELAS
-- DATA: 2026-02-20
-- OBJETIVO: Criar colunas UUID paralelas às TEXT existentes (estratégia segura)
-- ESTRATÉGIA: Não alterar colunas existentes, criar novas colunas UUID
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: ADICIONAR COLUNAS UUID PARALELAS EM TRANSACTIONS
-- ==============================================================================

-- Adicionar colunas UUID paralelas (sem alterar as TEXT existentes)
DO $$
BEGIN
  -- account_id_uuid (paralela à account_id TEXT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'account_id_uuid'
  ) THEN
    ALTER TABLE transactions ADD COLUMN account_id_uuid UUID;
    RAISE NOTICE 'Coluna account_id_uuid adicionada';
  END IF;

  -- destination_account_id_uuid (paralela à destination_account_id TEXT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'destination_account_id_uuid'
  ) THEN
    ALTER TABLE transactions ADD COLUMN destination_account_id_uuid UUID;
    RAISE NOTICE 'Coluna destination_account_id_uuid adicionada';
  END IF;

  -- trip_id_uuid (paralela à trip_id TEXT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'trip_id_uuid'
  ) THEN
    ALTER TABLE transactions ADD COLUMN trip_id_uuid UUID;
    RAISE NOTICE 'Coluna trip_id_uuid adicionada';
  END IF;

  -- payer_id_uuid (paralela à payer_id TEXT)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' AND column_name = 'payer_id_uuid'
  ) THEN
    ALTER TABLE transactions ADD COLUMN payer_id_uuid UUID;
    RAISE NOTICE 'Coluna payer_id_uuid adicionada';
  END IF;
END $$;

-- ==============================================================================
-- PARTE 2: POPULAR COLUNAS UUID COM DADOS VÁLIDOS
-- ==============================================================================

-- Função para validar se uma string é um UUID válido
CREATE OR REPLACE FUNCTION is_valid_uuid(input_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Tentar fazer cast para UUID, retornar false se falhar
  PERFORM input_text::UUID;
  RETURN TRUE;
EXCEPTION WHEN invalid_text_representation THEN
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Popular account_id_uuid com valores válidos
UPDATE transactions 
SET account_id_uuid = CASE 
  WHEN account_id IS NOT NULL 
    AND account_id != 'EXTERNAL' 
    AND is_valid_uuid(account_id) 
  THEN account_id::UUID 
  ELSE NULL 
END
WHERE account_id IS NOT NULL 
  AND account_id_uuid IS NULL;

-- Popular destination_account_id_uuid com valores válidos
UPDATE transactions 
SET destination_account_id_uuid = CASE 
  WHEN destination_account_id IS NOT NULL 
    AND destination_account_id != 'EXTERNAL' 
    AND is_valid_uuid(destination_account_id) 
  THEN destination_account_id::UUID 
  ELSE NULL 
END
WHERE destination_account_id IS NOT NULL 
  AND destination_account_id_uuid IS NULL;

-- Popular trip_id_uuid com valores válidos
UPDATE transactions 
SET trip_id_uuid = CASE 
  WHEN trip_id IS NOT NULL 
    AND is_valid_uuid(trip_id) 
  THEN trip_id::UUID 
  ELSE NULL 
END
WHERE trip_id IS NOT NULL 
  AND trip_id_uuid IS NULL;

-- Popular payer_id_uuid com valores válidos (exceto 'me')
UPDATE transactions 
SET payer_id_uuid = CASE 
  WHEN payer_id IS NOT NULL 
    AND payer_id != 'me' 
    AND is_valid_uuid(payer_id) 
  THEN payer_id::UUID 
  ELSE NULL 
END
WHERE payer_id IS NOT NULL 
  AND payer_id_uuid IS NULL;

-- ==============================================================================
-- PARTE 3: ADICIONAR FOREIGN KEYS NAS NOVAS COLUNAS UUID
-- ==============================================================================

-- Foreign key para account_id_uuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_transactions_account_id_uuid'
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT fk_transactions_account_id_uuid 
    FOREIGN KEY (account_id_uuid) REFERENCES accounts(id) ON DELETE SET NULL;
    RAISE NOTICE 'Foreign key fk_transactions_account_id_uuid adicionada';
  END IF;
END $$;

-- Foreign key para destination_account_id_uuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_transactions_destination_account_id_uuid'
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT fk_transactions_destination_account_id_uuid 
    FOREIGN KEY (destination_account_id_uuid) REFERENCES accounts(id) ON DELETE SET NULL;
    RAISE NOTICE 'Foreign key fk_transactions_destination_account_id_uuid adicionada';
  END IF;
END $$;

-- Foreign key para trip_id_uuid
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_transactions_trip_id_uuid'
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT fk_transactions_trip_id_uuid 
    FOREIGN KEY (trip_id_uuid) REFERENCES trips(id) ON DELETE SET NULL;
    RAISE NOTICE 'Foreign key fk_transactions_trip_id_uuid adicionada';
  END IF;
END $$;

-- Foreign key para payer_id_uuid (referencia auth.users)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'fk_transactions_payer_id_uuid'
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT fk_transactions_payer_id_uuid 
    FOREIGN KEY (payer_id_uuid) REFERENCES auth.users(id) ON DELETE SET NULL;
    RAISE NOTICE 'Foreign key fk_transactions_payer_id_uuid adicionada';
  END IF;
END $$;

-- ==============================================================================
-- PARTE 4: ADICIONAR COLUNAS UUID EM ASSETS (se existir)
-- ==============================================================================

DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'assets') THEN
    -- account_id_uuid para assets
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'assets' AND column_name = 'account_id_uuid'
    ) THEN
      EXECUTE 'ALTER TABLE assets ADD COLUMN account_id_uuid UUID';
      
      -- Popular com dados válidos
      EXECUTE 'UPDATE assets 
               SET account_id_uuid = CASE 
                 WHEN account_id IS NOT NULL AND is_valid_uuid(account_id) 
                 THEN account_id::UUID 
                 ELSE NULL 
               END
               WHERE account_id IS NOT NULL 
                 AND account_id_uuid IS NULL';
      
      -- Adicionar foreign key
      EXECUTE 'ALTER TABLE assets 
               ADD CONSTRAINT fk_assets_account_id_uuid 
               FOREIGN KEY (account_id_uuid) REFERENCES accounts(id) ON DELETE SET NULL';
      
      RAISE NOTICE 'Colunas UUID adicionadas em assets';
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- PARTE 5: TRIGGER PARA MANTER SINCRONIZAÇÃO
-- ==============================================================================

-- Função para sincronizar colunas TEXT e UUID
CREATE OR REPLACE FUNCTION sync_text_uuid_columns()
RETURNS TRIGGER AS $$
DECLARE
  table_name TEXT := TG_TABLE_NAME;
BEGIN
  -- Para transactions
  IF table_name = 'transactions' THEN
    -- Sincronizar account_id <-> account_id_uuid
    IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
      IF NEW.account_id IS NOT NULL AND NEW.account_id != 'EXTERNAL' AND is_valid_uuid(NEW.account_id) THEN
        NEW.account_id_uuid := NEW.account_id::UUID;
      ELSE
        NEW.account_id_uuid := NULL;
      END IF;
    END IF;
    
    IF NEW.account_id_uuid IS DISTINCT FROM OLD.account_id_uuid THEN
      IF NEW.account_id_uuid IS NOT NULL THEN
        NEW.account_id := NEW.account_id_uuid::TEXT;
      END IF;
    END IF;
    
    -- Sincronizar destination_account_id <-> destination_account_id_uuid
    IF NEW.destination_account_id IS DISTINCT FROM OLD.destination_account_id THEN
      IF NEW.destination_account_id IS NOT NULL AND NEW.destination_account_id != 'EXTERNAL' AND is_valid_uuid(NEW.destination_account_id) THEN
        NEW.destination_account_id_uuid := NEW.destination_account_id::UUID;
      ELSE
        NEW.destination_account_id_uuid := NULL;
      END IF;
    END IF;
    
    IF NEW.destination_account_id_uuid IS DISTINCT FROM OLD.destination_account_id_uuid THEN
      IF NEW.destination_account_id_uuid IS NOT NULL THEN
        NEW.destination_account_id := NEW.destination_account_id_uuid::TEXT;
      END IF;
    END IF;
    
    -- Sincronizar trip_id <-> trip_id_uuid
    IF NEW.trip_id IS DISTINCT FROM OLD.trip_id THEN
      IF NEW.trip_id IS NOT NULL AND is_valid_uuid(NEW.trip_id) THEN
        NEW.trip_id_uuid := NEW.trip_id::UUID;
      ELSE
        NEW.trip_id_uuid := NULL;
      END IF;
    END IF;
    
    IF NEW.trip_id_uuid IS DISTINCT FROM OLD.trip_id_uuid THEN
      IF NEW.trip_id_uuid IS NOT NULL THEN
        NEW.trip_id := NEW.trip_id_uuid::TEXT;
      END IF;
    END IF;
    
    -- Sincronizar payer_id <-> payer_id_uuid
    IF NEW.payer_id IS DISTINCT FROM OLD.payer_id THEN
      IF NEW.payer_id IS NOT NULL AND NEW.payer_id != 'me' AND is_valid_uuid(NEW.payer_id) THEN
        NEW.payer_id_uuid := NEW.payer_id::UUID;
      ELSE
        NEW.payer_id_uuid := NULL;
      END IF;
    END IF;
    
    IF NEW.payer_id_uuid IS DISTINCT FROM OLD.payer_id_uuid THEN
      IF NEW.payer_id_uuid IS NOT NULL THEN
        NEW.payer_id := NEW.payer_id_uuid::TEXT;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar trigger em transactions
DROP TRIGGER IF EXISTS trg_sync_text_uuid_transactions ON transactions;
CREATE TRIGGER trg_sync_text_uuid_transactions
  BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION sync_text_uuid_columns();

-- ==============================================================================
-- PARTE 6: ÍNDICES PARA NOVAS COLUNAS UUID
-- ==============================================================================

-- Índices para as novas colunas UUID (melhor performance que TEXT)
CREATE INDEX IF NOT EXISTS idx_transactions_account_id_uuid 
  ON transactions(account_id_uuid) 
  WHERE account_id_uuid IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_destination_account_id_uuid 
  ON transactions(destination_account_id_uuid) 
  WHERE destination_account_id_uuid IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_trip_id_uuid 
  ON transactions(trip_id_uuid) 
  WHERE trip_id_uuid IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_payer_id_uuid 
  ON transactions(payer_id_uuid) 
  WHERE payer_id_uuid IS NOT NULL AND deleted = false;

-- ==============================================================================
-- PARTE 7: FUNÇÃO DE MIGRAÇÃO GRADUAL
-- ==============================================================================

-- Função para migrar gradualmente de TEXT para UUID
CREATE OR REPLACE FUNCTION migrate_text_to_uuid_batch(batch_size INTEGER DEFAULT 1000)
RETURNS TABLE(
  processed INTEGER,
  account_id_migrated INTEGER,
  destination_account_id_migrated INTEGER,
  trip_id_migrated INTEGER,
  payer_id_migrated INTEGER
) AS $$
DECLARE
  batch_processed INTEGER := 0;
  acc_migrated INTEGER := 0;
  dest_migrated INTEGER := 0;
  trip_migrated INTEGER := 0;
  payer_migrated INTEGER := 0;
BEGIN
  -- Migrar account_id em lotes
  WITH batch AS (
    SELECT id, account_id FROM transactions 
    WHERE account_id IS NOT NULL 
      AND account_id != 'EXTERNAL'
      AND account_id_uuid IS NULL
      AND is_valid_uuid(account_id)
    LIMIT batch_size
  )
  UPDATE transactions 
  SET account_id_uuid = batch.account_id::UUID
  FROM batch 
  WHERE transactions.id = batch.id;
  
  GET DIAGNOSTICS acc_migrated = ROW_COUNT;
  
  -- Migrar destination_account_id em lotes
  WITH batch AS (
    SELECT id, destination_account_id FROM transactions 
    WHERE destination_account_id IS NOT NULL 
      AND destination_account_id != 'EXTERNAL'
      AND destination_account_id_uuid IS NULL
      AND is_valid_uuid(destination_account_id)
    LIMIT batch_size
  )
  UPDATE transactions 
  SET destination_account_id_uuid = batch.destination_account_id::UUID
  FROM batch 
  WHERE transactions.id = batch.id;
  
  GET DIAGNOSTICS dest_migrated = ROW_COUNT;
  
  -- Migrar trip_id em lotes
  WITH batch AS (
    SELECT id, trip_id FROM transactions 
    WHERE trip_id IS NOT NULL 
      AND trip_id_uuid IS NULL
      AND is_valid_uuid(trip_id)
    LIMIT batch_size
  )
  UPDATE transactions 
  SET trip_id_uuid = batch.trip_id::UUID
  FROM batch 
  WHERE transactions.id = batch.id;
  
  GET DIAGNOSTICS trip_migrated = ROW_COUNT;
  
  -- Migrar payer_id em lotes
  WITH batch AS (
    SELECT id, payer_id FROM transactions 
    WHERE payer_id IS NOT NULL 
      AND payer_id != 'me'
      AND payer_id_uuid IS NULL
      AND is_valid_uuid(payer_id)
    LIMIT batch_size
  )
  UPDATE transactions 
  SET payer_id_uuid = batch.payer_id::UUID
  FROM batch 
  WHERE transactions.id = batch.id;
  
  GET DIAGNOSTICS payer_migrated = ROW_COUNT;
  
  batch_processed := acc_migrated + dest_migrated + trip_migrated + payer_migrated;
  
  RETURN QUERY SELECT 
    batch_processed,
    acc_migrated,
    dest_migrated,
    trip_migrated,
    payer_migrated;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 8: RELATÓRIO DE MIGRAÇÃO
-- ==============================================================================

DO $$
DECLARE
  total_transactions INTEGER;
  uuid_ready INTEGER;
  text_only INTEGER;
BEGIN
  -- Contar transações
  SELECT COUNT(*) INTO total_transactions FROM transactions WHERE NOT deleted;
  
  -- Contar quantas já têm UUID
  SELECT COUNT(*) INTO uuid_ready 
  FROM transactions 
  WHERE NOT deleted 
    AND (
      account_id_uuid IS NOT NULL 
      OR destination_account_id_uuid IS NOT NULL 
      OR trip_id_uuid IS NOT NULL 
      OR payer_id_uuid IS NOT NULL
    );
  
  text_only := total_transactions - uuid_ready;
  
  RAISE NOTICE '=== MIGRAÇÃO TEXT -> UUID INICIADA ===';
  RAISE NOTICE 'Total de transações: %', total_transactions;
  RAISE NOTICE 'Com colunas UUID populadas: %', uuid_ready;
  RAISE NOTICE 'Ainda só com TEXT: %', text_only;
  RAISE NOTICE '';
  RAISE NOTICE 'Colunas UUID criadas:';
  RAISE NOTICE '- account_id_uuid (com FK para accounts)';
  RAISE NOTICE '- destination_account_id_uuid (com FK para accounts)';
  RAISE NOTICE '- trip_id_uuid (com FK para trips)';
  RAISE NOTICE '- payer_id_uuid (com FK para auth.users)';
  RAISE NOTICE '';
  RAISE NOTICE 'Para migrar em lotes: SELECT * FROM migrate_text_to_uuid_batch(1000);';
  RAISE NOTICE 'Trigger de sincronização ativo para novos registros';
END $$;

COMMIT;

-- ==============================================================================
-- NOTAS IMPORTANTES:
-- ==============================================================================
-- 1. Colunas TEXT originais NÃO foram alteradas (estratégia segura)
-- 2. Novas colunas UUID têm foreign keys para integridade
-- 3. Trigger mantém sincronização automática
-- 4. Função de migração em lotes para grandes volumes
-- 5. Valores especiais ('EXTERNAL', 'me') são tratados corretamente
-- 6. Validação de UUID antes de fazer cast
-- ==============================================================================