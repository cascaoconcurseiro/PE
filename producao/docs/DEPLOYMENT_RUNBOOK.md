# Financial System - Deployment Runbook

**Date:** 2024-12-24  
**Status:** Operational Guide  
**Purpose:** Step-by-step procedures for deployment, troubleshooting, and disaster recovery

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Deployment Procedures](#deployment-procedures)
3. [Rollback Procedures](#rollback-procedures)
4. [Troubleshooting Guide](#troubleshooting-guide)
5. [Data Reconciliation](#data-reconciliation)
6. [Disaster Recovery](#disaster-recovery)
7. [Monitoring and Alerts](#monitoring-and-alerts)

---

## Pre-Deployment Checklist

### 1. Code Review
- [ ] All code changes reviewed and approved
- [ ] All tests passing (unit + integration)
- [ ] No console errors or warnings
- [ ] TypeScript types up to date
- [ ] Documentation updated

### 2. Database Validation
- [ ] All migrations tested in local environment
- [ ] Migration order documented
- [ ] Rollback scripts prepared
- [ ] Backup strategy confirmed
- [ ] Health check passing

### 3. Environment Preparation
- [ ] Staging environment matches production
- [ ] Environment variables configured
- [ ] API keys and secrets verified
- [ ] Database connection tested
- [ ] Monitoring tools configured

### 4. Communication
- [ ] Stakeholders notified of deployment window
- [ ] Maintenance window scheduled (if needed)
- [ ] Rollback plan communicated
- [ ] On-call engineer assigned

---

## Deployment Procedures

### Phase 1: Backup

**1. Create Database Backup**
```bash
# Using Supabase CLI
supabase db dump -f backup_$(date +%Y%m%d_%H%M%S).sql

# Or using Supabase Dashboard
# Navigate to Database > Backups > Create Backup
```

**2. Verify Backup**
```bash
# Check backup file size
ls -lh backup_*.sql

# Verify backup can be read
head -n 100 backup_*.sql
```

**3. Store Backup Securely**
```bash
# Upload to secure storage
aws s3 cp backup_*.sql s3://your-backup-bucket/
# Or use your preferred backup solution
```

### Phase 2: Deploy to Staging

**1. Apply Migrations to Staging**
```bash
# Set environment to staging
export SUPABASE_PROJECT_ID="staging_project_id"

# Apply migrations in order
supabase db push

# Or apply individually
psql -h staging-db.supabase.co -U postgres -d postgres -f migration_file.sql
```

**2. Run Health Check**
```sql
-- Connect to staging database
SELECT * FROM daily_health_check();
```

**Expected Output:**
```
check_name              | status | issue_count | details | recommendation
------------------------|--------|-------------|---------|---------------
unbalanced_entries      | PASS   | 0           | {}      | NULL
orphaned_transactions   | PASS   | 0           | {}      | NULL
duplicate_entries       | PASS   | 0           | {}      | NULL
incorrect_shared_trans  | PASS   | 0           | {}      | NULL
null_account_id         | PASS   | 0           | {}      | NULL
```

**3. Run Integration Tests**
```bash
# Run test suite
npm run test:integration

# Or manually test critical flows
# - Create transaction
# - Create shared transaction
# - Accept shared transaction
# - Calculate cash flow
# - Get account balance
```

**4. Validate Data Integrity**
```sql
-- Check ledger balance
SELECT SUM(amount) as ledger_balance 
FROM ledger_entries 
WHERE deleted_at IS NULL;
-- Expected: 0.00

-- Check transaction coverage
SELECT COUNT(*) as transactions_without_ledger
FROM transactions t
WHERE t.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM ledger_entries le 
  WHERE le.transaction_id = t.id 
  AND le.deleted_at IS NULL
);
-- Expected: 0

-- Check for duplicates
SELECT transaction_id, account_id, amount, COUNT(*) as count
FROM ledger_entries
WHERE deleted_at IS NULL
GROUP BY transaction_id, account_id, amount
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

### Phase 3: Deploy to Production

**1. Schedule Maintenance Window (if needed)**
```
Maintenance Window: [Date] [Time] - [Time]
Expected Duration: 30 minutes
Impact: Read-only mode during migration
```

**2. Enable Read-Only Mode (if needed)**
```sql
-- Revoke write permissions temporarily
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;
```

**3. Apply Migrations to Production**
```bash
# Set environment to production
export SUPABASE_PROJECT_ID="mlqzeihukezlozooqhko"

# Apply migrations
supabase db push

# Or apply individually with verification
for migration in migrations/*.sql; do
  echo "Applying $migration..."
  psql -h db.mlqzeihukezlozooqhko.supabase.co -U postgres -d postgres -f "$migration"
  
  # Verify after each migration
  psql -h db.mlqzeihukezlozooqhko.supabase.co -U postgres -d postgres -c "SELECT * FROM daily_health_check();"
  
  # Wait for confirmation
  read -p "Migration successful? (y/n) " -n 1 -r
  if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Migration failed. Rolling back..."
    # Execute rollback
    exit 1
  fi
done
```

**4. Run Data Reconciliation**
```sql
-- Reconcile any existing data issues
SELECT * FROM reconcile_ledger_entries();
```

**5. Verify Production Health**
```sql
-- Run health check
SELECT * FROM daily_health_check();

-- Verify critical metrics
SELECT * FROM get_system_metrics();
```

**6. Re-enable Write Access (if disabled)**
```sql
-- Restore write permissions
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
```

**7. Deploy Frontend Changes**
```bash
# Deploy to Vercel (or your hosting platform)
vercel --prod

# Or using Git push (if auto-deploy configured)
git push origin main
```

**8. Monitor for Issues**
```bash
# Watch logs for errors
supabase logs --project-id mlqzeihukezlozooqhko --service postgres

# Monitor error rate
# Check monitoring dashboard
# Watch for alerts
```

### Phase 4: Post-Deployment Validation

**1. Smoke Tests**
- [ ] User can log in
- [ ] User can create transaction
- [ ] User can view dashboard
- [ ] Cash flow displays correctly
- [ ] Account balances are accurate
- [ ] Shared transactions work
- [ ] No console errors

**2. Data Validation**
```sql
-- Verify ledger integrity
SELECT * FROM validate_ledger_integrity();

-- Check recent transactions
SELECT COUNT(*) FROM transactions 
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Verify no errors in logs
SELECT * FROM system_logs 
WHERE level = 'ERROR' 
AND timestamp > NOW() - INTERVAL '1 hour';
```

**3. Performance Check**
```sql
-- Check query performance
EXPLAIN ANALYZE SELECT * FROM calculate_cash_flow(
  'user_id'::UUID, 
  '2024-01-01'::DATE, 
  '2024-12-31'::DATE
);
-- Execution time should be < 1 second
```

**4. User Acceptance**
- [ ] Test with real user account
- [ ] Verify all features work
- [ ] Check for any unexpected behavior
- [ ] Confirm no data loss

---

## Rollback Procedures

### When to Rollback

**Immediate Rollback Required:**
- Critical data corruption detected
- System completely unavailable
- Unbalanced ledger entries
- Mass data loss

**Consider Rollback:**
- High error rate (> 5%)
- Performance degradation (> 5x slower)
- Multiple user reports of issues
- Failed health checks

### Rollback Steps

**1. Assess Impact**
```sql
-- Check what changed since deployment
SELECT * FROM system_logs 
WHERE timestamp > '[deployment_time]'
ORDER BY timestamp DESC;

-- Check affected users
SELECT DISTINCT user_id 
FROM transactions 
WHERE created_at > '[deployment_time]';
```

**2. Stop New Changes**
```sql
-- Enable read-only mode
REVOKE INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;
```

**3. Restore Database from Backup**
```bash
# Download backup
aws s3 cp s3://your-backup-bucket/backup_YYYYMMDD_HHMMSS.sql ./

# Restore to database
psql -h db.mlqzeihukezlozooqhko.supabase.co -U postgres -d postgres < backup_YYYYMMDD_HHMMSS.sql
```

**4. Rollback Frontend**
```bash
# Revert to previous deployment
vercel rollback

# Or redeploy previous version
git revert HEAD
git push origin main
```

**5. Verify Rollback**
```sql
-- Run health check
SELECT * FROM daily_health_check();

-- Verify data integrity
SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL;
-- Should be 0.00
```

**6. Re-enable Write Access**
```sql
-- Restore write permissions
GRANT INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
```

**7. Communicate Status**
- Notify stakeholders of rollback
- Explain what happened
- Provide timeline for fix
- Document lessons learned

---

## Troubleshooting Guide

### Issue: Unbalanced Ledger Entries

**Symptoms:**
- `daily_health_check()` shows unbalanced_entries FAIL
- `SUM(ledger_entries.amount) != 0`

**Diagnosis:**
```sql
-- Check total imbalance
SELECT SUM(amount) as total_imbalance 
FROM ledger_entries 
WHERE deleted_at IS NULL;

-- Find problematic transactions
SELECT t.id, t.description, SUM(le.amount) as balance
FROM transactions t
JOIN ledger_entries le ON le.transaction_id = t.id
WHERE le.deleted_at IS NULL
GROUP BY t.id, t.description
HAVING SUM(le.amount) != 0;
```

**Resolution:**
```sql
-- Run reconciliation
SELECT * FROM reconcile_ledger_entries();

-- Verify fix
SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL;
```

### Issue: Orphaned Transactions

**Symptoms:**
- Transactions exist without ledger entries
- `daily_health_check()` shows orphaned_transactions FAIL

**Diagnosis:**
```sql
-- Find orphaned transactions
SELECT t.* 
FROM transactions t
WHERE t.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM ledger_entries le 
  WHERE le.transaction_id = t.id 
  AND le.deleted_at IS NULL
);
```

**Resolution:**
```sql
-- Check if trigger is enabled
SELECT * FROM pg_trigger 
WHERE tgname = 'sync_transaction_to_ddd_ledger_trigger';

-- If trigger is disabled, re-enable
ALTER TABLE transactions 
ENABLE TRIGGER sync_transaction_to_ddd_ledger_trigger;

-- For existing orphans, either:
-- 1. Delete if invalid (NULL account_id)
UPDATE transactions 
SET deleted_at = NOW() 
WHERE id IN (SELECT id FROM orphaned_transactions) 
AND account_id IS NULL;

-- 2. Or manually create ledger entries
-- (Use reconcile_ledger_entries function)
```

### Issue: Cash Flow Duplication

**Symptoms:**
- Cash flow shows 10x expected value
- R$ 95 shows as R$ 950

**Diagnosis:**
```sql
-- Check which function is being used
-- Old function (WRONG): get_monthly_cashflow()
-- New function (CORRECT): calculate_cash_flow()

-- Compare results
SELECT * FROM get_monthly_cashflow('user_id', 2024, 12);
SELECT * FROM calculate_cash_flow('user_id', '2024-12-01', '2024-12-31');
```

**Resolution:**
```typescript
// Update frontend to use new function
// File: producao/src/core/services/supabaseService.ts

// OLD (WRONG):
const { data } = await supabase.rpc('get_monthly_cashflow', { ... });

// NEW (CORRECT):
const { data } = await supabase.rpc('calculate_cash_flow', { ... });
```

### Issue: Shared Transaction Incorrect Accounting

**Symptoms:**
- Shared transactions show wrong amounts
- Receivables/Payables not created

**Diagnosis:**
```sql
-- Check shared transaction ledger entries
SELECT st.id, st.description, le.*
FROM shared_transactions st
JOIN transactions t ON t.id = st.transaction_id
JOIN ledger_entries le ON le.transaction_id = t.id
WHERE st.id = 'shared_transaction_id'
ORDER BY le.created_at;

-- Expected pattern for payer:
-- 1. Debit Expense (positive amount)
-- 2. Debit Receivables (positive amount)

-- Expected pattern for acceptor:
-- 1. Debit Expense (positive amount)
-- 2. Credit Payables (negative amount)
```

**Resolution:**
```sql
-- Use specialized functions for shared transactions
-- These are automatically called by RPCs
-- If manual fix needed, contact DBA
```

### Issue: RPC Returns HTTP 400

**Symptoms:**
- Frontend shows "Bad Request" error
- RPC call fails with HTTP 400

**Diagnosis:**
```sql
-- Check RPC signature
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public'
AND p.proname LIKE '%shared%';

-- Check frontend call
-- Ensure all required parameters are provided
-- Ensure parameter types match
```

**Resolution:**
```typescript
// Verify RPC call matches signature
const { data, error } = await supabase.rpc('create_shared_transaction_v2', {
  p_user_id: userId,
  p_account_id: accountId,
  p_category_id: categoryId,
  p_amount: amount,
  p_description: description,
  p_notes: notes, // Make sure this parameter exists
  p_date: date,
  p_participants: participants
});

if (error) {
  console.error('RPC Error:', error);
  // Check error.message for details
}
```

### Issue: Performance Degradation

**Symptoms:**
- Queries taking > 5 seconds
- Dashboard slow to load
- Timeouts

**Diagnosis:**
```sql
-- Check slow queries
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  max_time
FROM pg_stat_statements
WHERE mean_time > 1000 -- queries taking > 1 second
ORDER BY mean_time DESC
LIMIT 10;

-- Check missing indexes
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname = 'public'
AND tablename IN ('transactions', 'ledger_entries', 'accounts')
ORDER BY n_distinct DESC;
```

**Resolution:**
```sql
-- Add indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ledger_entries_account_date 
ON ledger_entries(account_id, entry_date) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_user_date 
ON transactions(user_id, date) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction 
ON ledger_entries(transaction_id) 
WHERE deleted_at IS NULL;

-- Analyze tables
ANALYZE transactions;
ANALYZE ledger_entries;
ANALYZE accounts;
```

---

## Data Reconciliation

### When to Reconcile

**Scheduled:**
- Weekly (Sunday night)
- After major deployment
- After data migration

**On-Demand:**
- Health check fails
- User reports data issues
- After rollback

### Reconciliation Procedure

**1. Run Health Check**
```sql
SELECT * FROM daily_health_check();
```

**2. Run Reconciliation**
```sql
SELECT * FROM reconcile_ledger_entries();
```

**3. Verify Results**
```sql
-- Check ledger balance
SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL;
-- Expected: 0.00

-- Check for orphans
SELECT COUNT(*) FROM transactions t
WHERE t.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM ledger_entries le 
  WHERE le.transaction_id = t.id 
  AND le.deleted_at IS NULL
);
-- Expected: 0

-- Check for duplicates
SELECT transaction_id, account_id, amount, COUNT(*)
FROM ledger_entries
WHERE deleted_at IS NULL
GROUP BY transaction_id, account_id, amount
HAVING COUNT(*) > 1;
-- Expected: 0 rows
```

**4. Document Results**
```sql
-- Log reconciliation results
INSERT INTO system_logs (level, service, operation, message, context)
VALUES (
  'INFO',
  'financial-system',
  'reconciliation',
  'Reconciliation completed',
  jsonb_build_object(
    'timestamp', NOW(),
    'issues_found', 0,
    'issues_fixed', 0
  )
);
```

---

## Disaster Recovery

### Scenario 1: Complete Database Loss

**Recovery Steps:**

1. **Restore from Latest Backup**
```bash
# Download latest backup
aws s3 cp s3://your-backup-bucket/latest_backup.sql ./

# Restore to new database
psql -h new-db.supabase.co -U postgres -d postgres < latest_backup.sql
```

2. **Verify Data Integrity**
```sql
SELECT * FROM daily_health_check();
```

3. **Update Connection Strings**
```bash
# Update environment variables
export SUPABASE_URL="https://new-project.supabase.co"
export SUPABASE_ANON_KEY="new_anon_key"
```

4. **Redeploy Application**
```bash
vercel --prod
```

### Scenario 2: Data Corruption

**Recovery Steps:**

1. **Identify Corruption Scope**
```sql
-- Find affected time range
SELECT MIN(created_at), MAX(created_at)
FROM transactions
WHERE /* corruption criteria */;
```

2. **Restore Affected Data**
```sql
-- Delete corrupted data
DELETE FROM ledger_entries 
WHERE created_at BETWEEN 'start_time' AND 'end_time';

DELETE FROM transactions 
WHERE created_at BETWEEN 'start_time' AND 'end_time';

-- Restore from backup (selective)
-- Use point-in-time recovery if available
```

3. **Reconcile**
```sql
SELECT * FROM reconcile_ledger_entries();
```

### Scenario 3: Accidental Data Deletion

**Recovery Steps:**

1. **Check Soft Delete**
```sql
-- Check if data is soft-deleted
SELECT * FROM transactions WHERE deleted_at IS NOT NULL;
SELECT * FROM ledger_entries WHERE deleted_at IS NOT NULL;
```

2. **Restore Soft-Deleted Data**
```sql
-- Restore transactions
UPDATE transactions 
SET deleted_at = NULL 
WHERE id IN (/* affected IDs */);

-- Restore ledger entries
UPDATE ledger_entries 
SET deleted_at = NULL 
WHERE transaction_id IN (/* affected IDs */);
```

3. **Verify Integrity**
```sql
SELECT * FROM daily_health_check();
```

---

## Monitoring and Alerts

### Critical Alerts (Page Immediately)

**1. Unbalanced Ledger**
```sql
-- Alert condition
SELECT SUM(amount) != 0 FROM ledger_entries WHERE deleted_at IS NULL;

-- Action: Run reconciliation immediately
```

**2. System Down**
```bash
# Alert condition
# HTTP 500 errors > 10% of requests

# Action: Check logs, rollback if needed
```

### High Priority Alerts (Respond Within 1 Hour)

**3. Orphaned Transactions**
```sql
-- Alert condition
SELECT COUNT(*) > 0 FROM transactions t
WHERE t.deleted_at IS NULL
AND NOT EXISTS (SELECT 1 FROM ledger_entries le WHERE le.transaction_id = t.id);

-- Action: Investigate trigger, run reconciliation
```

**4. Performance Degradation**
```sql
-- Alert condition
-- Query time > 5 seconds

-- Action: Check slow queries, add indexes
```

### Medium Priority Alerts (Daily Review)

**5. Error Rate**
```sql
-- Alert condition
SELECT COUNT(*) FROM system_logs 
WHERE level = 'ERROR' 
AND timestamp > NOW() - INTERVAL '24 hours';

-- Action: Review errors, fix issues
```

---

## Contact Information

**On-Call Engineer:** [Name]  
**Phone:** [Number]  
**Email:** [Email]  
**Slack:** [Channel]

**Escalation:**
- Level 1: On-Call Engineer
- Level 2: Tech Lead
- Level 3: CTO

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2024-12-24  
**Next Review:** Before each major deployment
