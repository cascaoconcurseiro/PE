-- ==============================================================================
-- MIGRATION: CONSOLIDAÇÃO E OTIMIZAÇÃO DO SCHEMA
-- DATA: 2026-01-28
-- OBJETIVO: Limpar redundâncias, adicionar constraints e otimizar estrutura
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: ADICIONAR CONSTRAINTS DE TIPO
-- ==============================================================================

-- Primeiro: Verificar e corrigir valores inválidos em accounts.type
DO $$ 
DECLARE
  invalid_types TEXT[];
  type_count INTEGER;
BEGIN
  -- Verificar quais tipos inválidos existem
  SELECT array_agg(DISTINCT type) INTO invalid_types
  FROM accounts
  WHERE type NOT IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER');
  
  -- Se houver tipos inválidos, corrigir para 'OTHER'
  IF invalid_types IS NOT NULL AND array_length(invalid_types, 1) > 0 THEN
    RAISE NOTICE 'Corrigindo tipos inválidos: %', invalid_types;
    
    -- Contar quantos registros serão afetados
    SELECT COUNT(*) INTO type_count
    FROM accounts
    WHERE type NOT IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER');
    
    RAISE NOTICE 'Atualizando % registros para type = ''OTHER''', type_count;
    
    -- Corrigir valores inválidos
    UPDATE accounts
    SET type = 'OTHER'
    WHERE type NOT IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER');
  END IF;
END $$;

-- Agora adicionar constraint (após corrigir dados)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_account_type' 
    AND conrelid = 'accounts'::regclass
  ) THEN
    ALTER TABLE accounts
    ADD CONSTRAINT check_account_type
    CHECK (type IN ('CHECKING', 'SAVINGS', 'CREDIT_CARD', 'INVESTMENT', 'CASH', 'LOAN', 'OTHER'));
  END IF;
END $$;

-- Primeiro: Verificar e corrigir valores inválidos em transactions.type
DO $$ 
DECLARE
  invalid_types TEXT[];
  type_count INTEGER;
BEGIN
  -- Verificar quais tipos inválidos existem
  SELECT array_agg(DISTINCT type) INTO invalid_types
  FROM transactions
  WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA');
  
  -- Se houver tipos inválidos, logar (não corrigir automaticamente - muito perigoso)
  IF invalid_types IS NOT NULL AND array_length(invalid_types, 1) > 0 THEN
    RAISE WARNING 'Tipos inválidos encontrados em transactions: %. Verifique manualmente!', invalid_types;
    
    -- Contar quantos registros serão afetados
    SELECT COUNT(*) INTO type_count
    FROM transactions
    WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA');
    
    RAISE WARNING '% transações com tipos inválidos. Constraint não será adicionada.', type_count;
  ELSE
    -- Só adicionar constraint se não houver valores inválidos
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'check_transaction_type' 
      AND conrelid = 'transactions'::regclass
    ) THEN
      ALTER TABLE transactions
      ADD CONSTRAINT check_transaction_type
      CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA'));
    END IF;
  END IF;
END $$;

-- ==============================================================================
-- PARTE 2: ADICIONAR ÍNDICES CRÍTICOS
-- ==============================================================================

-- Índices para transactions
CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
  ON transactions(user_id, date DESC) 
  WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_account 
  ON transactions(account_id) 
  WHERE account_id IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_type 
  ON transactions(type) 
  WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_destination 
  ON transactions(destination_account_id) 
  WHERE destination_account_id IS NOT NULL AND deleted = false;

