-- ============================================
-- CORREÇÕES DE PERFORMANCE - ÍNDICES
-- Data: 2024-12-24
-- Descrição: Adiciona índices críticos e remove duplicados
-- ============================================

-- 1. ADICIONAR ÍNDICES EM FOREIGN KEYS CRÍTICAS
-- ============================================

-- Índices para transactions (tabela mais usada)
CREATE INDEX IF NOT EXISTS idx_transactions_account_id ON transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date);
CREATE INDEX IF NOT EXISTS idx_transactions_statement_id ON transactions(statement_id);
CREATE INDEX IF NOT EXISTS idx_transactions_bank_statement_id ON transactions(bank_statement_id);
CREATE INDEX IF NOT EXISTS idx_transactions_installment_plan_id ON transactions(installment_plan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_recurring_rule_id ON transactions(recurring_rule_id);
CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON transactions(trip_id);

-- Índices para transaction_splits
CREATE INDEX IF NOT EXISTS idx_transaction_splits_transaction_id ON transaction_splits(transaction_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_member_id ON transaction_splits(member_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_debtor_id ON transaction_splits(debtor_id);
CREATE INDEX IF NOT EXISTS idx_transaction_splits_payment_tx ON transaction_splits(payment_transaction_id);

-- Índices para ledger_entries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction_id ON ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_debit_account ON ledger_entries(debit_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_credit_account ON ledger_entries(credit_account_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_date ON ledger_entries(user_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_trip_id ON ledger_entries(trip_id);

-- Índices para accounts
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_accounts_user_type ON accounts(user_id, type);

-- Índices para categories
CREATE INDEX IF NOT EXISTS idx_categories_user_id ON categories(user_id);
CREATE INDEX IF NOT EXISTS idx_categories_user_type ON categories(user_id, type);

-- Índices para family_members
CREATE INDEX IF NOT EXISTS idx_family_members_user_id ON family_members(user_id);
CREATE INDEX IF NOT EXISTS idx_family_members_linked_user ON family_members(linked_user_id);

-- 2. REMOVER ÍNDICES DUPLICADOS
-- ============================================

-- Remover duplicata de idx_family_user_active (se existir)
DROP INDEX IF EXISTS idx_family_members_user;

-- Remover duplicata de idx_ledger_entries_accounts (se existir)
DROP INDEX IF EXISTS idx_ledger_entries_account;

-- ============================================
-- FIM DAS CORREÇÕES DE PERFORMANCE - ÍNDICES
-- ============================================
