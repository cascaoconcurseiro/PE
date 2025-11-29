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
    Snapshot,
    AuditLog
} from '../types';

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
    auditLogs!: Table<AuditLog, string>;

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

        // Version 4: Add Audit Logs (Princípio 8 - Auditabilidade)
        this.version(4).stores({
            auditLogs: 'id, entity, entityId, action, createdAt'
        });
    }
}

export const db = new PeDeMeiaDB();

export const initDatabase = async () => {
    try {
        const count = await db.userProfile.count();
        if (count > 0) {
            console.log('Database initialized.');
            return;
        }
        console.log('Database created (Empty). Waiting for user input.');
    } catch (error) {
        console.error('Database initialization failed:', error);
    }
};

export const migrateFromLocalStorage = initDatabase;