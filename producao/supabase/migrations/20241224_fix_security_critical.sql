-- ============================================
-- CORREÇÕES DE SEGURANÇA CRÍTICA
-- Data: 2024-12-24
-- Descrição: Ativa RLS em tabelas desprotegidas
-- ============================================

-- 1. ATIVAR RLS NAS TABELAS CRÍTICAS
-- ============================================

ALTER TABLE credit_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chart_of_accounts ENABLE ROW LEVEL SECURITY;

-- 2. CRIAR POLÍTICAS DE SEGURANÇA
-- ============================================

-- Políticas para credit_cards
DROP POLICY IF EXISTS "Users can only access their own credit cards" ON credit_cards;
CREATE POLICY "Users can only access their own credit cards"
  ON credit_cards FOR ALL
  USING (user_id = (SELECT auth.uid()));

-- Políticas para bank_statements
DROP POLICY IF EXISTS "Users can only access their own bank statements" ON bank_statements;
CREATE POLICY "Users can only access their own bank statements"
  ON bank_statements FOR ALL
  USING (user_id = (SELECT auth.uid()));

-- Políticas para chart_of_accounts
DROP POLICY IF EXISTS "Users can only access their own chart of accounts" ON chart_of_accounts;
CREATE POLICY "Users can only access their own chart of accounts"
  ON chart_of_accounts FOR ALL
  USING (user_id = (SELECT auth.uid()));

-- 3. REMOVER FUNÇÃO DUPLICADA
-- ============================================

-- Remover versão antiga do import_shared_installments
-- (mantém apenas a versão correta mais recente)
DROP FUNCTION IF EXISTS import_shared_installments(uuid, uuid, text, numeric, integer, date, text, uuid, uuid);

-- 4. ADICIONAR PRIMARY KEYS NAS TABELAS BACKUP
-- ============================================

-- Verificar se já existe antes de adicionar
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'backup_transactions_pre_overhaul_pkey'
  ) THEN
    ALTER TABLE backup_transactions_pre_overhaul 
    ADD COLUMN IF NOT EXISTS backup_id SERIAL PRIMARY KEY;
  END IF;
END $$;

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'backup_shared_requests_pre_overhaul_pkey'
  ) THEN
    ALTER TABLE backup_shared_requests_pre_overhaul 
    ADD COLUMN IF NOT EXISTS backup_id SERIAL PRIMARY KEY;
  END IF;
END $$;

-- ============================================
-- FIM DAS CORREÇÕES DE SEGURANÇA CRÍTICA
-- ============================================
