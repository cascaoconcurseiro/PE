-- ==============================================================================
-- MIGRATION: ADICIONAR COLUNAS UUID PARALELAS (VERSÃO SEGURA)
-- DATA: 2026-02-20
-- OBJETIVO: Criar colunas UUID paralelas às TEXT existentes (estratégia ultra-segura)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: FUNÇÃO DE VALIDAÇÃO UUID (MAIS ROBUSTA)
-- ==============================================================================

-- Função para validar UUID de forma mais robusta
CREATE OR REPLACE FUNCTION is_valid_uuid_safe(input_text TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  -- Verificar se é NULL ou vazio
  IF input_text IS NULL OR input_text = '' THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se tem o formato básico de UUID (36 caracteres com hífens)
  IF LENGTH(input_text) != 36 THEN
    RETURN FALSE;
  END IF;
  
  -- Verificar se não é um valor especial conhecido
  IF input_text IN ('EXTERNAL', 'me', 'null', 'undefined') THEN
    RETURN FALSE;
  END IF;
  
  -- Tentar fazer cast para UUID
  BEGIN
    PERFORM input_text::UUID;
    RETURN TRUE;
  EXCEPTION WHEN OTHERS THEN
    RETURN FALSE;
  END;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ==============================================================================
-- PARTE 2: ADICIONAR COLUNAS UUID PARALELAS
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
-- PARTE 3: POPULAR COLUNAS UUID DE FORMA ULTRA-SEGURA
-- ==============================================================================

-- Popular account_id_uuid (abordagem mais segura)
DO $$
DECLARE
  rec RECORD;
  converted_count INTEGER := 0;
BEGIN
  FOR rec IN 
    SELECT id, account_id 
    FROM transactions 
    WHERE account_id IS NOT NULL 
      AND account_id_uuid IS NULL
      AND char_length(account_id::TEXT) = 36  -- Usar char_length e cast explícito
  LOOP
    -- Tentar converter cada registro individualmente
    BEGIN
      IF is_valid_uuid_safe(rec.account_id::TEXT) THEN
        UPDATE transactions 
        SET account_id_uuid = rec.account_id::UUID 
        WHERE id = rec.id;
        converted_count := converted_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- Ignorar erros individuais e continuar
      RAISE NOTICE 'Erro ao converter account_id: % para UUID', rec.account_id;
    END;
  END LOOP;
  
  RAISE NOTICE 'account_id_uuid: % registros convertidos', converted_count;
END $$;

-- Popular destination_account_id_uuid
DO $$
DECLARE
  rec RECORD;
  converted_count INTEGER := 0;
BEGIN
  FOR rec IN 
    SELECT id, destination_account_id 
    FROM transactions 
    WHERE destination_account_id IS NOT NULL 
      AND destination_account_id_uuid IS NULL
      AND char_length(destination_account_id::TEXT) = 36
  LOOP
    BEGIN
      IF is_valid_uuid_safe(rec.destination_account_id::TEXT) THEN
        UPDATE transactions 
        SET destination_account_id_uuid = rec.destination_account_id::UUID 
        WHERE id = rec.id;
        converted_count := converted_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao converter destination_account_id: % para UUID', rec.destination_account_id;
    END;
  END LOOP;
  
  RAISE NOTICE 'destination_account_id_uuid: % registros convertidos', converted_count;
END $$;

-- Popular trip_id_uuid
DO $$
DECLARE
  rec RECORD;
  converted_count INTEGER := 0;
BEGIN
  FOR rec IN 
    SELECT id, trip_id 
    FROM transactions 
    WHERE trip_id IS NOT NULL 
      AND trip_id_uuid IS NULL
      AND char_length(trip_id::TEXT) = 36
  LOOP
    BEGIN
      IF is_valid_uuid_safe(rec.trip_id::TEXT) THEN
        UPDATE transactions 
        SET trip_id_uuid = rec.trip_id::UUID 
        WHERE id = rec.id;
        converted_count := converted_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao converter trip_id: % para UUID', rec.trip_id;
    END;
  END LOOP;
  
  RAISE NOTICE 'trip_id_uuid: % registros convertidos', converted_count;
END $$;

-- Popular payer_id_uuid
DO $$
DECLARE
  rec RECORD;
  converted_count INTEGER := 0;
BEGIN
  FOR rec IN 
    SELECT id, payer_id 
    FROM transactions 
    WHERE payer_id IS NOT NULL 
      AND payer_id_uuid IS NULL
      AND char_length(payer_id::TEXT) = 36
      AND payer_id != 'me'  -- Excluir valor especial
  LOOP
    BEGIN
      IF is_valid_uuid_safe(rec.payer_id::TEXT) THEN
        UPDATE transactions 
        SET payer_id_uuid = rec.payer_id::UUID 
        WHERE id = rec.id;
        converted_count := converted_count + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Erro ao converter payer_id: % para UUID', rec.payer_id;
    END;
  END LOOP;
  
  RAISE NOTICE 'payer_id_uuid: % registros convertidos', converted_count;
END $$;

-- ==============================================================================
-- PARTE 4: ADICIONAR FOREIGN KEYS (APENAS SE CONVERSÃO FOI BEM-SUCEDIDA)
-- ==============================================================================

-- Foreign key para account_id_uuid
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE account_id_uuid IS NOT NULL LIMIT 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'fk_transactions_account_id_uuid'
    ) THEN
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_account_id_uuid 
      FOREIGN KEY (account_id_uuid) REFERENCES accounts(id) ON DELETE SET NULL;
      RAISE NOTICE 'Foreign key fk_transactions_account_id_uuid adicionada';
    END IF;
  END IF;
