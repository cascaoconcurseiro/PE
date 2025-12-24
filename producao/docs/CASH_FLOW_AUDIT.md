# Cash Flow Calculation Audit

**Date:** 2024-12-24  
**Task:** 9.1 Audit current cash flow calculation  
**Status:** Complete

---

## Executive Summary

The current `get_monthly_cashflow()` function uses the `transactions` table as its data source, which causes **duplication for shared expenses**. This is the root cause of the R$ 95 → R$ 950 issue.

---

## Current Implementation

### Function: get_monthly_cashflow()

**Location:** Database RPC function

**Current Logic:**
```sql
SELECT 
    EXTRACT(MONTH FROM date)::INT as month,
    SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE 0 END) as income,
    SUM(CASE WHEN type = 'DESPESA' THEN amount ELSE 0 END) as expense
FROM 
    transactions
WHERE 
    user_id = p_user_id
    AND deleted = false
    AND EXTRACT(YEAR FROM date)::INT = p_year
    AND type IN ('RECEITA', 'DESPESA')
    AND category != 'Saldo Inicial / Ajuste'
GROUP BY 
    EXTRACT(MONTH FROM date)
ORDER BY 
    month;
```

---

## Problem Analysis

### Issue 1: Uses Transactions Table Directly

**Problem:** The function queries the `transactions` table instead of `ledger_entries`

**Impact:**
- Shared expenses are counted multiple times
- Both payer and acceptor transactions are included
- Example: R$ 95 expense becomes R$ 950 (10x duplication)

**Root Cause:**
- Transactions table contains both original and mirror transactions
- No distinction between "my actual expense" vs "expense I'm tracking for someone else"

### Issue 2: No Ledger Integration

**Problem:** Ignores the double-entry bookkeeping system

**Impact:**
- Cannot leverage the ledger's built-in accuracy
- Misses the benefit of balanced entries
- Duplicates business logic that already exists in ledger

### Issue 3: Category-Based Filtering

**Problem:** Uses transaction `type` field instead of account types

**Impact:**
- Less flexible for complex scenarios
- Doesn't align with DDD architecture
- Harder to maintain consistency

---

## Duplication Example

### Scenario: Shared Expense

**Transaction Details:**
- Description: "Seguro - Carro"
- Amount: R$ 95
- Shared with: 1 person (50/50 split)

**Current Behavior:**

1. **Payer's Transaction:**
   - Amount: R$ 95
   - Type: DESPESA
   - Counted in cash flow: ✅ R$ 95

2. **Acceptor's Mirror Transaction:**
   - Amount: R$ 95
   - Type: DESPESA
   - Counted in cash flow: ✅ R$ 95

**Total Counted:** R$ 190 (should be R$ 95)

**With 10 installments:** R$ 1,900 (should be R$ 950)

---

## Correct Approach: Use Ledger Entries

### Why Ledger is Correct

1. **Single Source of Truth:** Ledger entries represent actual financial movements
2. **No Duplication:** Each entry is unique and balanced
3. **Proper Accounting:** Follows double-entry bookkeeping principles
4. **Shared Expenses:** Correctly handled with Receivables/Payables accounts

### Ledger-Based Logic

**For Income (Revenue):**
```sql
-- Debit: Asset Account (money coming in)
-- Credit: Revenue Account (income category)
SELECT SUM(amount) FROM ledger_entries
WHERE credit_account.type = 'REVENUE'
```

**For Expenses:**
```sql
-- Debit: Expense Account (expense category)
-- Credit: Asset Account (money going out)
SELECT SUM(amount) FROM ledger_entries
WHERE debit_account.type = 'EXPENSE'
```

**For Shared Expenses (Payer):**
```sql
-- Debit: Expense Account (my portion)
-- Debit: Receivables Account (amount owed to me)
-- Credit: Asset Account (total paid)
```

**For Shared Expenses (Acceptor):**
```sql
-- Debit: Expense Account (my portion)
-- Credit: Payables Account (amount I owe)
```

---

## Recommended Solution

### New Function: calculate_cash_flow()

**Data Source:** `ledger_entries` table

**Logic:**
1. Join with `chart_of_accounts` to get account types
2. Sum amounts where debit account is EXPENSE (expenses)
3. Sum amounts where credit account is REVENUE (income)
4. Group by month
5. Return aggregated results

**Benefits:**
- ✅ No duplication
- ✅ Accurate for shared expenses
- ✅ Follows DDD architecture
- ✅ Single source of truth
- ✅ Easier to maintain

---

## Implementation Plan

### Step 1: Create New Function

Create `calculate_cash_flow()` that uses ledger_entries:

```sql
CREATE OR REPLACE FUNCTION public.calculate_cash_flow(
    p_user_id UUID,
    p_year INTEGER
) RETURNS TABLE (
    month INTEGER,
    income NUMERIC,
    expense NUMERIC
)
```

### Step 2: Test with Real Data

Compare results between old and new functions to validate accuracy

### Step 3: Update Frontend

Replace calls to `get_monthly_cashflow()` with `calculate_cash_flow()`

### Step 4: Deprecate Old Function

Mark `get_monthly_cashflow()` as deprecated or remove it

---

## Expected Impact

### Before Fix
- ❌ Shared expenses counted multiple times
- ❌ Cash flow shows R$ 950 instead of R$ 95
- ❌ Inaccurate financial reports
- ❌ User confusion

### After Fix
- ✅ Each expense counted exactly once
- ✅ Cash flow shows correct R$ 95
- ✅ Accurate financial reports
- ✅ Reliable data for decision-making

---

## Testing Strategy

### Test Cases

1. **Simple Income:** Single revenue transaction
2. **Simple Expense:** Single expense transaction
3. **Shared Expense (Payer):** Verify only my portion is counted
4. **Shared Expense (Acceptor):** Verify only my portion is counted
5. **Mixed Transactions:** Combination of all types
6. **Multiple Months:** Verify correct grouping
7. **Edge Cases:** Zero amounts, negative adjustments

### Validation Queries

```sql
-- Compare old vs new
SELECT 
    old.month,
    old.expense as old_expense,
    new.expense as new_expense,
    old.expense - new.expense as difference
FROM get_monthly_cashflow(user_id, 2024) old
JOIN calculate_cash_flow(user_id, 2024) new ON old.month = new.month;
```

---

## Conclusion

The current cash flow calculation is fundamentally flawed because it uses the transactions table instead of the ledger. This causes duplication for shared expenses and violates the DDD principle of having a single source of truth.

**Recommendation:** Implement `calculate_cash_flow()` using ledger_entries as the data source. This will eliminate duplication and provide accurate financial reporting.

---

**Audit Completed By:** Kiro AI  
**Date:** 2024-12-24  
**Status:** Ready for Task 9.2 (Create new function)

