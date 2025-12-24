# Financial System Monitoring Dashboard

**Date:** 2024-12-24  
**Status:** Implementation Guide  
**Purpose:** Monitor financial system health and integrity

---

## Overview

This document describes the monitoring dashboard for the financial system, including metrics, alerts, and health checks.

---

## Health Check Function

### daily_health_check()

**Purpose:** Automated daily validation of financial data integrity

**Checks Performed:**
1. Unbalanced ledger entries
2. Orphaned transactions (no ledger entries)
3. Duplicate ledger entries
4. Incorrect shared transaction accounting
5. Transactions with NULL account_id

**Usage:**
```sql
SELECT * FROM daily_health_check();
```

**Returns:**
- `check_name`: Name of the validation check
- `status`: 'PASS' or 'FAIL'
- `issue_count`: Number of issues found
- `details`: JSON with specific issue details
- `recommendation`: Action to take if issues found

---

## Key Metrics to Monitor

### 1. Data Integrity Metrics

**Ledger Balance:**
- All ledger entries should balance (sum = 0)
- Check: `SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL`
- Expected: 0.00

**Transaction Coverage:**
- All transactions should have ledger entries
- Check: Count of transactions without ledger entries
- Expected: 0

**Duplicate Detection:**
- No duplicate ledger entries
- Check: Count of duplicate (transaction_id, account_id, amount) combinations
- Expected: 0

### 2. Financial Metrics

**Cash Flow Accuracy:**
- Compare old vs new cash flow calculation
- Check: Verify no 10x duplication
- Expected: Values match actual transactions

**Account Balances:**
- All account balances should be calculable from ledger
- Check: `SELECT * FROM get_account_balance(user_id, account_id)`
- Expected: Accurate balance for each account

**Shared Transaction Correctness:**
- Payer: Debit Expense + Debit Receivables
- Acceptor: Debit Expense + Credit Payables
- Check: Verify accounting entries match pattern
- Expected: All shared transactions follow pattern

### 3. Performance Metrics

**Query Performance:**
- Cash flow calculation time
- Account balance calculation time
- Monthly summary calculation time
- Expected: < 1 second for typical user data

**Database Size:**
- ledger_entries table size
- transactions table size
- Growth rate
- Expected: Linear growth with usage

### 4. System Health Metrics

**RPC Success Rate:**
- Track successful vs failed RPC calls
- Monitor HTTP 400/500 errors
- Expected: > 99% success rate

**Data Consistency:**
- Transactions vs ledger_entries count ratio
- Expected: Stable ratio (1 transaction = 2+ ledger entries)

---

## Alert Rules

### Critical Alerts (Immediate Action Required)

**1. Unbalanced Ledger**
- **Condition:** `SUM(ledger_entries.amount) != 0`
- **Impact:** Financial data is incorrect
- **Action:** Run reconciliation immediately
- **Escalation:** Page on-call engineer

**2. Orphaned Transactions**
- **Condition:** Transactions without ledger entries > 0
- **Impact:** Missing financial data
- **Action:** Investigate trigger failures
- **Escalation:** Alert within 1 hour

**3. Cash Flow Duplication**
- **Condition:** Cash flow > 5x expected value
- **Impact:** Incorrect financial reporting
- **Action:** Check calculation function
- **Escalation:** Alert within 1 hour

### High Priority Alerts (Action Within 24 Hours)

**4. Duplicate Ledger Entries**
- **Condition:** Duplicate entries detected
- **Impact:** Inflated balances
- **Action:** Run deduplication
- **Escalation:** Daily summary

**5. Incorrect Shared Accounting**
- **Condition:** Shared transactions don't follow pattern
- **Impact:** Wrong receivables/payables
- **Action:** Fix accounting entries
- **Escalation:** Daily summary

**6. Performance Degradation**
- **Condition:** Query time > 5 seconds
- **Impact:** Poor user experience
- **Action:** Optimize queries, add indexes
- **Escalation:** Daily summary