END $$;

-- Foreign key para destination_account_id_uuid
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE destination_account_id_uuid IS NOT NULL LIMIT 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'fk_transactions_destination_account_id_uuid'
    ) THEN
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_destination_account_id_uuid 
      FOREIGN KEY (destination_account_id_uuid) REFERENCES accounts(id) ON DELETE SET NULL;
      RAISE NOTICE 'Foreign key fk_transactions_destination_account_id_uuid adicionada';
    END IF;
  END IF;
END $$;

-- Foreign key para trip_id_uuid
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE trip_id_uuid IS NOT NULL LIMIT 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'fk_transactions_trip_id_uuid'
    ) THEN
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_trip_id_uuid 
      FOREIGN KEY (trip_id_uuid) REFERENCES trips(id) ON DELETE SET NULL;
      RAISE NOTICE 'Foreign key fk_transactions_trip_id_uuid adicionada';
    END IF;
  END IF;
END $$;

-- Foreign key para payer_id_uuid
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM transactions WHERE payer_id_uuid IS NOT NULL LIMIT 1) THEN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'fk_transactions_payer_id_uuid'
    ) THEN
      ALTER TABLE transactions 
      ADD CONSTRAINT fk_transactions_payer_id_uuid 
      FOREIGN KEY (payer_id_uuid) REFERENCES auth.users(id) ON DELETE SET NULL;
      RAISE NOTICE 'Foreign key fk_transactions_payer_id_uuid adicionada';
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- PARTE 5: ÍNDICES PARA NOVAS COLUNAS UUID
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
-- PARTE 6: RELATÓRIO FINAL
-- ==============================================================================

DO $$
DECLARE
  total_transactions INTEGER;
  account_uuid_count INTEGER;
  dest_uuid_count INTEGER;
  trip_uuid_count INTEGER;
  payer_uuid_count INTEGER;
BEGIN
  -- Contar transações
  SELECT COUNT(*) INTO total_transactions FROM transactions WHERE NOT deleted;
  
  -- Contar UUIDs populados
  SELECT COUNT(*) INTO account_uuid_count FROM transactions WHERE account_id_uuid IS NOT NULL;
  SELECT COUNT(*) INTO dest_uuid_count FROM transactions WHERE destination_account_id_uuid IS NOT NULL;
  SELECT COUNT(*) INTO trip_uuid_count FROM transactions WHERE trip_id_uuid IS NOT NULL;
  SELECT COUNT(*) INTO payer_uuid_count FROM transactions WHERE payer_id_uuid IS NOT NULL;
  
  RAISE NOTICE '=== MIGRAÇÃO UUID CONCLUÍDA (VERSÃO SEGURA) ===';
  RAISE NOTICE 'Total de transações: %', total_transactions;
  RAISE NOTICE 'account_id_uuid populados: %', account_uuid_count;
  RAISE NOTICE 'destination_account_id_uuid populados: %', dest_uuid_count;
  RAISE NOTICE 'trip_id_uuid populados: %', trip_uuid_count;
  RAISE NOTICE 'payer_id_uuid populados: %', payer_uuid_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Colunas TEXT originais mantidas intactas';
  RAISE NOTICE 'Foreign keys adicionadas onde aplicável';
  RAISE NOTICE 'Índices criados para performance';
END $$;

COMMIT;

-- ==============================================================================
-- NOTAS DA VERSÃO SEGURA:
-- ==============================================================================
-- 1. Conversão registro por registro com tratamento de erro individual
-- 2. Pré-filtro por tamanho (36 caracteres) antes de tentar conversão
-- 3. Função de validação mais robusta
-- 4. Foreign keys só são adicionadas se há dados convertidos
-- 5. Relatório detalhado do que foi convertido
-- 6. Rollback completo disponível em caso de problemas
-- ==============================================================================
