import Dexie, { Table } from 'dexie';
import {
    Account,
    Transaction,
    Asset,
    Budget,
    Goal,
    Trip,
    FamilyMember,
    UserProfile,
    Category,
    TransactionType,
    AccountType,
    AssetType,
    Snapshot
} from '../types';
import { seedDatabase } from './seeder';

export class PeDeMeiaDB extends Dexie {
    accounts!: Table<Account, string>;
    transactions!: Table<Transaction, string>;
    assets!: Table<Asset, string>;
    budgets!: Table<Budget, string>;
    goals!: Table<Goal, string>;
    trips!: Table<Trip, string>;
    familyMembers!: Table<FamilyMember, string>;
    userProfile!: Table<UserProfile, string>;
    snapshots!: Table<Snapshot, string>;

    constructor() {
        super('PeDeMeiaDB');

        // Version 1
        this.version(1).stores({
            accounts: 'id, type',
            transactions: 'id, date, type, category, accountId, destinationAccountId, tripId',
            assets: 'id, type, accountId, ticker',
            budgets: 'id, categoryId',
            goals: 'id',
            trips: 'id, startDate, endDate',
            familyMembers: 'id',
            userProfile: 'id'
        });

        // Version 2: Add sync fields
        this.version(2).stores({
            accounts: 'id, type, syncStatus, deleted',
            transactions: 'id, date, type, category, accountId, destinationAccountId, tripId, syncStatus, deleted',
            assets: 'id, type, accountId, ticker, syncStatus, deleted',
            budgets: 'id, categoryId, syncStatus, deleted',
            goals: 'id, syncStatus, deleted',
            trips: 'id, startDate, endDate, syncStatus, deleted',
            familyMembers: 'id, syncStatus, deleted',
            userProfile: 'id, syncStatus, deleted'
        });

        // Version 3: Add Snapshots
        this.version(3).stores({
            snapshots: 'id, date'
        });
    }
}

export const db = new PeDeMeiaDB();

// --- MIGRATION & INIT UTILS ---

export const initDatabase = async () => {
    try {
        const count = await db.transactions.count();
        if (count > 0) {
            console.log('Database already populated.');
            return;
        }

        console.log('Checking for localStorage data...');
        const keys = {
            accounts: 'pdm_accounts',
            transactions: 'pdm_transactions',
            assets: 'pdm_assets',
            budgets: 'pdm_budgets',
            goals: 'pdm_goals',
            trips: 'pdm_trips',
            familyMembers: 'pdm_family',
            userProfile: 'pdm_user'
        };

        const load = <T>(key: string): T[] => {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : [];
        };

        const accounts = load<Account>(keys.accounts);

        if (accounts.length > 0) {
            console.log('Migrating from localStorage...');
            const transactions = load<Transaction>(keys.transactions);
            const assets = load<Asset>(keys.assets);
            const budgets = load<Budget>(keys.budgets);
            const goals = load<Goal>(keys.goals);
            const trips = load<Trip>(keys.trips);
            const familyMembers = load<FamilyMember>(keys.familyMembers);

            // User profile might be a single object, not array
            const userProfileStr = localStorage.getItem(keys.userProfile);
            const userProfile = userProfileStr ? JSON.parse(userProfileStr) : null;

            await db.transaction('rw', [db.accounts, db.transactions, db.assets, db.budgets, db.goals, db.trips, db.familyMembers, db.userProfile], async () => {
                if (accounts.length) await db.accounts.bulkAdd(accounts);
                if (transactions.length) await db.transactions.bulkAdd(transactions);
                if (assets.length) await db.assets.bulkAdd(assets);
                if (budgets.length) await db.budgets.bulkAdd(budgets);
                if (goals.length) await db.goals.bulkAdd(goals);
                if (trips.length) await db.trips.bulkAdd(trips);
                if (familyMembers.length) await db.familyMembers.bulkAdd(familyMembers);
                if (userProfile) await db.userProfile.put(userProfile);
            });
            console.log('Migration completed successfully.');
        } else {
            // If no localStorage data, seed with demo data
            await seedDatabase();
        }

    } catch (error) {
        console.error('Database initialization failed:', error);
    }
};

// Keep for backward compatibility if needed, but alias to initDatabase
export const migrateFromLocalStorage = initDatabase;
