# Financial System - Bounded Contexts Documentation

**Date:** 2024-12-24  
**Status:** Architecture Documentation  
**Purpose:** Define and document all bounded contexts in the financial system

---

## Overview

This document describes the Domain-Driven Design (DDD) bounded contexts implemented in the financial system, their responsibilities, and how they interact.

---

## Context Map

```
┌─────────────────────────────────────────────────────────────────┐
│                     Financial Management System                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
        ┌─────────────────────────┼─────────────────────────┐
        │                         │                         │
        ▼                         ▼                         ▼
┌───────────────┐         ┌───────────────┐       ┌───────────────┐
│   Account     │         │  Transaction  │       │    Ledger     │
│   Context     │◄────────│    Context    │──────►│   Context     │
└───────────────┘         └───────────────┘       └───────────────┘
        │                         │                         │
        │                         ▼                         │
        │                 ┌───────────────┐                 │
        │                 │    Sharing    │                 │
        │                 │    Context    │                 │
        │                 └───────────────┘                 │
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  │
                                  ▼
                          ┌───────────────┐
                          │   Reporting   │
                          │    Context    │
                          └───────────────┘
```

---

## 1. Account Context

### Responsibility
Manage user accounts (bank accounts, credit cards, cash) and their metadata.

### Aggregate Root
**Account**

### Entities
- Account
- User (reference)

### Value Objects
- AccountType (enum: checking, savings, credit_card, cash, investment)
- Currency (BRL)
- AccountBalance (calculated from Ledger)

### Operations
- Create account
- Update account details
- Archive account
- Get account balance (via Ledger Context)
- List user accounts

### Invariants
1. Account must belong to a user
2. Account name must be unique per user
3. Account type must be valid
4. Archived accounts cannot be used for new transactions

### Database Tables
- `accounts`

### RPCs
- `create_account()`
- `update_account()`
- `archive_account()`
- `get_account_balance(user_id, account_id)` - Delegates to Ledger Context

### Events Published
- AccountCreated
- AccountUpdated
- AccountArchived

### Events Consumed
- None (upstream context)

### Dependencies
- None (core context)

---

## 2. Transaction Context

### Responsibility
Manage financial transactions (income, expenses, transfers) and their lifecycle.

### Aggregate Root
**Transaction**

### Entities
- Transaction
- TransactionInstallment (for installment payments)

### Value Objects
- TransactionType (enum: income, expense, transfer)
- TransactionStatus (enum: pending, completed, cancelled)
- Money (amount + currency)
- InstallmentInfo (current/total)

### Operations
- Create transaction (simple)
- Create installment transaction
- Create transfer
- Update transaction
- Delete transaction
- Get transaction details
- List user transactions

### Invariants
1. Transaction must have valid account_id
2. Amount must be > 0
3. Type must be valid (income/expense/transfer)
4. Installment transactions must have valid installment_number and total_installments
5. Transfer transactions must have both from_account and to_account
6. Deleted transactions cannot be modified

### Database Tables
- `transactions`

### RPCs
- `create_transaction()`
- `create_installment_transaction()`
- `create_transfer()`
- `update_transaction()`
- `delete_transaction()`

### Events Published
- TransactionCreated → Triggers Ledger sync
- TransactionUpdated → Triggers Ledger sync
- TransactionDeleted → Triggers Ledger sync

### Events Consumed
- None (upstream context)

### Dependencies
- Account Context (validates account_id)
- Ledger Context (creates ledger entries via trigger)

### Integration Points
- **Trigger:** `sync_transaction_to_ddd_ledger` - Automatically creates ledger entries when transaction is created/updated/deleted

---

## 3. Ledger Context

### Responsibility
Maintain double-entry bookkeeping ledger and ensure financial integrity.

### Aggregate Root
**LedgerEntry**

### Entities
- LedgerEntry

### Value Objects
- EntryType (enum: debit, credit)
- Money (amount + currency)

### Operations
- Create ledger entry (via trigger)
- Get account balance
- Get monthly summary
- Calculate cash flow
- Reconcile ledger entries
- Validate ledger integrity

### Invariants
1. Every transaction must have at least 2 ledger entries (debit + credit)
2. Sum of all ledger entries must equal 0 (balanced)
3. Debit entries have positive amounts
4. Credit entries have negative amounts
5. Ledger entries are immutable (soft delete only)

### Database Tables
- `ledger_entries`

### RPCs
- `get_account_balance(user_id, account_id)`
- `get_monthly_summary(user_id, year, month)`
- `get_category_totals(user_id, start_date, end_date)`
- `calculate_cash_flow(user_id, start_date, end_date)`
- `reconcile_ledger_entries()`
- `validate_ledger_integrity()`
- `daily_health_check()`

