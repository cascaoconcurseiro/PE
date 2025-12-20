import { useEffect, useRef } from 'react';
import { checkDataConsistency } from '../core/engines/financialLogic';
import { Account, Transaction } from '../types';

export const useDataConsistency = (
    accounts: Account[] | undefined,
    transactions: Transaction[] | undefined,
    isMigrating: boolean
) => {
    const hasCheckedConsistency = useRef(false);

    useEffect(() => {
        if (isMigrating || !accounts || !transactions || hasCheckedConsistency.current) return;

        const issues = checkDataConsistency(accounts, transactions);

        if (issues.length > 0) {
            // Inconsistências encontradas nos dados - registrar para análise
            // Future: Could dispatch to a 'SystemHealth' store
        }

        hasCheckedConsistency.current = true;
    }, [isMigrating, accounts, transactions]);
};
