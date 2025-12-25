-- ============================================
-- OTIMIZAÇÃO DE POLÍTICAS RLS
-- Data: 2024-12-24
-- Descrição: Otimiza políticas RLS para usar (SELECT auth.uid())
-- ============================================

-- IMPORTANTE: Este script otimiza as políticas RLS mais críticas
-- Substitui auth.uid() por (SELECT auth.uid()) para melhor performance

-- 1. OTIMIZAR POLÍTICAS DA TABELA TRANSACTIONS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own transactions" ON transactions;
CREATE POLICY "Users can view their own transactions"
  ON transactions FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own transactions" ON transactions;
CREATE POLICY "Users can insert their own transactions"
  ON transactions FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own transactions" ON transactions;
CREATE POLICY "Users can update their own transactions"
  ON transactions FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own transactions" ON transactions;
CREATE POLICY "Users can delete their own transactions"
  ON transactions FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- 2. OTIMIZAR POLÍTICAS DA TABELA TRANSACTION_SPLITS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own transaction splits" ON transaction_splits;
CREATE POLICY "Users can view their own transaction splits"
  ON transaction_splits FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own transaction splits" ON transaction_splits;
CREATE POLICY "Users can insert their own transaction splits"
  ON transaction_splits FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own transaction splits" ON transaction_splits;
CREATE POLICY "Users can update their own transaction splits"
  ON transaction_splits FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own transaction splits" ON transaction_splits;
CREATE POLICY "Users can delete their own transaction splits"
  ON transaction_splits FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- 3. OTIMIZAR POLÍTICAS DA TABELA ACCOUNTS
-- ============================================

DROP POLICY IF EXISTS "Users can view their own accounts" ON accounts;
CREATE POLICY "Users can view their own accounts"
  ON accounts FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own accounts" ON accounts;
CREATE POLICY "Users can insert their own accounts"
  ON accounts FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own accounts" ON accounts;
CREATE POLICY "Users can update their own accounts"
  ON accounts FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own accounts" ON accounts;
CREATE POLICY "Users can delete their own accounts"
  ON accounts FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- 4. OTIMIZAR POLÍTICAS DA TABELA CATEGORIES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own categories" ON categories;
CREATE POLICY "Users can view their own categories"
  ON categories FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own categories" ON categories;
CREATE POLICY "Users can insert their own categories"
  ON categories FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own categories" ON categories;
CREATE POLICY "Users can update their own categories"
  ON categories FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own categories" ON categories;
CREATE POLICY "Users can delete their own categories"
  ON categories FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- 5. OTIMIZAR POLÍTICAS DA TABELA LEDGER_ENTRIES
-- ============================================

DROP POLICY IF EXISTS "Users can view their own ledger entries" ON ledger_entries;
CREATE POLICY "Users can view their own ledger entries"
  ON ledger_entries FOR SELECT
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can insert their own ledger entries" ON ledger_entries;
CREATE POLICY "Users can insert their own ledger entries"
  ON ledger_entries FOR INSERT
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can update their own ledger entries" ON ledger_entries;
CREATE POLICY "Users can update their own ledger entries"
  ON ledger_entries FOR UPDATE
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS "Users can delete their own ledger entries" ON ledger_entries;
CREATE POLICY "Users can delete their own ledger entries"
  ON ledger_entries FOR DELETE
  USING (user_id = (SELECT auth.uid()));

-- ============================================
-- FIM DAS OTIMIZAÇÕES DE POLÍTICAS RLS
-- ============================================