### Events Published
- LedgerEntryCreated
- LedgerBalanceChanged
- LedgerIntegrityIssue (alert)

### Events Consumed
- TransactionCreated (from Transaction Context)
- TransactionUpdated (from Transaction Context)
- TransactionDeleted (from Transaction Context)
- SharedTransactionAccepted (from Sharing Context)

### Dependencies
- Transaction Context (source of truth for transactions)
- Account Context (validates accounts)

### Integration Points
- **Trigger:** Listens to transaction changes via `sync_transaction_to_ddd_ledger_trigger`
- **Source of Truth:** All financial calculations must use ledger_entries, not transactions

---

## 4. Sharing Context

### Responsibility
Manage shared expenses between users (split bills, shared purchases).

### Aggregate Root
**SharedTransaction**

### Entities
- SharedTransaction
- SharedTransactionParticipant

### Value Objects
- SharingStatus (enum: pending, accepted, rejected, cancelled)
- SplitType (enum: equal, percentage, fixed_amount)
- ParticipantShare (amount per participant)

### Operations
- Create shared transaction request
- Accept shared transaction
- Reject shared transaction
- Cancel shared transaction
- Sync shared transaction (mirror)
- List shared transactions

### Invariants
1. Shared transaction must have at least 2 participants
2. Total shares must equal transaction amount
3. Payer must be one of the participants
4. Accepted shared transactions create mirror transactions
5. Each participant sees their own transaction copy

### Database Tables
- `shared_transactions`
- `shared_transaction_participants`

### RPCs
- `create_shared_transaction_v2()`
- `respond_to_shared_request_v2()`
- `sync_shared_transaction_v2()`
- `cancel_shared_transaction()`

### Events Published
- SharedTransactionCreated
- SharedTransactionAccepted → Triggers Ledger entries
- SharedTransactionRejected
- SharedTransactionCancelled

### Events Consumed
- TransactionCreated (from Transaction Context)

### Dependencies
- Transaction Context (creates underlying transactions)
- Ledger Context (special accounting for receivables/payables)
- Account Context (validates participant accounts)

### Integration Points
- **Special Accounts:**
  - Receivables (asset account for money owed to user)
  - Payables (liability account for money user owes)
- **Accounting Pattern:**
  - Payer: Debit Expense + Debit Receivables
  - Acceptor: Debit Expense + Credit Payables

---

## 5. Reporting Context

### Responsibility
Generate financial reports, analytics, and insights.

### Aggregate Root
**Report**

### Entities
- Report
- ReportData

### Value Objects
- ReportType (enum: cash_flow, balance_sheet, income_statement, category_analysis)
- DateRange (start_date, end_date)
- ReportFormat (enum: json, pdf, csv)

### Operations
- Generate cash flow report
- Generate balance sheet
- Generate income statement
- Generate category analysis
- Export report
- Schedule recurring reports

### Invariants
1. Reports must have valid date range
2. Reports are read-only (immutable)
3. Reports use Ledger Context as data source

### Database Tables
- `reports` (optional - for caching)

### RPCs
- `generate_cash_flow_report()`
- `generate_balance_sheet()`
- `generate_income_statement()`
- `generate_category_analysis()`

### Events Published
- ReportGenerated

### Events Consumed
- None (downstream context)

### Dependencies
- Ledger Context (data source)
- Transaction Context (metadata)
- Account Context (account details)

### Integration Points
- All reports query Ledger Context for financial data
- Reports aggregate data from multiple contexts

---

## Context Relationships

### Upstream Contexts (Core Domain)
1. **Account Context** - No dependencies, provides accounts
2. **Transaction Context** - Depends on Account Context

### Downstream Contexts (Supporting Domain)
3. **Ledger Context** - Depends on Transaction + Account
4. **Sharing Context** - Depends on Transaction + Account + Ledger
5. **Reporting Context** - Depends on all other contexts

### Anti-Corruption Layers

**Transaction → Ledger:**
- Trigger `sync_transaction_to_ddd_ledger` acts as ACL
- Translates transaction events to ledger entries
- Ensures double-entry bookkeeping rules

**Sharing → Ledger:**
- Special functions for shared transaction accounting
- Manages Receivables/Payables accounts
- Prevents duplication in cash flow

---

## Shared Kernel

### Shared Concepts
- User (identity)
- Money (amount + currency)
- Timestamp (created_at, updated_at, deleted_at)
- Soft Delete pattern

### Shared Tables
- `users` (managed by Auth Context - not documented here)

