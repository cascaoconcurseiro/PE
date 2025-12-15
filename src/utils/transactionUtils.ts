
import { Transaction, Account } from '../types';

export const isForeignTransaction = (t: Transaction, accounts: Account[]): boolean => {
    // 1. Explicitly linked to a trip? 
    // REMOVED: Just being in a trip doesn't make it foreign. 
    // The Dashboard hook checks the Trip's currency specifically.
    // if (t.tripId) return true;

    // 2. Explicitly foreign currency
    if (t.currency && t.currency !== 'BRL') return true;

    // 3. Linked to a foreign account (CRITICAL FIX)
    if (t.accountId) {
        const account = accounts.find(a => a.id === t.accountId);
        if (account && account.currency && account.currency !== 'BRL') return true;
    }

    // 4. Linked to a foreign destination account (Transfers)
    if (t.destinationAccountId) {
        const destAccount = accounts.find(a => a.id === t.destinationAccountId);
        if (destAccount && destAccount.currency && destAccount.currency !== 'BRL') return true;
    }

    return false;
};
