# RPC Functions Audit Report

**Date:** 2024-12-24  
**Task:** 5.1 Audit all RPC functions  
**Status:** Complete

## Executive Summary

This audit identifies RPC functions used by the frontend, validates their signatures, and documents any issues causing HTTP 400 errors.

---

## Critical RPCs (Used by Frontend)

### 1. create_shared_transaction_v2

**Location:** `producao/supabase/migrations/20251221_shared_rpc_functions_v2.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.create_shared_transaction_v2(
    p_description TEXT,
    p_amount NUMERIC,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_shared_splits JSONB,
    p_trip_id UUID DEFAULT NULL,
    p_installment_data JSONB DEFAULT NULL
) RETURNS JSONB
```

**Issues Found:**
- ❌ **Missing `p_notes` parameter** - Frontend may be sending this parameter
- ✅ All other parameters match expected types
- ✅ Returns JSONB (correct)
- ✅ Has proper error handling

**Recommendation:**
Add optional `p_notes TEXT DEFAULT NULL` parameter to match frontend expectations.

---

### 2. respond_to_shared_request_v2

**Location:** `producao/supabase/migrations/20251221_shared_rpc_functions_v2.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.respond_to_shared_request_v2(
    p_request_id UUID,
    p_status TEXT,
    p_account_id UUID DEFAULT NULL
) RETURNS JSONB
```

**Issues Found:**
- ✅ All parameters correct
- ✅ Returns JSONB (correct)
- ✅ Has proper validation
- ✅ Has proper error handling

**Status:** ✅ No issues found

---

### 3. sync_shared_transaction_v2

**Location:** `producao/supabase/migrations/20251221_shared_rpc_functions_v2.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.sync_shared_transaction_v2(
    p_transaction_id UUID
) RETURNS JSONB
```

**Issues Found:**
- ✅ All parameters correct
- ✅ Returns JSONB (correct)
- ✅ Has proper error handling

**Status:** ✅ No issues found

---

### 4. get_shared_requests_v4

**Location:** `producao/supabase/migrations/20251221_shared_rpc_functions_v2.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.get_shared_requests_v4()
RETURNS TABLE (
    id UUID,
    transaction_id UUID,
    requester_id UUID,
    requester_name TEXT,
    requester_email TEXT,
    assigned_amount NUMERIC,
    status TEXT,
    created_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    tx_description TEXT,
    tx_amount NUMERIC,
    tx_currency TEXT,
    tx_date DATE,
    tx_category TEXT,
    tx_observation TEXT,
    tx_trip_id UUID
)
```

**Issues Found:**
- ✅ No parameters (correct)
- ✅ Returns TABLE with all expected columns
- ✅ Uses auth.uid() for security

**Status:** ✅ No issues found

---

### 5. create_transaction

**Location:** `producao/supabase/migrations/20260127_consolidacao_final_rpc_e_balance.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_observation TEXT DEFAULT NULL
) RETURNS UUID
```

**Issues Found:**
- ⚠️ **Missing `notes` parameter** - May cause issues if frontend sends it
- ✅ All other parameters correct
- ✅ Returns UUID (correct)

**Recommendation:**
Add optional `p_notes TEXT DEFAULT NULL` parameter.

---

### 6. update_transaction

**Location:** `producao/supabase/migrations/20260127_consolidacao_final_rpc_e_balance.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.update_transaction(
    p_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_observation TEXT DEFAULT NULL
) RETURNS BOOLEAN
```

**Issues Found:**
- ⚠️ **Missing `notes` parameter** - May cause issues if frontend sends it
- ✅ All other parameters correct
- ✅ Returns BOOLEAN (correct)

**Recommendation:**
Add optional `p_notes TEXT DEFAULT NULL` parameter.

---

### 7. get_monthly_cashflow

**Location:** `producao/supabase/migrations/20260127_consolidacao_final_rpc_e_balance.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.get_monthly_cashflow(
    p_year INT,
    p_user_id UUID
) RETURNS TABLE (
    month INT,
    income NUMERIC,
    expense NUMERIC
)
```

**Issues Found:**
- ✅ All parameters correct
- ✅ Returns TABLE with expected columns
- ⚠️ **May have duplication issue** - Uses transactions table instead of ledger

