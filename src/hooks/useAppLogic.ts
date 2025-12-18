import { useEffect, useRef } from 'react';
import { Account, Transaction, Asset } from '../types';
import { useDataConsistency } from './useDataConsistency';
import { useNotifications } from './useNotifications';

interface UseAppLogicProps {
    accounts?: Account[];
    transactions?: Transaction[];
    assets?: Asset[];
    isMigrating: boolean;
    handlers: {
        handleAddTransaction: (t: Omit<Transaction, 'id'>) => Promise<void>;
        handleUpdateTransaction: (t: Transaction) => Promise<void>;
        handleAddSnapshot: (s: import('../types').Snapshot) => Promise<void>;
    };
}

/**
 * Main Application Logic Orchestrator
 * Decoupled into specialized hooks for better maintainability.
 */
export const useAppLogic = ({ accounts, transactions, assets, isMigrating, handlers }: UseAppLogicProps) => {
    // 1. Consistency Checks
    useDataConsistency(accounts, transactions, isMigrating);

    // 2. Notification Engine
    useNotifications(transactions, isMigrating);

    // 3. Snapshot Engine (Legacy/Disabled)
    // The previous implementation was unstable and caused write-loops.
    // It is pending migration to a Server-Side Scheduled Task (Edge Function).
    // For now, we rely on the backend or manual checkpoints.
};