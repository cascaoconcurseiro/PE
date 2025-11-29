import { db } from './db';
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
 */
export const exportAllData = async (): Promise<BackupData> => {
    const [accounts, transactions, trips, familyMembers, goals, budgets, assets, customCategories] = await Promise.all([
        db.accounts.toArray(),
        db.transactions.toArray(),
        db.trips.toArray(),
        db.familyMembers.toArray(),
        db.goals.toArray(),
        db.budgets.toArray(),
        db.assets.toArray(),
        db.customCategories.toArray()
    ]);

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
export const downloadBackup = async () => {
    const backup = await exportAllData();
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `financas-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};

/**
 * Import data from backup file
 */
export const importBackup = async (file: File): Promise<{ success: boolean; message: string; stats?: any }> => {
    try {
        const text = await file.text();
        const backup: BackupData = JSON.parse(text);

        // Validate backup structure
        if (!backup.version || !backup.data) {
            return { success: false, message: 'Arquivo de backup inválido' };
        }

        // Clear existing data (with confirmation handled by caller)
        await db.transaction('rw', [
            db.accounts,
            db.transactions,
            db.trips,
            db.familyMembers,
            db.goals,
            db.budgets,
            db.assets,
            db.customCategories
        ], async () => {
            await db.accounts.clear();
            await db.transactions.clear();
            await db.trips.clear();
            await db.familyMembers.clear();
            await db.goals.clear();
            await db.budgets.clear();
            await db.assets.clear();
            await db.customCategories.clear();

            // Import data
            if (backup.data.accounts?.length) await db.accounts.bulkAdd(backup.data.accounts);
            if (backup.data.transactions?.length) await db.transactions.bulkAdd(backup.data.transactions);
            if (backup.data.trips?.length) await db.trips.bulkAdd(backup.data.trips);
            if (backup.data.familyMembers?.length) await db.familyMembers.bulkAdd(backup.data.familyMembers);
            if (backup.data.goals?.length) await db.goals.bulkAdd(backup.data.goals);
            if (backup.data.budgets?.length) await db.budgets.bulkAdd(backup.data.budgets);
            if (backup.data.assets?.length) await db.assets.bulkAdd(backup.data.assets);
            if (backup.data.customCategories?.length) await db.customCategories.bulkAdd(backup.data.customCategories);
        });

        const stats = {
            accounts: backup.data.accounts?.length || 0,
            transactions: backup.data.transactions?.length || 0,
            trips: backup.data.trips?.length || 0,
            members: backup.data.familyMembers?.length || 0,
            goals: backup.data.goals?.length || 0,
            budgets: backup.data.budgets?.length || 0,
            assets: backup.data.assets?.length || 0,
            categories: backup.data.customCategories?.length || 0
        };

        return {
            success: true,
            message: 'Backup restaurado com sucesso!',
            stats
        };
    } catch (error) {
        console.error('Import error:', error);
        return {
            success: false,
            message: error instanceof Error ? error.message : 'Erro ao importar backup'
        };
    }
};

/**
 * Auto-backup to localStorage (safety net)
 */
export const autoBackupToLocalStorage = async () => {
    try {
        const backup = await exportAllData();
        localStorage.setItem('financas_auto_backup', JSON.stringify(backup));
        localStorage.setItem('financas_auto_backup_date', new Date().toISOString());
    } catch (error) {
        console.error('Auto-backup failed:', error);
    }
};

/**
 * Restore from auto-backup
 */
export const restoreFromAutoBackup = async (): Promise<boolean> => {
    try {
        const backupStr = localStorage.getItem('financas_auto_backup');
        if (!backupStr) return false;

        const backup: BackupData = JSON.parse(backupStr);
        const result = await importBackup(new File([JSON.stringify(backup)], 'auto-backup.json'));
        return result.success;
    } catch (error) {
        console.error('Auto-restore failed:', error);
        return false;
    }
};

/**
 * Get auto-backup info
 */
export const getAutoBackupInfo = (): { exists: boolean; date?: string } => {
    const date = localStorage.getItem('financas_auto_backup_date');
    return {
        exists: !!localStorage.getItem('financas_auto_backup'),
        date: date || undefined
    };
};
