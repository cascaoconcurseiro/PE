-- ==============================================================================
-- ADVANCED DIAGNOSTICS (DETECTOR DE DUPLICIDADE)
-- DATA: 2026-01-24
-- OBJ: Provar existência de efeitos duplicados.
-- ==============================================================================

BEGIN;

-- 2.1 — Verificar lançamentos duplicados por transação
-- Regra: Max 2 entries per transaction (1 Debit, 1 Credit) usually.
-- (Adjusted for 'transaction_id' column)
CREATE OR REPLACE VIEW public.diag_excessive_entries AS
SELECT
  transaction_id,
  COUNT(*)            AS total_entries,
  SUM(amount)         AS total_amount,
  MIN(created_at)     AS first_entry,
  MAX(created_at)     AS last_entry
FROM public.journal_entries
WHERE transaction_id IS NOT NULL
GROUP BY transaction_id
HAVING COUNT(*) > 2;


-- 2.2 — Detectar múltiplos efeitos financeiros idênticos (Duplicidade Lógica)
-- Mesmo valor, mesma conta, mesma transação (Duplicado)
CREATE OR REPLACE VIEW public.diag_duplicate_hits AS
SELECT
  ledger_account_id,
  transaction_id,
  amount,
  entry_type,
  COUNT(*) AS occurrences
FROM public.journal_entries
GROUP BY
  ledger_account_id,
  transaction_id,
  amount,
  entry_type
HAVING COUNT(*) > 1;


-- 2.3 — Saldo divergente entre ledger_stored vs entries_calculated
-- (Adaptado para Single Entry Schema: Credit (+), Debit (-))
-- OBS: Assumindo convenção 'Bank Statement' usada na migração 20260122 (Receita=Credit).
CREATE OR REPLACE VIEW public.diag_ledger_mismatch AS
WITH calculated AS (
    SELECT 
        ledger_account_id, 
        SUM(CASE WHEN entry_type = 'CREDIT' THEN amount ELSE -amount END) as calc_balance
    FROM public.journal_entries
    GROUP BY ledger_account_id
)
SELECT
  la.id AS ledger_account_id,
  la.balance AS stored_balance,
  c.calc_balance,
  (la.balance - c.calc_balance) as diff
FROM public.ledger_accounts la
JOIN calculated c ON la.id = c.ledger_account_id
WHERE (la.balance - c.calc_balance) != 0;


-- 2.4 — Duplicação por shared / mirror
-- (Já coberto por 2.1, mas explicitando foco)
CREATE OR REPLACE VIEW public.diag_shared_duplication AS
SELECT
  t.id AS transaction_id,
  t.description,
  COUNT(je.id) AS ledger_entries
FROM public.transactions t
JOIN public.journal_entries je ON je.transaction_id = t.id
WHERE t.is_shared = TRUE
GROUP BY t.id, t.description
HAVING COUNT(je.id) > 2;

COMMIT;

-- REPORTING
SELECT '2.1 Excessive Entries' as check_name, COUNT(*) as failed_items FROM public.diag_excessive_entries
UNION ALL
SELECT '2.2 Duplicate Hits', COUNT(*) FROM public.diag_duplicate_hits
UNION ALL
SELECT '2.3 Ledger Mismatch', COUNT(*) FROM public.diag_ledger_mismatch
UNION ALL
SELECT '2.4 Shared Duplication', COUNT(*) FROM public.diag_shared_duplication;
