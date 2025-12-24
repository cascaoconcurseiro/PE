# Financial System - Aggregate Roots Documentation

**Date:** 2024-12-24  
**Status:** Architecture Documentation  
**Purpose:** Define and document all aggregate roots and their relationships

---

## Overview

This document describes the Domain-Driven Design (DDD) aggregate roots in the financial system, their invariants, operations, and relationships.

---

## Aggregate Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                         Aggregate Roots                          │
└─────────────────────────────────────────────────────────────────┘

    ┌──────────┐
    │   User   │ (External - Auth Context)
    └────┬─────┘
         │ owns
         ├──────────────┬──────────────┬──────────────┐
         │              │              │              │
         ▼              ▼              ▼              ▼
    ┌─────────┐   ┌──────────────┐  ┌────────┐  ┌──────────┐
    │ Account │   │ Transaction  │  │  Trip  │  │  Report  │
    └────┬────┘   └──────┬───────┘  └───┬────┘  └──────────┘
         │               │              │
         │ referenced by │              │ groups
         │               │              │
         │               ▼              │
         │        ┌─────────────┐       │
         └───────►│LedgerEntry  │◄──────┘
                  └─────────────┘
                         ▲
                         │ created by
                         │
                  ┌──────────────────┐
                  │SharedTransaction │
                  └──────────────────┘
