-- ==============================================================================
-- MIGRATION: STEP 8 - OBSERVABILIDADE PÓS-MIGRAÇÃO
-- DATA: 2026-01-24
-- OBJ: Monitorar saúde do sistema e garantir reconciliação contínua.
-- ==============================================================================

BEGIN;

-- 1. VIEW: LEDGER INTEGRITY MONITOR
-- ------------------------------------------------------------------------------
-- Compara Soma de Transações vs Saldo do Ledger em tempo quase real
CREATE OR REPLACE VIEW public.view_ledger_integrity_monitor AS
WITH calculated AS (
    SELECT 
        account_id,
        SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE -amount END) as tx_balance
    FROM public.transactions
    WHERE deleted = FALSE
    GROUP BY account_id
),
stored AS (
    SELECT account_id, balance as ledger_balance FROM public.ledger_accounts
)
SELECT 
    c.account_id,
    c.tx_balance,
    s.ledger_balance,
    (c.tx_balance - COALESCE(s.ledger_balance, 0)) as discrepancy
FROM calculated c
LEFT JOIN stored s ON c.account_id::uuid = s.account_id
WHERE (c.tx_balance - COALESCE(s.ledger_balance, 0)) != 0;


-- 2. VIEW: ORPHANED DATA MONITOR
-- ------------------------------------------------------------------------------
CREATE OR REPLACE VIEW public.view_data_health AS
SELECT 'Orphaned Splits' as issue, COUNT(*) as count
FROM public.transaction_splits s
LEFT JOIN public.transactions t ON s.transaction_id = t.id
WHERE t.id IS NULL
UNION ALL
SELECT 'Orphaned Ledger Entries', COUNT(*)
FROM public.journal_entries je
LEFT JOIN public.ledger_accounts la ON je.ledger_account_id = la.id
WHERE la.id IS NULL;


-- 3. SCHEDULED COMPLIANCE CHECK (Function to be called by CRON)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.check_system_health()
RETURNS JSONB AS $$
DECLARE
    v_inconsistencies INTEGER;
    v_orphans INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_inconsistencies FROM public.view_ledger_integrity_monitor;
    SELECT SUM(count) INTO v_orphans FROM public.view_data_health;
    
    IF (v_inconsistencies > 0 OR v_orphans > 0) THEN
        INSERT INTO public.audit_inconsistencies (issue_description, severity, details)
        VALUES ('Health Check Failed', 'WARNING', jsonb_build_object('ledger_diffs', v_inconsistencies, 'orphans', v_orphans));
        
        RETURN jsonb_build_object('status', 'UNHEALTHY', 'details', 'Inconsistencies detected. Check audit logs.');
    END IF;

    RETURN jsonb_build_object('status', 'HEALTHY');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