### Medium Priority Alerts (Action Within 1 Week)

**7. Database Growth Rate**
- **Condition:** Growth > 2x expected
- **Impact:** Potential storage issues
- **Action:** Review data retention policy
- **Escalation:** Weekly summary

**8. RPC Error Rate**
- **Condition:** Error rate > 1%
- **Impact:** User experience issues
- **Action:** Review error logs
- **Escalation:** Weekly summary

---

## Monitoring Dashboard Layout

### Section 1: System Health (Top)

**Status Indicator:**
- 🟢 GREEN: All checks passing
- 🟡 YELLOW: Non-critical issues detected
- 🔴 RED: Critical issues detected

**Last Health Check:**
- Timestamp of last run
- Overall status
- Link to detailed results

### Section 2: Data Integrity (Left Column)

**Ledger Balance:**
- Current sum of all ledger entries
- Expected: 0.00
- Status: PASS/FAIL

**Transaction Coverage:**
- Transactions with ledger entries: X / Y (Z%)
- Expected: 100%
- Status: PASS/FAIL

**Duplicate Detection:**
- Duplicate entries found: X
- Expected: 0
- Status: PASS/FAIL

### Section 3: Financial Metrics (Center Column)

**Cash Flow (Current Month):**
- Income: R$ X
- Expenses: R$ Y
- Net: R$ Z
- Trend: ↑/↓ vs last month

**Account Balances:**
- Total assets: R$ X
- Total liabilities: R$ Y
- Net worth: R$ Z

**Shared Transactions:**
- Active shared requests: X
- Pending acceptances: Y
- Completed this month: Z

### Section 4: Performance (Right Column)

**Query Performance:**
- Cash flow calculation: X ms
- Account balance: Y ms
- Monthly summary: Z ms

**Database Size:**
- ledger_entries: X MB
- transactions: Y MB
- Total: Z MB

**RPC Success Rate:**
- Success: X%
- Errors: Y%
- Trend: ↑/↓

### Section 5: Recent Issues (Bottom)

**Table of Recent Issues:**
| Timestamp | Check | Status | Issue Count | Action |
|-----------|-------|--------|-------------|--------|
| 2024-12-24 08:00 | Ledger Balance | PASS | 0 | - |
| 2024-12-23 08:00 | Duplicate Detection | FAIL | 3 | Reconciled |

---

## Implementation Steps

### Step 1: Create Monitoring Views

```sql
-- View: system_health_summary
CREATE OR REPLACE VIEW system_health_summary AS
SELECT
  (SELECT COUNT(*) FROM transactions WHERE deleted_at IS NULL) as total_transactions,
  (SELECT COUNT(*) FROM ledger_entries WHERE deleted_at IS NULL) as total_ledger_entries,
  (SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL) as ledger_balance,
  (SELECT COUNT(*) FROM transactions t 
   WHERE deleted_at IS NULL 
   AND NOT EXISTS (
     SELECT 1 FROM ledger_entries le 
     WHERE le.transaction_id = t.id 
     AND le.deleted_at IS NULL
   )) as orphaned_transactions,
  NOW() as checked_at;
```

### Step 2: Create Monitoring Functions