```

---

## 1. Account Aggregate

### Aggregate Root
**Account**

### Entities
- Account (root)

### Value Objects
- AccountType
- Currency
- AccountMetadata

### Schema
```sql
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit_card', 'cash', 'investment')),
  currency TEXT NOT NULL DEFAULT 'BRL',
  initial_balance NUMERIC(10,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE(user_id, name, deleted_at)
);
```

### Invariants

**1. Account Ownership**
- Every account must belong to a user
- User must exist in auth.users
- Enforced by: Foreign key constraint

**2. Unique Account Name**
- Account name must be unique per user (excluding deleted)
- Enforced by: Unique constraint on (user_id, name, deleted_at)

**3. Valid Account Type**
- Type must be one of: checking, savings, credit_card, cash, investment
- Enforced by: CHECK constraint

**4. Active State**
- Deleted accounts have deleted_at timestamp
- Deleted accounts cannot be used for new transactions
- Enforced by: Application logic + triggers

**5. Currency Consistency**
- All transactions for an account must use same currency
- Currently only BRL supported
- Enforced by: Application logic

### Operations

**Create Account**
```sql
INSERT INTO accounts (user_id, name, type, initial_balance)
VALUES ($1, $2, $3, $4)
RETURNING *;
```

**Update Account**
```sql
UPDATE accounts
SET name = $1, metadata = $2, updated_at = NOW()
WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL;
```

**Archive Account**
```sql
UPDATE accounts
SET deleted_at = NOW(), is_active = false
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
```

**Get Account Balance**
```sql
-- Delegates to Ledger Context
SELECT * FROM get_account_balance($1, $2);
```

### Events Generated

**AccountCreated**
```json
{
  "event_type": "AccountCreated",
  "aggregate_id": "account_id",
  "user_id": "user_id",
  "data": {
    "name": "Checking Account",
    "type": "checking",
    "initial_balance": 1000.00
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**AccountUpdated**
```json
{
  "event_type": "AccountUpdated",
  "aggregate_id": "account_id",
  "user_id": "user_id",
  "data": {
    "name": "New Name",
    "changes": ["name"]
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**AccountArchived**
```json
{
  "event_type": "AccountArchived",
  "aggregate_id": "account_id",
  "user_id": "user_id",
  "timestamp": "2024-12-24T10:00:00Z"
}
```

---

## 2. Transaction Aggregate

### Aggregate Root
**Transaction**

### Entities
- Transaction (root)

### Value Objects
- TransactionType
- Money
- InstallmentInfo
- TransactionMetadata

### Schema
```sql
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  account_id UUID REFERENCES accounts(id),
  category_id UUID REFERENCES categories(id),
  amount NUMERIC(10,2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  description TEXT,
  notes TEXT,
  date DATE NOT NULL,
  is_recurring BOOLEAN DEFAULT false,
  installment_number INTEGER,
  total_installments INTEGER,
  parent_transaction_id UUID REFERENCES transactions(id),
  payer_id TEXT,
  trip_id UUID REFERENCES trips(id),
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (
    (installment_number IS NULL AND total_installments IS NULL) OR
    (installment_number > 0 AND total_installments > 0 AND installment_number <= total_installments)
  )
);
```

### Invariants

**1. Transaction Ownership**
- Every transaction must belong to a user
- Enforced by: Foreign key constraint + NOT NULL

**2. Valid Account Reference**
- account_id must reference existing account (or be NULL for shared pending)
- Enforced by: Foreign key constraint

**3. Positive Amount**
- Amount must be greater than 0
- Enforced by: CHECK constraint

**4. Valid Transaction Type**
- Type must be: income, expense, or transfer
- Enforced by: CHECK constraint

**5. Installment Consistency**
- If installment_number exists, total_installments must exist
- installment_number must be <= total_installments
- installment_number must be > 0
- Enforced by: CHECK constraint

**6. Parent Transaction Reference**
- parent_transaction_id must reference existing transaction (if set)
- Used for installment grouping
- Enforced by: Foreign key constraint

**7. Ledger Synchronization**
- Every transaction must create ledger entries
- Enforced by: Trigger `sync_transaction_to_ddd_ledger`

### Operations

**Create Simple Transaction**
```sql
INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;
-- Trigger automatically creates ledger entries
```

**Create Installment Transaction**
```sql
-- Create parent transaction
INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date, total_installments)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING id;

-- Create installment transactions
INSERT INTO transactions (user_id, account_id, category_id, amount, type, description, date, 
                         installment_number, total_installments, parent_transaction_id)
SELECT $1, $2, $3, $4, $5, $6, $7 + (n - 1) * INTERVAL '1 month', n, $8, parent_id
FROM generate_series(1, $8) n;
```

**Update Transaction**
```sql
UPDATE transactions
SET description = $1, notes = $2, updated_at = NOW()
WHERE id = $3 AND user_id = $4 AND deleted_at IS NULL;
-- Trigger automatically updates ledger entries
```

**Delete Transaction**
```sql
UPDATE transactions
SET deleted_at = NOW()
WHERE id = $1 AND user_id = $2 AND deleted_at IS NULL;
-- Trigger automatically soft-deletes ledger entries
```

### Events Generated

**TransactionCreated**
```json
{
  "event_type": "TransactionCreated",
  "aggregate_id": "transaction_id",
  "user_id": "user_id",
  "data": {
    "account_id": "account_id",
    "amount": 100.00,
    "type": "expense",
    "description": "Groceries",
    "date": "2024-12-24"
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**TransactionUpdated**
```json
{
  "event_type": "TransactionUpdated",
  "aggregate_id": "transaction_id",
  "user_id": "user_id",
  "data": {
    "changes": ["description", "notes"]
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**TransactionDeleted**
```json
{
  "event_type": "TransactionDeleted",
  "aggregate_id": "transaction_id",
  "user_id": "user_id",
  "timestamp": "2024-12-24T10:00:00Z"
}
```

---

## 3. LedgerEntry Aggregate

### Aggregate Root
**LedgerEntry**

### Entities
- LedgerEntry (root)

### Value Objects
- EntryType (debit/credit)
- Money

### Schema
```sql
CREATE TABLE ledger_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  account_id UUID NOT NULL REFERENCES accounts(id),
  amount NUMERIC(10,2) NOT NULL,
  entry_type TEXT NOT NULL CHECK (entry_type IN ('debit', 'credit')),
  description TEXT,
  entry_date DATE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (
    (entry_type = 'debit' AND amount > 0) OR
    (entry_type = 'credit' AND amount < 0)
  )
);
```

### Invariants

**1. Double-Entry Bookkeeping**
- Every transaction must have at least 2 ledger entries
- Sum of all ledger entries must equal 0
- Enforced by: Trigger logic + validation functions

**2. Entry Type Consistency**
- Debit entries must have positive amounts
- Credit entries must have negative amounts
- Enforced by: CHECK constraint

**3. Immutability**
- Ledger entries cannot be updated
- Only soft delete allowed (deleted_at)
- Enforced by: No UPDATE operations, only INSERT and soft DELETE

**4. Transaction Reference**
- Every ledger entry must reference a transaction
- Enforced by: Foreign key constraint + NOT NULL

**5. Account Reference**
- Every ledger entry must reference an account
- Enforced by: Foreign key constraint + NOT NULL

**6. Balance Integrity**
- Sum of all non-deleted ledger entries must equal 0
- Enforced by: Validation function `validate_ledger_integrity()`

### Operations

**Create Ledger Entry (via Trigger)**
```sql
-- Automatically created by sync_transaction_to_ddd_ledger trigger
-- Not called directly by application
```

**Get Account Balance**
```sql
CREATE OR REPLACE FUNCTION get_account_balance(p_user_id UUID, p_account_id UUID)
RETURNS NUMERIC AS $$
  SELECT COALESCE(SUM(amount), 0)
  FROM ledger_entries
  WHERE account_id = p_account_id
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM accounts a
      WHERE a.id = p_account_id AND a.user_id = p_user_id
    );
$$ LANGUAGE SQL SECURITY DEFINER;
```

**Calculate Cash Flow**
```sql
CREATE OR REPLACE FUNCTION calculate_cash_flow(
  p_user_id UUID,
  p_start_date DATE,
  p_end_date DATE
)
RETURNS TABLE (
  income NUMERIC,
  expenses NUMERIC,
  net NUMERIC
) AS $$
  -- Implementation uses ledger_entries as source
  -- See CASH_FLOW_AUDIT.md for details
$$ LANGUAGE SQL SECURITY DEFINER;
```

**Reconcile Ledger**
```sql
CREATE OR REPLACE FUNCTION reconcile_ledger_entries()
RETURNS TABLE (
  action TEXT,
  transaction_id UUID,
  details TEXT
) AS $$
  -- Identifies and fixes ledger issues
  -- See LEDGER_SYNC_AUDIT.md for details
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Events Generated

**LedgerEntryCreated**
```json
{
  "event_type": "LedgerEntryCreated",
  "aggregate_id": "ledger_entry_id",
  "transaction_id": "transaction_id",
  "data": {
    "account_id": "account_id",
    "amount": 100.00,
    "entry_type": "debit",
    "entry_date": "2024-12-24"
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**LedgerBalanceChanged**
```json
{
  "event_type": "LedgerBalanceChanged",
  "account_id": "account_id",
  "data": {
    "old_balance": 1000.00,
    "new_balance": 1100.00,
    "change": 100.00
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**LedgerIntegrityIssue**
```json
{
  "event_type": "LedgerIntegrityIssue",
  "severity": "critical",
  "data": {
    "issue_type": "unbalanced_entries",
    "total_imbalance": 100.00,
    "affected_transactions": ["tx_id_1", "tx_id_2"]
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

---

## 4. SharedTransaction Aggregate

### Aggregate Root
**SharedTransaction**

### Entities
- SharedTransaction (root)
- SharedTransactionParticipant

### Value Objects
- SharingStatus
- SplitType
- ParticipantShare

### Schema
```sql
CREATE TABLE shared_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payer_id UUID NOT NULL REFERENCES auth.users(id),
  transaction_id UUID NOT NULL REFERENCES transactions(id),
  total_amount NUMERIC(10,2) NOT NULL,
  description TEXT,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  split_type TEXT NOT NULL CHECK (split_type IN ('equal', 'percentage', 'fixed_amount')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE shared_transaction_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_transaction_id UUID NOT NULL REFERENCES shared_transactions(id),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  share_amount NUMERIC(10,2) NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
  mirror_transaction_id UUID REFERENCES transactions(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Invariants

**1. Minimum Participants**
- Shared transaction must have at least 2 participants
- Enforced by: Application logic

**2. Share Sum Equals Total**
- Sum of all participant shares must equal total_amount
- Enforced by: Application logic + validation

**3. Payer is Participant**
- Payer must be one of the participants
- Enforced by: Application logic

**4. Mirror Transaction Creation**
- Accepted participants must have mirror_transaction_id
- Enforced by: RPC logic

**5. Status Consistency**
- Shared transaction status reflects participant statuses
- If all accepted → status = 'accepted'
- If any rejected → status = 'rejected'
- Enforced by: Application logic

**6. Special Accounting**
- Payer: Debit Expense + Debit Receivables
- Acceptor: Debit Expense + Credit Payables
- Enforced by: Specialized ledger functions

### Operations

**Create Shared Transaction**
```sql
CREATE OR REPLACE FUNCTION create_shared_transaction_v2(
  p_user_id UUID,
  p_account_id UUID,
  p_category_id UUID,
  p_amount NUMERIC,
  p_description TEXT,
  p_notes TEXT DEFAULT NULL,
  p_date DATE,
  p_participants JSONB
)
RETURNS UUID AS $$
  -- Creates transaction + shared_transaction + participants
  -- See RPC_AUDIT.md for details
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

**Accept Shared Transaction**
```sql
CREATE OR REPLACE FUNCTION respond_to_shared_request_v2(
  p_user_id UUID,
  p_shared_transaction_id UUID,
  p_account_id UUID,
  p_accept BOOLEAN
)
RETURNS UUID AS $$
  -- Creates mirror transaction for acceptor
  -- Updates participant status
  -- Creates special ledger entries (Payables)
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### Events Generated

**SharedTransactionCreated**
```json
{
  "event_type": "SharedTransactionCreated",
  "aggregate_id": "shared_transaction_id",
  "payer_id": "user_id",
  "data": {
    "total_amount": 100.00,
    "participants": [
      {"user_id": "user1", "share": 50.00},
      {"user_id": "user2", "share": 50.00}
    ]
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

**SharedTransactionAccepted**
```json
{
  "event_type": "SharedTransactionAccepted",
  "aggregate_id": "shared_transaction_id",
  "participant_id": "user_id",
  "data": {
    "mirror_transaction_id": "transaction_id",
    "share_amount": 50.00
  },
  "timestamp": "2024-12-24T10:00:00Z"
}
```

---

## 5. Trip Aggregate

### Aggregate Root
**Trip**

### Entities
- Trip (root)

### Value Objects
- TripStatus
- DateRange

### Schema
```sql
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  budget NUMERIC(10,2),
  status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'completed', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  CHECK (end_date >= start_date)
);
```

### Invariants

**1. Trip Ownership**
- Every trip must belong to a user
- Enforced by: Foreign key constraint + NOT NULL

**2. Valid Date Range**
- end_date must be >= start_date
- Enforced by: CHECK constraint

**3. Valid Status**
- Status must be: planning, active, completed, or cancelled
- Enforced by: CHECK constraint

**4. Transaction Association**
- Transactions can reference trip_id
- Trip groups related transactions
- Enforced by: Foreign key in transactions table

### Operations

**Create Trip**
```sql
CREATE OR REPLACE FUNCTION create_trip(
  p_user_id UUID,
  p_name TEXT,
  p_description TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_budget NUMERIC
)
RETURNS UUID AS $$
  INSERT INTO trips (user_id, name, description, start_date, end_date, budget, status)
  VALUES (p_user_id, p_name, p_description, p_start_date, p_end_date, p_budget, 'planning')
  RETURNING id;
$$ LANGUAGE SQL SECURITY DEFINER;
```

**Get Trip Expenses**
```sql
SELECT t.*, SUM(t.amount) as total_spent
FROM transactions t
WHERE t.trip_id = $1 AND t.user_id = $2 AND t.deleted_at IS NULL
GROUP BY t.id;
```

---

## Aggregate Interaction Patterns

### 1. Transaction → LedgerEntry (Event-Driven)

**Flow:**
1. Transaction created/updated/deleted
2. Trigger `sync_transaction_to_ddd_ledger` fires
3. Ledger entries created/updated automatically
4. Double-entry bookkeeping maintained

**Advantages:**
- Automatic synchronization
- Guaranteed consistency
- Audit trail

### 2. SharedTransaction → Transaction → LedgerEntry (Cascade)

**Flow:**
1. SharedTransaction created
2. Transaction created for payer
3. Trigger creates ledger entries (Expense + Receivables)
4. Participant accepts
5. Mirror transaction created for acceptor
6. Trigger creates ledger entries (Expense + Payables)

**Advantages:**
- Complex business logic encapsulated
- Correct accounting guaranteed
- No duplication in cash flow

### 3. Account → LedgerEntry (Query)

**Flow:**
1. Frontend requests account balance
2. RPC `get_account_balance()` called
3. Ledger entries queried and summed
4. Balance returned

**Advantages:**
- Single source of truth (ledger)
- Always accurate
- No cached data to invalidate

---

## Aggregate Design Principles

### 1. Consistency Boundaries
- Each aggregate is a consistency boundary
- All invariants enforced within aggregate
- Cross-aggregate consistency via eventual consistency

### 2. Small Aggregates
- Keep aggregates small for performance
- Only include entities that must be consistent
- Use references for relationships

### 3. Immutability
- Ledger entries are immutable
- Use event sourcing for audit trail
- Soft delete instead of hard delete

### 4. Single Source of Truth
- Ledger is source of truth for balances
- Transaction is source of truth for metadata
- No duplicate data storage

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2024-12-24  
**Next Review:** When adding new aggregates or major refactoring
