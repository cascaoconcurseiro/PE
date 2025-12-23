-- ==============================================================================
-- MIGRATION: CONSTRAINTS E AUDITORIA FINANCEIRA
-- DATA: 2026-01-28
-- OBJETIVO: Adicionar constraints críticas e sistema de auditoria
--           Para tornar o sistema financeiro profissional e confiável
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: CONSTRAINTS CRÍTICAS DE INTEGRIDADE
-- ==============================================================================

-- PostgreSQL não suporta IF NOT EXISTS com ADD CONSTRAINT
-- Usar DO block para verificar antes de adicionar

DO $$ 
BEGIN
  -- 1. Garantir que valores sejam sempre positivos
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_amount_positive' 
    AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT check_amount_positive 
    CHECK (amount > 0);
  END IF;

  -- 2. Garantir que transferências tenham destino
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_transfer_has_destination' 
    AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT check_transfer_has_destination 
    CHECK (
      type != 'TRANSFERÊNCIA' OR 
      (type = 'TRANSFERÊNCIA' AND destination_account_id IS NOT NULL)
    );
  END IF;

  -- 3. Garantir que transferências não sejam circulares
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_transfer_not_same_account' 
    AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT check_transfer_not_same_account 
    CHECK (
      type != 'TRANSFERÊNCIA' OR 
      account_id != destination_account_id
    );
  END IF;

  -- 4. Garantir que parcelas sejam consistentes
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'check_installment_consistency' 
    AND conrelid = 'transactions'::regclass
  ) THEN
    ALTER TABLE transactions 
    ADD CONSTRAINT check_installment_consistency 
    CHECK (
      (is_installment = false) OR 
      (is_installment = true AND total_installments > 0 AND current_installment > 0 AND current_installment <= total_installments)
    );
  END IF;
END $$;

-- 5. Garantir que splits não excedam o total
-- (Validação complexa, fazer via trigger)

-- ==============================================================================
-- PARTE 2: TABELA DE AUDITORIA
-- ==============================================================================

CREATE TABLE IF NOT EXISTS transaction_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID REFERENCES transactions(id) ON DELETE SET NULL,
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL CHECK (action IN ('CREATE', 'UPDATE', 'DELETE')),
  old_values JSONB,
  new_values JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_transaction_audit_transaction_id 
ON transaction_audit(transaction_id);

CREATE INDEX IF NOT EXISTS idx_transaction_audit_user_id 
ON transaction_audit(user_id);

CREATE INDEX IF NOT EXISTS idx_transaction_audit_created_at 
ON transaction_audit(created_at DESC);

-- ==============================================================================
-- PARTE 3: FUNÇÃO DE AUDITORIA
-- ==============================================================================

CREATE OR REPLACE FUNCTION audit_transaction_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_ip_address INET;
  v_user_agent TEXT;
