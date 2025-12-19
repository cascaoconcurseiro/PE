-- ============================================================================
-- ⚠️ NUCLEAR RESET - APAGA TODOS OS DADOS DE TODOS OS USUÁRIOS ⚠️
-- ============================================================================
-- CUIDADO: Este script apaga TUDO! Não pode ser desfeito!
-- ============================================================================

-- PASSO 1: Alterar FKs para CASCADE/SET NULL
ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_dest_account 
    FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;

-- PASSO 2: Limpar self-references
UPDATE public.transactions SET source_transaction_id = NULL;
UPDATE public.transactions SET settled_by_tx_id = NULL;

-- PASSO 3: Deletar tabelas dependentes (com verificação de existência)
DO $$
BEGIN
    TRUNCATE public.transaction_splits CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.ledger_entries CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.transaction_audit CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.bank_statements CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.journal_entries CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.shared_transaction_requests CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- PASSO 4: Deletar dados principais
TRUNCATE public.transactions CASCADE;
TRUNCATE public.accounts CASCADE;

DO $$
BEGIN
    TRUNCATE public.assets CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.goals CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.budgets CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.snapshots CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.custom_categories CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.trip_participant_budgets CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.trips CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.family_members CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

DO $$
BEGIN
    TRUNCATE public.settlement_requests CASCADE;
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- PASSO 5: Restaurar FKs originais
ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account 
    FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_dest_account 
    FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;

-- CONFIRMAÇÃO
SELECT 'NUCLEAR RESET COMPLETO!' as status;
