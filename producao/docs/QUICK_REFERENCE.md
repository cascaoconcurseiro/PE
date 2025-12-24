# Financial System - Quick Reference Guide

**Date:** 2024-12-24  
**Purpose:** Quick access to common commands and procedures

---

## Health Check

```sql
-- Run daily health check
SELECT * FROM daily_health_check();

-- Expected: All checks show status = 'PASS'
```

---

## Data Reconciliation

```sql
-- Fix ledger issues
SELECT * FROM reconcile_ledger_entries();

-- Verify ledger balance
SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL;
-- Expected: 0.00
```

---

## Common Queries

```sql
-- Get account balance
SELECT * FROM get_account_balance('user_id'::UUID, 'account_id'::UUID);

-- Calculate cash flow
SELECT * FROM calculate_cash_flow('user_id'::UUID, '2024-01-01'::DATE, '2024-12-31'::DATE);

-- Get monthly summary
SELECT * FROM get_monthly_summary('user_id'::UUID, 2024, 12);

-- Get category totals
SELECT * FROM get_category_totals('user_id'::UUID, '2024-01-01'::DATE, '2024-12-31'::DATE);
```

---

## Troubleshooting

**Unbalanced Ledger:**
```sql
SELECT * FROM reconcile_ledger_entries();
```

**Orphaned Transactions:**
```sql
SELECT t.* FROM transactions t
WHERE t.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.transaction_id = t.id);
```

**Performance Issues:**
```sql
SELECT query, mean_time FROM pg_stat_statements 
WHERE mean_time > 1000 ORDER BY mean_time DESC LIMIT 10;
```

---

## Documentation

- **Architecture:** `BOUNDED_CONTEXTS.md`, `AGGREGATE_ROOTS.md`
- **API:** `API_DOCUMENTATION.md`
- **Operations:** `DEPLOYMENT_RUNBOOK.md`
- **Monitoring:** `MONITORING_DASHBOARD.md`
- **Production:** `PRODUCTION_READINESS_REPORT.md`

---

## Emergency Contacts

**On-Call:** [Number]  
**Slack:** [Channel]  
**Email:** [Email]