BEGIN
  -- Obter informações do usuário
  v_user_id := auth.uid();
  
  -- Tentar obter IP e User-Agent (se disponível via headers)
  -- Nota: Supabase não expõe headers diretamente, mas podemos tentar
  -- v_ip_address := current_setting('request.headers', true)::json->>'x-forwarded-for';
  
  IF (TG_OP = 'DELETE') THEN
    INSERT INTO transaction_audit (
      transaction_id, 
      user_id, 
      action, 
      old_values
    ) VALUES (
      OLD.id, 
      COALESCE(v_user_id, OLD.user_id), 
      'DELETE', 
      row_to_json(OLD)
    );
    RETURN OLD;
    
  ELSIF (TG_OP = 'UPDATE') THEN
    INSERT INTO transaction_audit (
      transaction_id, 
      user_id, 
      action, 
      old_values, 
      new_values
    ) VALUES (
      NEW.id, 
      COALESCE(v_user_id, NEW.user_id), 
      'UPDATE', 
      row_to_json(OLD), 
      row_to_json(NEW)
    );
    RETURN NEW;
    
  ELSIF (TG_OP = 'INSERT') THEN
    INSERT INTO transaction_audit (
      transaction_id, 
      user_id, 
      action, 
      new_values
    ) VALUES (
      NEW.id, 
      COALESCE(v_user_id, NEW.user_id), 
      'CREATE', 
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger de auditoria
DROP TRIGGER IF EXISTS trg_audit_transactions ON transactions;
CREATE TRIGGER trg_audit_transactions
AFTER INSERT OR UPDATE OR DELETE ON transactions
FOR EACH ROW EXECUTE FUNCTION audit_transaction_changes();

-- ==============================================================================
-- PARTE 4: FUNÇÃO DE VALIDAÇÃO DE REGRAS DE NEGÓCIO
-- ==============================================================================

CREATE OR REPLACE FUNCTION validate_transaction_rules(
  p_type TEXT,
  p_amount NUMERIC,
  p_account_id UUID,
  p_destination_account_id UUID,
  p_is_installment BOOLEAN DEFAULT FALSE,
  p_total_installments INTEGER DEFAULT NULL,
  p_current_installment INTEGER DEFAULT NULL
) RETURNS TEXT AS $$
DECLARE
  v_error_message TEXT;
BEGIN
  -- Validar valor positivo
  IF p_amount <= 0 THEN
    RETURN 'Valor deve ser maior que zero';
  END IF;
  
  -- Validar valor muito alto (proteção contra erros)
  IF p_amount > 999999999 THEN
    RETURN 'Valor muito alto. Confirme se está correto.';
  END IF;
  
  -- Validar transferência
  IF p_type = 'TRANSFERÊNCIA' THEN
    IF p_destination_account_id IS NULL THEN
      RETURN 'Transferência requer conta de destino';
    END IF;
    
    IF p_account_id = p_destination_account_id THEN
      RETURN 'Transferência não pode ter origem e destino iguais';
    END IF;
    
    -- Verificar se contas existem
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND deleted = false) THEN
      RETURN 'Conta de origem não encontrada';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_destination_account_id AND deleted = false) THEN
      RETURN 'Conta de destino não encontrada';
    END IF;
  END IF;
  
  -- Validar conta de origem (para receitas e despesas)
  IF p_type IN ('RECEITA', 'DESPESA') THEN
    IF p_account_id IS NULL THEN
      RETURN 'Conta é obrigatória para receitas e despesas';
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND deleted = false) THEN
      RETURN 'Conta não encontrada';
    END IF;
  END IF;
  
  -- Validar parcelas
  IF p_is_installment THEN
    IF p_total_installments IS NULL OR p_total_installments < 2 THEN
      RETURN 'Parcelamento deve ter pelo menos 2 parcelas';
    END IF;
    
    IF p_total_installments > 48 THEN
      RETURN 'Número de parcelas muito alto (máximo 48)';
    END IF;
    
    IF p_current_installment IS NOT NULL THEN
      IF p_current_installment < 1 OR p_current_installment > p_total_installments THEN
        RETURN 'Parcela atual inválida';
      END IF;
    END IF;
  END IF;
  
  RETURN NULL; -- Válido
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 5: FUNÇÃO DE VERIFICAÇÃO DE INTEGRIDADE
-- ==============================================================================