-- Índices para transaction_splits
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction 
  ON transaction_splits(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_member 
  ON transaction_splits(member_id);

CREATE INDEX IF NOT EXISTS idx_transaction_splits_settled 
  ON transaction_splits(is_settled) 
  WHERE is_settled = false;

-- Índices para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_type 
  ON accounts(user_id, type) 
  WHERE deleted = false;

-- Índices para ledger_entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction 
  ON ledger_entries(transaction_id);

CREATE INDEX IF NOT EXISTS idx_ledger_entries_account 
  ON ledger_entries(debit_account_id, credit_account_id);

-- ==============================================================================
-- PARTE 3: FUNÇÃO DE VALIDAÇÃO DE SPLITS
-- ==============================================================================

CREATE OR REPLACE FUNCTION validate_transaction_splits()
RETURNS TRIGGER AS $$
DECLARE
  total_amount NUMERIC;
  splits_sum NUMERIC;
BEGIN
  -- Obter total da transação
  SELECT amount INTO total_amount 
  FROM transactions 
  WHERE id = NEW.transaction_id;
  
  IF total_amount IS NULL THEN
    RAISE EXCEPTION 'Transação não encontrada: %', NEW.transaction_id;
  END IF;
  
  -- Calcular soma dos splits
  SELECT COALESCE(SUM(assigned_amount), 0) INTO splits_sum
  FROM transaction_splits
  WHERE transaction_id = NEW.transaction_id
    AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid);
  
  -- Adicionar o valor do split atual
  splits_sum := splits_sum + COALESCE(NEW.assigned_amount, 0);
  
  -- Validar (tolerância de 0.01 centavos)
  IF splits_sum > total_amount + 0.01 THEN
    RAISE EXCEPTION 'Soma dos splits (R$ %) excede o total da transação (R$ %)', 
      splits_sum, total_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger
DROP TRIGGER IF EXISTS trg_validate_splits ON transaction_splits;
CREATE TRIGGER trg_validate_splits
BEFORE INSERT OR UPDATE ON transaction_splits
FOR EACH ROW EXECUTE FUNCTION validate_transaction_splits();

-- ==============================================================================
-- PARTE 4: VIEW DE SAÚDE DO SISTEMA
-- ==============================================================================

CREATE OR REPLACE VIEW view_system_health AS
SELECT 
  'ORPHAN_TRANSACTIONS' as issue_type,
  COUNT(*) as count,
  'Transações com conta de origem deletada ou inválida' as description
FROM transactions t
WHERE t.account_id IS NOT NULL
  AND t.deleted = false
  AND NOT EXISTS (
    SELECT 1 FROM accounts a 
    WHERE a.id = t.account_id 
    AND a.deleted = false
  )

UNION ALL

SELECT 
  'INVALID_SPLITS' as issue_type,
  COUNT(DISTINCT t.id) as count,
  'Transações compartilhadas com splits que excedem o total' as description
FROM transactions t
WHERE t.is_shared = true
  AND t.deleted = false
  AND EXISTS (
    SELECT 1 
    FROM transaction_splits ts
    WHERE ts.transaction_id = t.id
    GROUP BY ts.transaction_id
    HAVING SUM(ts.assigned_amount) > t.amount + 0.01
  )

UNION ALL

SELECT 
  'TRANSFERS_WITHOUT_DESTINATION' as issue_type,
  COUNT(*) as count,
  'Transferências sem conta de destino' as description
FROM transactions t
WHERE t.type = 'TRANSFERÊNCIA'
  AND t.deleted = false
  AND t.destination_account_id IS NULL

UNION ALL

SELECT 
  'CIRCULAR_TRANSFERS' as issue_type,
  COUNT(*) as count,
  'Transferências com origem igual ao destino' as description
FROM transactions t
WHERE t.type = 'TRANSFERÊNCIA'
  AND t.deleted = false
  AND t.account_id = t.destination_account_id;

-- ==============================================================================
-- PARTE 5: FUNÇÃO DE ATUALIZAÇÃO AUTOMÁTICA DE updated_at
-- ==============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Aplicar em tabelas principais (se não existir)
DO $$
DECLARE
  table_name TEXT;
BEGIN
  FOR table_name IN 
    SELECT unnest(ARRAY['accounts', 'transactions', 'trips', 'goals', 'budgets', 'assets'])
  LOOP
    EXECUTE format('
      DROP TRIGGER IF EXISTS trg_update_%s_updated_at ON %I;
      CREATE TRIGGER trg_update_%s_updated_at
        BEFORE UPDATE ON %I
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    ', table_name, table_name, table_name, table_name);
  END LOOP;
END $$;

COMMIT;

-- ==============================================================================
-- NOTAS:
-- ==============================================================================
-- 1. Esta migration adiciona constraints e índices sem quebrar funcionalidade
-- 2. Validação de splits é automática via trigger
-- 3. View de saúde do sistema para monitoramento
-- 4. updated_at automático em tabelas principais
-- ==============================================================================