```sql
-- Function: get_system_metrics()
CREATE OR REPLACE FUNCTION get_system_metrics()
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  SELECT json_build_object(
    'health_check', (SELECT * FROM daily_health_check()),
    'summary', (SELECT row_to_json(s) FROM system_health_summary s),
    'timestamp', NOW()
  ) INTO result;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Step 3: Create Frontend Dashboard Component

**Location:** `producao/src/features/monitoring/MonitoringDashboard.tsx`

**Features:**
- Real-time health status
- Metric visualizations
- Alert history
- Manual health check trigger
- Export reports

### Step 4: Setup Scheduled Health Checks

**Using Supabase Edge Functions:**
```typescript
// Edge Function: daily-health-check
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )
  
  const { data, error } = await supabase.rpc('daily_health_check')
  
  // Send alerts if issues found
  const issues = data?.filter(check => check.status === 'FAIL')
  if (issues?.length > 0) {
    // Send notification (email, Slack, etc.)
  }
  
  return new Response(JSON.stringify({ data, error }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

**Schedule:** Use Supabase pg_cron or external cron service

---

## Structured Logging

### Log Levels

**ERROR:** Critical issues requiring immediate attention
- Unbalanced ledger
- Failed transactions
- RPC errors

**WARN:** Issues requiring attention within 24 hours
- Performance degradation
- Duplicate entries
- Validation failures

**INFO:** Normal operations
- Successful transactions
- Health check results
- User actions

**DEBUG:** Detailed information for troubleshooting
- Query execution times
- Function parameters
- Intermediate calculations

### Log Format

```json
{
  "timestamp": "2024-12-24T08:00:00Z",
  "level": "ERROR",
  "service": "financial-system",
  "operation": "create_transaction",
  "user_id": "uuid",
  "transaction_id": "uuid",
  "message": "Failed to create ledger entries",
  "error": "Constraint violation",
  "context": {
    "account_id": "uuid",
    "amount": 100.00,
    "type": "expense"
  }
}
```

### Implementation

**PostgreSQL Logging:**
```sql
CREATE TABLE system_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  level TEXT NOT NULL,
  service TEXT NOT NULL,
  operation TEXT NOT NULL,
  user_id UUID,
  transaction_id UUID,
  message TEXT NOT NULL,
  error TEXT,
  context JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_system_logs_timestamp ON system_logs(timestamp DESC);
CREATE INDEX idx_system_logs_level ON system_logs(level);
CREATE INDEX idx_system_logs_user_id ON system_logs(user_id);
```

---

## Runbook: Responding to Alerts

### Critical Alert: Unbalanced Ledger

**1. Verify the Issue:**
```sql
SELECT SUM(amount) as ledger_balance 
FROM ledger_entries 
WHERE deleted_at IS NULL;
```

**2. Identify Problematic Entries:**
```sql
SELECT * FROM daily_health_check() 
WHERE check_name = 'unbalanced_entries';
```

**3. Run Reconciliation:**
```sql
SELECT * FROM reconcile_ledger_entries();
```

**4. Verify Fix:**
```sql
SELECT SUM(amount) FROM ledger_entries WHERE deleted_at IS NULL;
-- Should be 0.00
```

### High Priority Alert: Orphaned Transactions

**1. Identify Orphans:**
```sql
SELECT t.* 
FROM transactions t
WHERE t.deleted_at IS NULL
AND NOT EXISTS (
  SELECT 1 FROM ledger_entries le 
  WHERE le.transaction_id = t.id 
  AND le.deleted_at IS NULL
);
```

**2. Check Trigger Status:**
```sql
SELECT * FROM pg_trigger 
WHERE tgname = 'sync_transaction_to_ddd_ledger_trigger';
```

**3. Manually Create Entries (if needed):**
```sql
-- For each orphaned transaction, manually trigger sync
-- Or mark as deleted if invalid
UPDATE transactions 
SET deleted_at = NOW() 
WHERE id = 'orphan_id' AND account_id IS NULL;
```

---

## Dashboard Access

**URL:** `/monitoring/dashboard`  
**Permissions:** Admin only  
**Refresh Rate:** Every 5 minutes (auto-refresh)  
**Manual Refresh:** Available via button

---

## Future Enhancements

1. **Real-time Alerts:** WebSocket notifications for critical issues
2. **Trend Analysis:** Historical charts for all metrics
3. **Predictive Alerts:** ML-based anomaly detection
4. **Custom Dashboards:** User-configurable metric views
5. **Export Reports:** PDF/CSV export of health checks
6. **Integration:** Slack/Email notifications
7. **Mobile App:** Monitoring dashboard in mobile app

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2024-12-24  
**Next Review:** When implementing dashboard UI
