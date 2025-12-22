# Fix: Projection and Monthly Totals Calculation for Future Months

## Problem
1. **Projection showing R$ 0,00**: When viewing future months (e.g., January 2026), the projection showed R$ 0,00 despite having pending transactions
2. **Future transactions counted as "paid"**: Transactions in future months were incorrectly appearing as "Pago" (paid) instead of "Pendente" (pending)

## Root Causes
1. **Projection reference date**: The `calculateProjectedBalance` function was using incorrect reference dates for future months
2. **Monthly totals logic**: The `monthlyIncome` and `monthlyExpense` calculations included ALL transactions from the month, regardless of whether they had occurred yet

## Solutions

### 1. Fixed Projection Reference Date
Updated `calculateProjectedBalance` in `src/core/engines/financialLogic.ts`:
- For future months: Use real current date as reference (not beginning of viewed month)
- This ensures only truly future transactions are counted as pending

### 2. Fixed Monthly Totals Calculation  
Updated `useOptimizedFinancialDashboard` in `src/features/dashboard/useOptimizedFinancialDashboard.ts`:
- Added logic to separate "realized" vs "pending" transactions based on reference date
- **Recebido/Pago**: Only transactions that occurred up to the reference date
- **Pendente**: Only transactions after the reference date (handled by projection logic)

## Impact
- ✅ Future months now show correct projections based on pending transactions
- ✅ Transactions in future months correctly appear as "Pendente" instead of "Pago"
- ✅ Current month behavior unchanged (uses real current date)
- ✅ Past months behavior improved (more logical reference date)
- ✅ All existing tests continue to pass
- ✅ Build successful with 0 TypeScript errors

## Files Modified
- `src/core/engines/financialLogic.ts` - Updated `calculateProjectedBalance` function
- `src/features/dashboard/useOptimizedFinancialDashboard.ts` - Updated monthly totals calculation

## Testing
- Verified that January 2026 transactions are now properly categorized
- Future transactions appear as "Pendente" not "Pago"
- Projection calculation now works correctly for future months