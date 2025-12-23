-- ==============================================================================
-- MIGRATION: CORRIGIR assets.account_id (TEXT -> UUID)
-- DATA: 2026-01-29
-- DESCRIÇÃO: Converte assets.account_id de TEXT para UUID e adiciona FK
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. VERIFICAR DADOS EXISTENTES
-- ==============================================================================

DO $$ 
DECLARE
  invalid_count INTEGER;
  null_count INTEGER;
BEGIN
  -- Contar valores inválidos
  SELECT COUNT(*) INTO invalid_count
  FROM assets
  WHERE account_id IS NOT NULL 
    AND account_id != ''
    AND account_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  
  -- Contar valores NULL
  SELECT COUNT(*) INTO null_count
  FROM assets
  WHERE account_id IS NULL OR account_id = '';
  
  IF invalid_count > 0 THEN
    RAISE WARNING 'Encontrados % registros com account_id inválido. Serão definidos como NULL.', invalid_count;
  END IF;
  
  IF null_count > 0 THEN
    RAISE NOTICE 'Encontrados % registros com account_id NULL (serão mantidos como NULL).', null_count;
  END IF;
END $$;

-- ==============================================================================
-- 2. LIMPAR DADOS INVÁLIDOS
-- ==============================================================================

-- Definir como NULL valores inválidos
UPDATE assets
SET account_id = NULL
WHERE account_id IS NOT NULL 
  AND account_id != ''
  AND account_id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

-- Limpar strings vazias
UPDATE assets
SET account_id = NULL
WHERE account_id = '';

-- ==============================================================================
-- 3. VERIFICAR SE EXISTEM REFERÊNCIAS VÁLIDAS
-- ==============================================================================

DO $$ 
DECLARE
  orphan_count INTEGER;
BEGIN
  -- Contar assets com account_id que não existe em accounts
  SELECT COUNT(*) INTO orphan_count
  FROM assets a
  WHERE a.account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM accounts acc 
      WHERE acc.id::text = a.account_id
    );
  
  IF orphan_count > 0 THEN
    RAISE WARNING 'Encontrados % assets com account_id que não existe em accounts. Serão definidos como NULL.', orphan_count;
    
    -- Limpar referências órfãs
    UPDATE assets a
    SET account_id = NULL
    WHERE a.account_id IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM accounts acc 
        WHERE acc.id::text = a.account_id
      );
  END IF;
END $$;

-- ==============================================================================
-- 4. CONVERTER COLUNA PARA UUID
-- ==============================================================================

-- Verificar se a coluna já é UUID
DO $$ 
BEGIN
  IF EXISTS (
    SELECT 1 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
      AND table_name = 'assets' 
      AND column_name = 'account_id' 
      AND data_type = 'uuid'
  ) THEN
    RAISE NOTICE 'Coluna assets.account_id já é UUID. Pulando conversão.';
  ELSE
    -- Converter TEXT para UUID
    ALTER TABLE assets
      ALTER COLUMN account_id TYPE UUID 
      USING CASE 
        WHEN account_id IS NULL OR account_id = '' THEN NULL
        WHEN account_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' 
          THEN account_id::uuid
        ELSE NULL
      END;
    
    RAISE NOTICE 'Coluna assets.account_id convertida para UUID.';
  END IF;
END $$;

-- ==============================================================================
-- 5. ADICIONAR FOREIGN KEY
-- ==============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'fk_assets_account' 
      AND conrelid = 'assets'::regclass
  ) THEN
    ALTER TABLE assets
      ADD CONSTRAINT fk_assets_account
      FOREIGN KEY (account_id) 
      REFERENCES accounts(id)
      ON DELETE SET NULL; -- Se conta for deletada, asset fica sem conta
    
    RAISE NOTICE 'Foreign key fk_assets_account adicionada.';
  ELSE
    RAISE NOTICE 'Foreign key fk_assets_account já existe.';
  END IF;
END $$;

-- ==============================================================================
-- 6. CRIAR ÍNDICE PARA PERFORMANCE
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_assets_account_id 
  ON assets(account_id) 
  WHERE account_id IS NOT NULL;

-- ==============================================================================
-- 7. VALIDAÇÃO FINAL
-- ==============================================================================

DO $$ 
DECLARE
  total_assets INTEGER;
  assets_with_account INTEGER;
  assets_without_account INTEGER;
BEGIN
  SELECT COUNT(*) INTO total_assets FROM assets;
  SELECT COUNT(*) INTO assets_with_account FROM assets WHERE account_id IS NOT NULL;
  SELECT COUNT(*) INTO assets_without_account FROM assets WHERE account_id IS NULL;
  
  RAISE NOTICE '✅ MIGRATION CONCLUÍDA:';
  RAISE NOTICE '   Total de assets: %', total_assets;
  RAISE NOTICE '   Assets com conta: %', assets_with_account;
  RAISE NOTICE '   Assets sem conta: %', assets_without_account;
END $$;

COMMIT;

