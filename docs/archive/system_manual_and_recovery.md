# System Manual & Recovery Guide (Pé de Meia)
**Date:** 2025-12-14
**Version:** Snapshot 1.0

## 1. System Architecture
The "Pé de Meia" application is a **Local-First Financial Manager** with **Cloud Sync** and **Social Features** (Shared Trips/Expenses).

### Core Stack
- **Frontend**: React (Vite-PWA), TypeScript, TailwindCSS.
- **Backend (BaaS)**: Supabase (PostgreSQL).
- **State Management**: `useDataStore.ts` (Custom Hook with optimisic UI).
- **Offline Strategy**: PWA Service Worker + Local State (Syncs when online).

## 2. Critical Modules & Logic

### A. Notification System (The "Nerve Center")
- **Table**: `public.user_notifications`
  - **Key Columns**:
    - `metadata` (JSONB): Contains payload like `tripId`, `transactionId`. **CRITICAL**: Do NOT rename to `data` (legacy RPC conflict).
    - `is_read` (BOOLEAN): Status. **CRITICAL**: Do NOT rename to `read` (TS convention).
    - `type`: 'TRANSACTION', 'TRIP_INVITE', 'INVITE'.
- **Triggers (Unified in `20251214_z_unify_notifications_metadata.sql`)**:
  - `handle_trip_sharing()`: Monitors `trips` table.
    - Logic: When a Trip is created/updated with participants, it:
      1. Creates "Mirror Trips" for invited users.
      2. Inserts `TRIP_INVITE` notification into `metadata` (if `auth.users` exists).
  - `handle_shared_notification()`: Monitors `transactions` and `family_members`.
    - Logic:
      - **Transactions**: If `is_shared=true` and `payer_id` valid, notifies the target user. Check for FK validity before insert.
      - **Family**: If linked to a real user, sends "Invite" notification.

### B. Shared Engine (Transactions)
- **Concept**: "Mirroring".
- **Logic**: A shared transaction is NOT a single row shared by many. It is **Replicated**.
  - User A creates Tx.
  - Trigger parses `shared_with`.
  - Trigger INSERTS separate Tx rows for User B, C...
  - Notifications are sent to B, C.
  - **Safety**: `payer_id` is stored to track who paid. `mirror_transaction_id` links back to source.

### C. Family & Invites
- **Table**: `family_members`
- **Logic**: Can remain "Local" (Virtual) or be "Linked" (Real User).
- **Linking**: Done via Email match (RPC `invite_user_to_family`).
- **Trigger**: Linking fires `handle_shared_notification` -> `INVITE`.

## 3. Database Schema "Personality" (Known Quirks)
- **`user_notifications`**:
  - Uses `metadata` (not `data`).
  - Uses `is_read` (not `read`).
- **`transactions`**:
  - `amount` is Numeric.
  - `date` is YYYY-MM-DD string (in JSON) or Date? In DB it is `DATE`.
  - `shared_with` is JSONB Array of objects `{memberId, assignedAmount}`.

## 4. Recovery Procedures

### Scenario A: "Notifications Broken / Column Missing"
**Symptoms**: Errors like `column "data" does not exist` or `null value in message`.
**Fix**: Apply `supabase/migrations/20251214_z_unify_notifications_metadata.sql`.
**Why**: This file is the "Gold Standard" that unifies all triggers and columns to the working state (`metadata`, `COALESCE`, FK Checks).

### Scenario B: "Transactions Not Appearing for Invited Users"
**Symptoms**: User B doesn't see shared item.
**Fix**:
1. Check `supabaseService.ts`: Ensure `getTrips()` uses `OR participants.cs ...`.
2. Check `20251214_z_unify_notifications_metadata.sql`: Ensure triggers are active.
3. Check `auth.users`: Ensure User B actually exists in Auth. If they are just a "Member" without Account, they get nothing.

### Scenario C: "System Reset" (Nuclear Option)
**Use File**: `supabase/migrations/20250109_hard_reset.sql` (Note: Date in filename is future/generic, verify content).
**Action**: This usually drops all tables and re-seeds.
**Post-Reset**: You MUST re-apply the "Fix" migrations, specifically `20251214_z_unify_notifications_metadata.sql` to restore the notification logic.

## 5. Critical Files Manifest
- `src/hooks/useDataStore.ts`: Main brain.
- `src/hooks/useSystemNotifications.ts`: Interface to Notifications.
- `src/services/supabaseService.ts`: API Layer.
- `supabase/migrations/20251214_z_unify_notifications_metadata.sql`: The DB Fixer.

## 6. How to Restore
If the system behaves erratically:
1. **Stop**.
2. **Run** `20251214_z_unify_notifications_metadata.sql` in Supabase SQL Editor.
3. **Verify** client code (`useSystemNotifications.ts`) expects `metadata` and `is_read`.
4. **Clear** Browser Cache (PWA).
