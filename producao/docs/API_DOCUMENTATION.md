# Financial System - API Documentation

**Date:** 2024-12-24  
**Status:** Complete API Reference  
**Purpose:** Document all RPC functions, parameters, and usage examples

---

## Table of Contents

1. [Account Management](#account-management)
2. [Transaction Management](#transaction-management)
3. [Shared Transactions](#shared-transactions)
4. [Financial Calculations](#financial-calculations)
5. [Ledger Operations](#ledger-operations)
6. [Trip Management](#trip-management)
7. [System Health](#system-health)
8. [Error Handling](#error-handling)

---

## Account Management

### get_account_balance

Calculate account balance from ledger entries.

**Signature:**
```sql
get_account_balance(
  p_user_id UUID,
  p_account_id UUID
) RETURNS NUMERIC
```

**Parameters:**
- `p_user_id` (UUID, required): User ID for authorization
- `p_account_id` (UUID, required): Account ID to get balance for

**Returns:**
- `NUMERIC`: Current account balance

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_account_balance', {
  p_user_id: userId,
  p_account_id: accountId
});

console.log(`Balance: R$ ${data}`);
```

**Response:**
```json
1250.50
```

**Errors:**
- Returns `0` if account not found
- Returns `0` if user doesn't own account

**Notes:**
- Balance is calculated from ledger_entries (source of truth)
- Includes all non-deleted ledger entries
- Uses double-entry bookkeeping

---

## Transaction Management

### create_transaction

Create a simple transaction (income or expense).

**Signature:**
```sql
-- Not exposed as RPC, use direct INSERT
INSERT INTO transactions (...)
```

**Parameters:**
- `user_id` (UUID, required): Transaction owner
- `account_id` (UUID, required): Account for transaction
- `category_id` (UUID, optional): Transaction category
- `amount` (NUMERIC, required): Transaction amount (must be > 0)
- `type` (TEXT, required): 'income' or 'expense'
- `description` (TEXT, required): Transaction description
- `notes` (TEXT, optional): Additional notes
- `date` (DATE, required): Transaction date

**Example:**
```typescript
const { data, error } = await supabase
  .from('transactions')
  .insert({
    user_id: userId,
    account_id: accountId,
    category_id: categoryId,
    amount: 100.00,
    type: 'expense',
    description: 'Groceries',
    notes: 'Weekly shopping',
    date: '2024-12-24'
  })
  .select()
  .single();
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "account_id": "uuid",
  "category_id": "uuid",
  "amount": 100.00,
  "type": "expense",
  "description": "Groceries",
  "notes": "Weekly shopping",
  "date": "2024-12-24",
  "created_at": "2024-12-24T10:00:00Z"
}
```

**Side Effects:**
- Automatically creates ledger entries via trigger
- For expense: Debit Expense account
- For income: Credit Income account

---

## Shared Transactions

### create_shared_transaction_v2

Create a shared expense with multiple participants.

**Signature:**
```sql
create_shared_transaction_v2(
  p_user_id UUID,
  p_account_id UUID,
  p_category_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_notes TEXT DEFAULT NULL,
  p_date DATE,
  p_participants JSONB
) RETURNS UUID
```

**Parameters:**
- `p_user_id` (UUID, required): Payer user ID
- `p_account_id` (UUID, required): Payer's account
- `p_category_id` (UUID, optional): Transaction category
- `p_amount` (NUMERIC, required): Total transaction amount
- `p_description` (TEXT, required): Transaction description
- `p_notes` (TEXT, optional): Additional notes
- `p_date` (DATE, required): Transaction date
- `p_participants` (JSONB, required): Array of participants with shares

**Participants Format:**
```json
[
  {
    "user_id": "uuid",
    "share_amount": 50.00
  },
  {
    "user_id": "uuid",
    "share_amount": 50.00
  }
]
```

**Example:**
```typescript
const { data, error } = await supabase.rpc('create_shared_transaction_v2', {
  p_user_id: userId,
  p_account_id: accountId,
  p_category_id: categoryId,
  p_amount: 100.00,
  p_description: 'Dinner with friends',
  p_notes: 'Italian restaurant',
  p_date: '2024-12-24',
  p_participants: [
    { user_id: userId, share_amount: 50.00 },
    { user_id: friendId, share_amount: 50.00 }
  ]
});

console.log(`Shared transaction created: ${data}`);
```

**Response:**
```json
"uuid-of-shared-transaction"
```

**Side Effects:**
- Creates transaction for payer
- Creates shared_transaction record
- Creates participant records
- Creates ledger entries:
  - Debit Expense (payer's share)
  - Debit Receivables (others' shares)

**Errors:**
- `400`: Invalid parameters
- `400`: Participants shares don't sum to total amount
- `400`: Payer not in participants list
- `403`: User doesn't own account

---

### respond_to_shared_request_v2

Accept or reject a shared transaction request.

**Signature:**
```sql
respond_to_shared_request_v2(
  p_user_id UUID,
  p_shared_transaction_id UUID,
  p_account_id UUID,
  p_accept BOOLEAN
) RETURNS UUID
```

**Parameters:**
- `p_user_id` (UUID, required): Responding user ID
- `p_shared_transaction_id` (UUID, required): Shared transaction ID
- `p_account_id` (UUID, required): User's account for payment
- `p_accept` (BOOLEAN, required): true to accept, false to reject

**Example (Accept):**
```typescript
const { data, error } = await supabase.rpc('respond_to_shared_request_v2', {
  p_user_id: userId,
  p_shared_transaction_id: sharedTxId,
  p_account_id: accountId,
  p_accept: true
});

console.log(`Mirror transaction created: ${data}`);
```

**Response (Accept):**
```json
"uuid-of-mirror-transaction"
```

**Response (Reject):**
```json
null
```

**Side Effects (Accept):**
- Creates mirror transaction for acceptor
- Updates participant status to 'accepted'
- Creates ledger entries:
  - Debit Expense (acceptor's share)
  - Credit Payables (amount owed to payer)

**Side Effects (Reject):**
- Updates participant status to 'rejected'
- No transaction or ledger entries created

**Errors:**
- `400`: User is not a participant
- `400`: Already responded
- `403`: User doesn't own account

---

### sync_shared_transaction_v2

Synchronize shared transaction data between participants.

**Signature:**
```sql
sync_shared_transaction_v2(
  p_user_id UUID,
  p_shared_transaction_id UUID
) RETURNS BOOLEAN
```

**Parameters:**
- `p_user_id` (UUID, required): User ID
- `p_shared_transaction_id` (UUID, required): Shared transaction ID

**Example:**
```typescript
const { data, error } = await supabase.rpc('sync_shared_transaction_v2', {
  p_user_id: userId,
  p_shared_transaction_id: sharedTxId
});

console.log(`Sync successful: ${data}`);
```

**Response:**
```json
true
```

**Side Effects:**
- Updates shared transaction status
- Synchronizes participant statuses
- Updates mirror transactions if needed

---

## Financial Calculations

### calculate_cash_flow

Calculate income, expenses, and net cash flow for a date range.

**Signature:**
```sql
calculate_cash_flow(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  income NUMERIC,
  expenses NUMERIC,
  net NUMERIC
)
```

**Parameters:**
- `p_user_id` (UUID, required): User ID
- `p_start_date` (DATE, required): Start date (inclusive)
- `p_end_date` (DATE, required): End date (inclusive)

**Example:**
```typescript
const { data, error } = await supabase.rpc('calculate_cash_flow', {
  p_user_id: userId,
  p_start_date: '2024-12-01',
  p_end_date: '2024-12-31'
});

console.log(`Income: R$ ${data[0].income}`);
console.log(`Expenses: R$ ${data[0].expenses}`);
console.log(`Net: R$ ${data[0].net}`);
```

**Response:**
```json
[
  {
    "income": 5000.00,
    "expenses": 3500.00,
    "net": 1500.00
  }
]
```

**Notes:**
- Uses ledger_entries as source (single source of truth)
- Eliminates duplication from shared transactions
- Includes only non-deleted entries
- Income = sum of credit entries to income accounts
- Expenses = sum of debit entries to expense accounts
- Net = income - expenses

**Errors:**
- Returns `0` for all values if no transactions in range

---

### get_monthly_summary

Get monthly financial summary with income, expenses, and balance.

**Signature:**
```sql
get_monthly_summary(
  p_user_id UUID,
  p_year INTEGER,
  p_month INTEGER
) RETURNS TABLE (
  income NUMERIC,
  expenses NUMERIC,
  net NUMERIC,
  starting_balance NUMERIC,
  ending_balance NUMERIC
)
```

**Parameters:**
- `p_user_id` (UUID, required): User ID
- `p_year` (INTEGER, required): Year (e.g., 2024)
- `p_month` (INTEGER, required): Month (1-12)

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_monthly_summary', {
  p_user_id: userId,
  p_year: 2024,
  p_month: 12
});

console.log(`Monthly Summary for Dec 2024:`);
console.log(`Income: R$ ${data[0].income}`);
console.log(`Expenses: R$ ${data[0].expenses}`);
console.log(`Net: R$ ${data[0].net}`);
console.log(`Starting Balance: R$ ${data[0].starting_balance}`);
console.log(`Ending Balance: R$ ${data[0].ending_balance}`);
```

**Response:**
```json
[
  {
    "income": 5000.00,
    "expenses": 3500.00,
    "net": 1500.00,
    "starting_balance": 10000.00,
    "ending_balance": 11500.00
  }
]
```

**Notes:**
- Uses ledger_entries for calculations
- starting_balance = sum of all entries before month start
- ending_balance = starting_balance + net

---

### get_category_totals

Get total spending/income by category for a date range.

**Signature:**
```sql
get_category_totals(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
) RETURNS TABLE (
  category_id UUID,
  category_name TEXT,
  total_amount NUMERIC,
  transaction_count INTEGER
)
```

**Parameters:**
- `p_user_id` (UUID, required): User ID
- `p_start_date` (DATE, required): Start date (inclusive)
- `p_end_date` (DATE, required): End date (inclusive)

**Example:**
```typescript
const { data, error } = await supabase.rpc('get_category_totals', {
  p_user_id: userId,
  p_start_date: '2024-12-01',
  p_end_date: '2024-12-31'
});

data.forEach(category => {
  console.log(`${category.category_name}: R$ ${category.total_amount} (${category.transaction_count} transactions)`);
});
```

**Response:**
```json
[
  {
    "category_id": "uuid",
    "category_name": "Groceries",
    "total_amount": 1200.00,
    "transaction_count": 15
  },
  {
    "category_id": "uuid",
    "category_name": "Transportation",
    "total_amount": 500.00,
    "transaction_count": 8
  }
]
```

**Notes:**
- Uses ledger_entries for calculations
- Groups by category
- Orders by total_amount DESC

---

## Ledger Operations

### reconcile_ledger_entries

Identify and fix ledger integrity issues.

**Signature:**
```sql
reconcile_ledger_entries() RETURNS TABLE (
  action TEXT,
  transaction_id UUID,
  details TEXT
)
```

**Parameters:**
- None (operates on entire ledger)

**Example:**
```typescript
const { data, error } = await supabase.rpc('reconcile_ledger_entries');

data.forEach(result => {
  console.log(`${result.action}: ${result.details}`);
});
```

**Response:**
```json
[
  {
    "action": "FIXED_DUPLICATE",
    "transaction_id": "uuid",
    "details": "Removed 2 duplicate entries"
  },
  {
    "action": "FIXED_ORPHAN",
    "transaction_id": "uuid",
    "details": "Deleted transaction with NULL account_id"
  }
]
```

**Actions Performed:**
- Identifies duplicate ledger entries
- Removes duplicates (keeps oldest)
- Identifies orphaned transactions
- Deletes invalid orphans (NULL account_id)
- Identifies unbalanced entries
- Attempts to balance entries

**Notes:**
- Should be run during maintenance windows
- Creates audit log of all changes
- Safe to run multiple times (idempotent)

---

### validate_ledger_integrity

Check ledger integrity without making changes.

**Signature:**
```sql
validate_ledger_integrity() RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  issue_count INTEGER,
  details JSONB
)
```

**Parameters:**
- None

**Example:**
```typescript
const { data, error } = await supabase.rpc('validate_ledger_integrity');

data.forEach(check => {
  console.log(`${check.check_name}: ${check.status} (${check.issue_count} issues)`);
});
```

**Response:**
```json
[
  {
    "check_name": "ledger_balance",
    "status": "PASS",
    "issue_count": 0,
    "details": {}
  },
  {
    "check_name": "orphaned_transactions",
    "status": "PASS",
    "issue_count": 0,
    "details": {}
  }
]
```

**Checks Performed:**
- Ledger balance (sum should be 0)
- Orphaned transactions
- Duplicate entries
- Unbalanced transactions
- NULL account_id transactions

---

## Trip Management

### create_trip

Create a new trip for expense tracking.

**Signature:**
```sql
create_trip(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_budget NUMERIC
) RETURNS UUID
```

**Parameters:**
- `p_user_id` (UUID, required): Trip owner
- `p_name` (TEXT, required): Trip name
- `p_description` (TEXT, optional): Trip description
- `p_start_date` (DATE, required): Trip start date
- `p_end_date` (DATE, required): Trip end date (must be >= start_date)
- `p_budget` (NUMERIC, optional): Trip budget

**Example:**
```typescript
const { data, error } = await supabase.rpc('create_trip', {
  p_user_id: userId,
  p_name: 'Europe Vacation',
  p_description: 'Summer trip to Europe',
  p_start_date: '2024-07-01',
  p_end_date: '2024-07-15',
  p_budget: 5000.00
});

console.log(`Trip created: ${data}`);
```

**Response:**
```json
"uuid-of-trip"
```

**Notes:**
- Transactions can be associated with trip via trip_id
- Trip status defaults to 'planning'
- Budget is optional

---

## System Health

### daily_health_check

Comprehensive system health check.

**Signature:**
```sql
daily_health_check() RETURNS TABLE (
  check_name TEXT,
  status TEXT,
  issue_count INTEGER,
  details JSONB,
  recommendation TEXT
)
```

**Parameters:**
- None

**Example:**
```typescript
const { data, error } = await supabase.rpc('daily_health_check');

const failed = data.filter(check => check.status === 'FAIL');
if (failed.length > 0) {
  console.error('Health check failed!');
  failed.forEach(check => {
    console.error(`${check.check_name}: ${check.recommendation}`);
  });
}
```

**Response:**
```json
[
  {
    "check_name": "unbalanced_entries",
    "status": "PASS",
    "issue_count": 0,
    "details": {},
    "recommendation": null
  },
  {
    "check_name": "orphaned_transactions",
    "status": "PASS",
    "issue_count": 0,
    "details": {},
    "recommendation": null
  },
  {
    "check_name": "duplicate_entries",
    "status": "PASS",
    "issue_count": 0,
    "details": {},
    "recommendation": null
  },
  {
    "check_name": "incorrect_shared_transactions",
    "status": "PASS",
    "issue_count": 0,
    "details": {},
    "recommendation": null
  },
  {
    "check_name": "null_account_id",
    "status": "PASS",
    "issue_count": 0,
    "details": {},
    "recommendation": null
  }
]
```

**Checks Performed:**
1. **unbalanced_entries**: Sum of ledger entries should be 0
2. **orphaned_transactions**: Transactions without ledger entries
3. **duplicate_entries**: Duplicate ledger entries
4. **incorrect_shared_transactions**: Shared transactions with wrong accounting
5. **null_account_id**: Transactions with NULL account_id

**Recommendations:**
- If any check fails, recommendation field contains action to take
- Typically: "Run reconcile_ledger_entries()"

---

## Error Handling

### Common Error Codes

**400 Bad Request:**
- Missing required parameters
- Invalid parameter types
- Business rule violation (e.g., amount <= 0)

**403 Forbidden:**
- User doesn't own resource
- Insufficient permissions

**404 Not Found:**
- Resource doesn't exist
- Invalid ID

**500 Internal Server Error:**
- Database error
- Unexpected exception

### Error Response Format

```json
{
  "error": {
    "message": "Error description",
    "details": "Additional details",
    "hint": "Suggestion for fixing",
    "code": "ERROR_CODE"
  }
}
```

### Example Error Handling

```typescript
const { data, error } = await supabase.rpc('create_shared_transaction_v2', {
  // ... parameters
});

if (error) {
  console.error('Error:', error.message);
  
  switch (error.code) {
    case '23503': // Foreign key violation
      console.error('Invalid account or user ID');
      break;
    case '23514': // Check constraint violation
      console.error('Invalid parameter value');
      break;
    case 'PGRST116': // RPC not found
      console.error('Function not found - check spelling');
      break;
    default:
      console.error('Unexpected error:', error);
  }
}
```

### Best Practices

1. **Always check for errors:**
```typescript
if (error) {
  // Handle error
  return;
}
// Use data
```

2. **Validate parameters before calling:**
```typescript
if (amount <= 0) {
  throw new Error('Amount must be positive');
}
```

3. **Use TypeScript types:**
```typescript
import { Database } from './database.types';

type Transaction = Database['public']['Tables']['transactions']['Row'];
```

4. **Handle edge cases:**
```typescript
const balance = data ?? 0; // Default to 0 if null
```

5. **Log errors for debugging:**
```typescript
if (error) {
  console.error('RPC Error:', {
    function: 'create_shared_transaction_v2',
    parameters: { /* ... */ },
    error: error
  });
}
```

---

## Rate Limits

**Current Limits:**
- No explicit rate limits on RPCs
- Database connection pool: 15 connections
- Recommended: < 100 requests/second per user

**Best Practices:**
- Batch operations when possible
- Cache frequently accessed data
- Use pagination for large result sets

---

## Versioning

**Current Version:** v2  
**Deprecated Functions:**
- `get_monthly_cashflow()` - Use `calculate_cash_flow()` instead
- `create_shared_transaction()` - Use `create_shared_transaction_v2()` instead

**Migration Guide:**
See `FRONTEND_CALCULATIONS_AUDIT.md` for migration instructions.

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2024-12-24  
**Next Review:** When adding new RPCs or changing signatures