CREATE OR REPLACE FUNCTION verify_financial_integrity(p_user_id UUID)
RETURNS TABLE (
  issue_type TEXT,
  issue_description TEXT,
  severity TEXT,
  affected_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  
  -- 1. Verificar transações com valor inválido
  SELECT 
    'INVALID_AMOUNT'::TEXT,
    'Transações com valor zero ou negativo'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND amount <= 0

  UNION ALL
  
  -- 2. Verificar transferências sem destino
  SELECT 
    'TRANSFER_NO_DESTINATION'::TEXT,
    'Transferências sem conta de destino'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND type = 'TRANSFERÊNCIA'
    AND destination_account_id IS NULL

  UNION ALL

  -- 3. Verificar transferências circulares
  SELECT 
    'TRANSFER_CIRCULAR'::TEXT,
    'Transferências com origem igual ao destino'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND type = 'TRANSFERÊNCIA'
    AND account_id = destination_account_id

  UNION ALL

  -- 4. Verificar transações órfãs (conta deletada)
  SELECT 
    'ORPHAN_TRANSACTION'::TEXT,
    'Transações com conta de origem inexistente'::TEXT,
    'WARNING'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions t
  WHERE t.user_id = p_user_id 
    AND t.deleted = false
    AND t.account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM accounts a 
      WHERE a.id = t.account_id 
      AND a.deleted = false
    )

  UNION ALL

  -- 5. Verificar parcelas inconsistentes
  SELECT 
    'INVALID_INSTALLMENT'::TEXT,
    'Parcelas com número inválido'::TEXT,
    'WARNING'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND is_installment = true
    AND (
      total_installments IS NULL 
      OR total_installments < 1
      OR current_installment IS NULL
      OR current_installment < 1
      OR current_installment > total_installments
    )

  UNION ALL
  
  -- 6. Verificar mirrors órfãos ou quebrados (Ghost/Broken Mirrors)
  SELECT 
    'GHOST_MIRROR'::TEXT,
    'Transações compartilhadas inválidas (sem origem)'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions t
  WHERE t.user_id = p_user_id 
    AND t.deleted = false
    AND (
      -- Caso A: Tem source_id mas o original não existe
      (t.source_transaction_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM transactions t_orig 
        WHERE t_orig.id = t.source_transaction_id 
          AND t_orig.deleted = false
      ))
      OR
      -- Caso B: É compartilhado mas perdeu o source_id (e não é o dono)
      (t.is_shared = true 
       AND t.source_transaction_id IS NULL 
       AND t.description LIKE '%(%)%' -- Heurística de segurança
       AND t.user_id != 'd7f294f7-8651-47f1-844b-9e04fbca0ea5')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 6: CAMPOS DE RECONCILIAÇÃO BANCÁRIA
-- ==============================================================================

-- Adicionar campos de reconciliação (se não existirem)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'transactions' 
    AND column_name = 'reconciled_at'
  ) THEN
    ALTER TABLE transactions 
    ADD COLUMN reconciled_at TIMESTAMPTZ,
    ADD COLUMN reconciled_by UUID REFERENCES auth.users(id),
    ADD COLUMN bank_statement_id UUID;
  END IF;
  
  -- Índice para queries de reconciliação (verificar se já existe)
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_transactions_reconciled'
  ) THEN
    CREATE INDEX idx_transactions_reconciled 
    ON transactions(reconciled_at) 
    WHERE reconciled_at IS NOT NULL;
  END IF;
END $$;

-- Tabela de extratos bancários importados
CREATE TABLE IF NOT EXISTS bank_statements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  account_id UUID REFERENCES accounts(id) NOT NULL,
  statement_date DATE NOT NULL,
  opening_balance NUMERIC NOT NULL,
  closing_balance NUMERIC NOT NULL,
  imported_at TIMESTAMPTZ DEFAULT NOW(),
  source TEXT, -- 'OFX', 'CSV', 'PDF', 'MANUAL'
  file_name TEXT,
  transaction_count INTEGER,
  UNIQUE(user_id, account_id, statement_date)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_bank_statements_user_account 
ON bank_statements(user_id, account_id);

CREATE INDEX IF NOT EXISTS idx_bank_statements_date 
ON bank_statements(statement_date DESC);

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS:
-- ==============================================================================
-- 1. Constraints garantem integridade no banco de dados
-- 2. Auditoria rastreia todas as mudanças
-- 3. Validações centralizadas no backend
-- 4. Verificação de integridade pode ser executada periodicamente
-- 5. Campos de reconciliação prontos para implementação
-- ==============================================================================

