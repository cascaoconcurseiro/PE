import { Transaction, TransactionType } from '../types';
import { SafeFinancialCalculator } from './SafeFinancialCalculator';
import { FinancialPrecision } from '../services/financialPrecision';

export const calculateMyExpense = (t: Transaction): number => {
    if (t.type !== TransactionType.EXPENSE) return 0;

    const safeAmount = SafeFinancialCalculator.toSafeNumber(t.amount, 0);
    let myShare = safeAmount;
    
    // Check if I paid (payerId is empty, 'me', or 'user')
    const iPaid = !t.payerId || t.payerId === 'me' || t.payerId === 'user';

    if (t.sharedWith && t.sharedWith.length > 0) {
        // Sum of amounts assigned to OTHER people using safe operations
        const othersShare = SafeFinancialCalculator.safeSum(
            t.sharedWith.map(split => SafeFinancialCalculator.toSafeNumber(split.assignedAmount, 0))
        );

        // My share is the Total Amount minus what belongs to others
        // This works whether I paid (Total - Credit) or Someone Else Paid (Total Debt - Others Debt = My Debt)
        // Assuming the Transaction Amount represents the FULL purchase value.
        myShare = FinancialPrecision.subtract(safeAmount, othersShare);
    } else {
        // No split defined.
        if (!iPaid) {
            // Someone else paid the full amount.
            // If I registered it, it's likely a full debt/expense for me.
            myShare = safeAmount;
        } else {
            // I paid full amount, no split. It's all my expense.
            myShare = safeAmount;
        }
    }

    // Safety check to avoid negative numbers due to rounding errors
    return Math.max(0, myShare);
};