**Recommendation:**
Refactor to use ledger_entries as source of truth (Phase 5).

---

### 8. get_account_totals

**Location:** `producao/supabase/migrations/20260127_consolidacao_final_rpc_e_balance.sql`

**Signature:**
```sql
CREATE OR REPLACE FUNCTION public.get_account_totals(
    p_user_id UUID
) RETURNS TABLE (
    account_id UUID,
    calculated_balance NUMERIC
)
```

**Issues Found:**
- ✅ All parameters correct
- ✅ Returns TABLE with expected columns
- ℹ️ **Note:** Backend maintains balance automatically via trigger

**Status:** ✅ No issues found

---

## Trip Management RPCs

### 9. create_trip (MISSING!)

**Expected Signature:**
```sql
CREATE OR REPLACE FUNCTION public.create_trip(
    p_name TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_description TEXT DEFAULT NULL
) RETURNS UUID
```

**Issues Found:**
- ❌ **FUNCTION DOES NOT EXIST** - This is causing HTTP 400 errors
- Frontend is calling this function but it doesn't exist in the database

**Recommendation:**
Create this function immediately (Task 7.2).

---

## Summary of Issues

### Critical Issues (HTTP 400 Errors)

1. ❌ **create_trip function missing** - Causes immediate failures
   - **Impact:** HIGH - Users cannot create trips
   - **Fix:** Create function (Task 7.2)

### Medium Priority Issues

2. ⚠️ **Missing `notes` parameter in multiple functions**
   - **Affected Functions:**
     - `create_shared_transaction_v2`
     - `create_transaction`
     - `update_transaction`
   - **Impact:** MEDIUM - May cause HTTP 400 if frontend sends this parameter
   - **Fix:** Add optional `p_notes TEXT DEFAULT NULL` parameter

3. ⚠️ **Cash flow calculation uses transactions table**
   - **Affected Functions:**
     - `get_monthly_cashflow`
   - **Impact:** MEDIUM - May show duplicated values for shared expenses
   - **Fix:** Refactor to use ledger_entries (Phase 5)

### Low Priority Issues

4. ℹ️ **No issues** - Most RPCs are correctly implemented

---

## Recommendations by Priority

### Immediate (Phase 3)

1. **Create `create_trip` function** (Task 7.2)
   - This is blocking users from creating trips
   - Should be implemented immediately

2. **Add `notes` parameter to shared transaction RPCs** (Task 5.2)
   - Add to `create_shared_transaction_v2`
   - Add to `create_transaction`
   - Add to `update_transaction`

### High Priority (Phase 5)

3. **Refactor cash flow calculation** (Task 9.2)
   - Move from transactions table to ledger_entries
   - Eliminate duplication in shared expenses

### Medium Priority (Phase 6)

4. **Create backend RPCs for all calculations** (Task 11.2)
   - `get_account_balance()`
   - `get_monthly_summary()`
   - `get_category_totals()`

---

## Frontend Integration Checklist

### Shared Transactions
- ✅ `create_shared_transaction_v2` - Working (needs notes param)
- ✅ `respond_to_shared_request_v2` - Working
- ✅ `sync_shared_transaction_v2` - Working
- ✅ `get_shared_requests_v4` - Working

### Normal Transactions
- ⚠️ `create_transaction` - Working (needs notes param)
- ⚠️ `update_transaction` - Working (needs notes param)

### Trips
- ❌ `create_trip` - **MISSING - CRITICAL**

### Reports
- ⚠️ `get_monthly_cashflow` - Working (has duplication issue)
- ✅ `get_account_totals` - Working

---

## Next Steps

1. ✅ **Complete this audit** (Task 5.1)
2. ⏭️ **Fix create_shared_transaction_v2** (Task 5.2)
   - Add `p_notes` parameter
3. ⏭️ **Fix respond_to_shared_request_v2** (Task 5.3)
   - Already correct, no changes needed
4. ⏭️ **Fix sync_shared_transaction_v2** (Task 5.4)
   - Already correct, no changes needed
5. ⏭️ **Create create_trip function** (Task 7.2)
   - Critical missing function

---

**Audit Completed By:** Kiro AI  
**Date:** 2024-12-24  
**Status:** Ready for Task 5.2 (Fix RPCs)