### Shared Types
- UUID (primary keys)
- TIMESTAMPTZ (timestamps)
- NUMERIC(10,2) (money amounts)

---

## Context Integration Patterns

### 1. Event-Driven Integration
**Pattern:** Trigger-based event propagation  
**Example:** Transaction changes trigger ledger entry creation

**Advantages:**
- Loose coupling
- Automatic synchronization
- Audit trail

**Disadvantages:**
- Eventual consistency
- Debugging complexity

### 2. Direct RPC Calls
**Pattern:** Frontend calls context-specific RPCs  
**Example:** `get_account_balance()` calls Ledger Context

**Advantages:**
- Immediate consistency
- Simple to understand
- Type-safe

**Disadvantages:**
- Tighter coupling
- Potential performance issues

### 3. Shared Database
**Pattern:** Multiple contexts read from same tables  
**Example:** Reporting Context reads from all tables

**Advantages:**
- Simple queries
- No data duplication
- Consistent data

**Disadvantages:**
- Schema coupling
- Potential conflicts

---

## Context Boundaries

### What Belongs in Each Context

**Account Context:**
- ✅ Account CRUD operations
- ✅ Account metadata
- ❌ Account balance calculation (Ledger Context)
- ❌ Transaction creation (Transaction Context)

**Transaction Context:**
- ✅ Transaction CRUD operations
- ✅ Transaction metadata
- ✅ Installment logic
- ❌ Ledger entry creation (Ledger Context)
- ❌ Balance calculation (Ledger Context)

**Ledger Context:**
- ✅ Ledger entry creation
- ✅ Balance calculation
- ✅ Financial integrity validation
- ❌ Transaction business logic (Transaction Context)
- ❌ Report generation (Reporting Context)

**Sharing Context:**
- ✅ Shared transaction logic
- ✅ Participant management
- ✅ Split calculation
- ❌ Base transaction creation (Transaction Context)
- ❌ Ledger entry creation (Ledger Context)

**Reporting Context:**
- ✅ Report generation
- ✅ Data aggregation
- ✅ Analytics
- ❌ Data storage (other contexts)
- ❌ Transaction creation (Transaction Context)

---

## Migration Path to Ideal Architecture

### Current State
- ✅ Ledger Context implemented
- ✅ Transaction → Ledger integration via trigger
- ✅ Sharing Context partially implemented
- ⚠️ Some business logic still in frontend
- ⚠️ Some calculations use transactions table

### Target State
- ✅ All contexts fully separated
- ✅ All calculations use Ledger Context
- ✅ Frontend only calls RPCs (no business logic)
- ✅ Complete event-driven architecture
- ✅ Full audit trail

### Migration Steps
1. ✅ Create Ledger Context (DONE)
2. ✅ Implement double-entry bookkeeping (DONE)
3. ✅ Create Receivables/Payables accounts (DONE)
4. ✅ Fix shared transaction accounting (DONE)
5. ✅ Create calculation RPCs (DONE)
6. ⏳ Refactor frontend to use RPCs (IN PROGRESS)
7. ⏳ Remove business logic from frontend (IN PROGRESS)
8. ⏳ Implement complete event sourcing (FUTURE)
9. ⏳ Add CQRS pattern (FUTURE)

---

## Best Practices

### 1. Context Independence
- Each context should be independently deployable
- Minimize cross-context dependencies
- Use events for loose coupling

### 2. Single Source of Truth
- Ledger Context is source of truth for financial data
- Transaction Context is source of truth for transaction metadata
- Account Context is source of truth for account details

### 3. Immutability
- Ledger entries are immutable (soft delete only)
- Use event sourcing for audit trail
- Never update financial data, create new entries

### 4. Validation
- Validate at context boundaries
- Each context enforces its own invariants
- Use database constraints for critical rules

### 5. Testing
- Test each context independently
- Use integration tests for cross-context flows
- Property-based tests for invariants

---

## Glossary

**Bounded Context:** A logical boundary within which a domain model is defined and applicable.

**Aggregate Root:** The main entity that controls access to a cluster of related objects.

**Anti-Corruption Layer (ACL):** A layer that translates between different domain models.

**Shared Kernel:** Code and concepts shared between multiple contexts.

**Upstream Context:** A context that provides data/services to other contexts.

**Downstream Context:** A context that consumes data/services from other contexts.

**Event Sourcing:** Storing state changes as a sequence of events.

**CQRS:** Command Query Responsibility Segregation - separate read and write models.

---

**Document Status:** ✅ COMPLETE  
**Last Updated:** 2024-12-24  
**Next Review:** When adding new contexts or major refactoring
