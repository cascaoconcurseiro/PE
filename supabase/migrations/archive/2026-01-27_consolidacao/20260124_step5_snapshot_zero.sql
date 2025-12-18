-- ==============================================================================
-- MIGRATION: STEP 5 - SNAPSHOT ZERO (IMUTÁVEL)
-- DATA: 2026-01-24
-- OBJ: Criar estado financeiro congelado para auditoria futura e comparação.
-- ==============================================================================

BEGIN;

-- 🥇 PASSO 1 — Criar tabelas de snapshot
CREATE SCHEMA IF NOT EXISTS snapshots;

CREATE TABLE IF NOT EXISTS snapshots.ledger_account_balances (
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  ledger_account_id uuid NOT NULL,
  calculated_balance numeric NOT NULL,
  PRIMARY KEY (snapshot_at, ledger_account_id)
);

CREATE TABLE IF NOT EXISTS snapshots.user_net_worth (
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  user_id uuid NOT NULL,
  net_worth numeric NOT NULL,
  PRIMARY KEY (snapshot_at, user_id)
);

-- 🥈 PASSO 2 — Gerar snapshot de saldo por ledger
-- ADAPTAÇÃO: O schema atual usa 'entry_type' (CREDIT/DEBIT) em vez de colunas separadas.
-- Lógica: CREDIT (Receita/Entrada) é Positivo. DEBIT (Despesa/Saída) é Negativo.
-- (Baseado na implementação 'Bank Statement' do trigger de ponte atual)

INSERT INTO snapshots.ledger_account_balances (
  ledger_account_id,
  calculated_balance
)
SELECT
  la.id,
  COALESCE(SUM(
    CASE
      WHEN je.entry_type = 'CREDIT' THEN je.amount
      WHEN je.entry_type = 'DEBIT' THEN -je.amount
      ELSE 0
    END
  ), 0)
FROM public.ledger_accounts la
LEFT JOIN public.journal_entries je ON je.ledger_account_id = la.id
GROUP BY la.id;


-- 🥉 PASSO 3 — Snapshot de patrimônio por usuário
-- Calcula o Net Worth somando os saldos capturados no snapshot acima.

INSERT INTO snapshots.user_net_worth (
  user_id,
  net_worth
)
SELECT
  up.id,
  COALESCE(SUM(lab.calculated_balance), 0)
FROM public.user_profiles up
LEFT JOIN public.accounts a ON a.user_id = up.id
LEFT JOIN public.ledger_accounts la ON la.account_id = a.id
LEFT JOIN snapshots.ledger_account_balances lab
  ON lab.ledger_account_id = la.id 
  AND lab.snapshot_at = (SELECT MAX(snapshot_at) FROM snapshots.ledger_account_balances) -- Garante pegar o último batch
GROUP BY up.id;


-- 🟡 PASSO 4 — Validar snapshot

DO $$
DECLARE
    v_count_ledger INTEGER;
    v_count_users INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_count_ledger FROM snapshots.ledger_account_balances;
    SELECT COUNT(*) INTO v_count_users FROM snapshots.user_net_worth;
    
    RAISE NOTICE 'Snapshot Generated successfully.';
    RAISE NOTICE 'Ledger Accounts Snapshotted: %', v_count_ledger;
    RAISE NOTICE 'User Net Worth Snapshotted: %', v_count_users;
    
    IF (v_count_ledger = 0 AND (SELECT COUNT(*) FROM public.ledger_accounts) > 0) THEN
        RAISE WARNING 'Warning: Ledger Snapshot is empty but ledger accounts exist!';
    END IF;
END $$;

COMMIT;
