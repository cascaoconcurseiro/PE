import { Account, Transaction, Trip, FamilyMember, Goal, Budget, Asset, CustomCategory } from '../types';

export interface BackupData {
    version: string;
    timestamp: string;
    data: {
        accounts: Account[];
        transactions: Transaction[];
        trips: Trip[];
        familyMembers: FamilyMember[];
        goals: Goal[];
        budgets: Budget[];
        assets: Asset[];
        customCategories: CustomCategory[];
    };
}

/**
 * Export all data to JSON format
 * Accepts data as arguments since we don't have a local DB anymore
 */
export const exportAllData = async (
    accounts: Account[],
    transactions: Transaction[],
    trips: Trip[],
    familyMembers: FamilyMember[],
    goals: Goal[],
    budgets: Budget[],
    assets: Asset[],
    customCategories: CustomCategory[]
): Promise<BackupData> => {
    
    return {
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        data: {
            accounts,
            transactions,
            trips,
            familyMembers,
            goals,
            budgets,
            assets,
            customCategories
        }
    };
};

/**
 * Download backup as JSON file
 */
export const downloadBackup = async (
    accounts: Account[],
    transactions: Transaction[],
    trips: Trip[],
    familyMembers: FamilyMember[],
    goals: Goal[],
    budgets: Budget[],
    assets: Asset[],
    customCategories: CustomCategory[]
) => {
    const backup = await exportAllData(accounts, transactions, trips, familyMembers, goals, budgets, assets, customCategories);
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas-cloud-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

// Import logic would need to be rewritten to push to Supabase if we want "Restore from JSON" feature.
// For now, we are removing local restoring as per "Only Supabase" request.