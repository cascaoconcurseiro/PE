import { z } from 'zod';
import { 
    AccountType, TransactionType, Frequency, 
    SyncStatus, AssetType 
} from '../types';

// Base Schema for common fields
const BaseEntitySchema = z.object({
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    deleted: z.boolean().optional(),
    syncStatus: z.nativeEnum(SyncStatus).optional(),
});

// 1. Account Schema
export const AccountSchema = BaseEntitySchema.extend({
    id: z.string(),
    name: z.string(),
    type: z.nativeEnum(AccountType),
    initialBalance: z.number(),
    balance: z.number(),
    currency: z.string(),
    limit: z.number().optional(),
    closingDay: z.number().optional(),
    dueDay: z.number().optional(),
});

// 2. Transaction Schema & Sub-schemas
export const TransactionSplitSchema = z.object({
    memberId: z.string(),
    percentage: z.number(),
    assignedAmount: z.number(),
    relatedMemberId: z.string().optional(),
    isSettled: z.boolean().optional(),
    settledAt: z.string().optional(),
});

export const TransactionSchema = BaseEntitySchema.extend({
    id: z.string(),
    date: z.string(),
    amount: z.number(),
    type: z.nativeEnum(TransactionType),
    category: z.string(),
    description: z.string(),
    accountId: z.string(),
    destinationAccountId: z.string().optional(),
    tripId: z.string().optional(),
    isRecurring: z.boolean().optional(),
    frequency: z.nativeEnum(Frequency).optional(),
    recurrenceDay: z.number().optional(),
    lastGenerated: z.string().optional(),
    isInstallment: z.boolean().optional(),
    currentInstallment: z.number().optional(),
    totalInstallments: z.number().optional(),
    observation: z.string().optional(),
    seriesId: z.string().optional(),
    enableNotification: z.boolean().optional(),
    notificationDate: z.string().optional(),
    isShared: z.boolean().optional(),
    sharedWith: z.array(TransactionSplitSchema).optional(),
    payerId: z.string().optional(),
    relatedMemberId: z.string().optional(),
    isRefund: z.boolean().optional(),
    isSettled: z.boolean().optional(),
    settledAt: z.string().optional(),
    settledByTxId: z.string().optional(),
    destinationAmount: z.number().optional(),
    exchangeRate: z.number().optional(),
    reconciled: z.boolean().optional(),
    reconciledWith: z.string().optional(),
});

// 3. Trip Schema
export const TripParticipantSchema = z.object({
    id: z.string(),
    name: z.string(),
});

export const TripItineraryItemSchema = z.object({
    id: z.string(),
    date: z.string(),
    time: z.string().optional(),
    description: z.string(),
    location: z.string().optional(),
    type: z.enum(['FLIGHT', 'LODGING', 'ACTIVITY', 'FOOD', 'OTHER']),
});

export const TripChecklistItemSchema = z.object({
    id: z.string(),
    text: z.string(),
    isCompleted: z.boolean(),
});

export const TripShoppingItemSchema = z.object({
    id: z.string(),
    item: z.string(),
    estimatedCost: z.number().optional(),
    purchased: z.boolean(),
    actualCost: z.number().optional(),
});

export const TripExchangeEntrySchema = z.object({
    id: z.string(),
    date: z.string(),
    amountBRL: z.number(),
    exchangeRate: z.number(),
    amountForeign: z.number(),
    currency: z.string(),
});

export const TripSchema = BaseEntitySchema.extend({
    id: z.string(),
    name: z.string(),
    startDate: z.string(),
    endDate: z.string(),
    participants: z.array(TripParticipantSchema),
    currency: z.string(),
    budget: z.number(),
    imageUrl: z.string().optional(),
    itinerary: z.array(TripItineraryItemSchema).optional(),
    checklist: z.array(TripChecklistItemSchema).optional(),
    shoppingList: z.array(TripShoppingItemSchema).optional(),
    exchangeEntries: z.array(TripExchangeEntrySchema).optional(),
});

// 4. Budget Schema
export const BudgetSchema = BaseEntitySchema.extend({
    id: z.string(),
    categoryId: z.string(),
    amount: z.number(),
    period: z.enum(['MONTHLY', 'YEARLY']),
    alertThreshold: z.number(),
    rollover: z.boolean().optional(),
});

// 5. Goal Schema
export const GoalSchema = BaseEntitySchema.extend({
    id: z.string(),
    name: z.string(),
    targetAmount: z.number(),
    currentAmount: z.number(),
    deadline: z.string().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
});

// 6. Family Member Schema
export const FamilyMemberSchema = BaseEntitySchema.extend({
    id: z.string(),
    name: z.string(),
    role: z.string().optional(),
    email: z.string().optional(),
});

// 7. Asset Schema
export const TradeHistorySchema = z.object({
    id: z.string(),
    date: z.string(),
    type: z.enum(['BUY', 'SELL']),
    quantity: z.number(),
    price: z.number(),
    total: z.number(),
    profit: z.number().optional(),
    currency: z.string(),
});

export const AssetSchema = BaseEntitySchema.extend({
    id: z.string(),
    ticker: z.string(),
    name: z.string(),
    type: z.nativeEnum(AssetType),
    quantity: z.number(),
    averagePrice: z.number(),
    currentPrice: z.number(),
    currency: z.string(),
    accountId: z.string(),
    lastUpdate: z.string().optional(),
    tradeHistory: z.array(TradeHistorySchema).optional(),
});

// 8. Snapshot Schema
export const SnapshotSchema = BaseEntitySchema.extend({
    id: z.string(),
    date: z.string(),
    totalBalance: z.number(),
    totalInvested: z.number(),
    totalDebt: z.number(),
    netWorth: z.number(),
});

// 9. Custom Category Schema
export const CustomCategorySchema = BaseEntitySchema.extend({
    id: z.string(),
    name: z.string(),
});

// Main Backup Schema
export const BackupSchema = z.object({
    accounts: z.array(AccountSchema).optional(),
    transactions: z.array(TransactionSchema).optional(),
    trips: z.array(TripSchema).optional(),
    budgets: z.array(BudgetSchema).optional(),
    goals: z.array(GoalSchema).optional(),
    familyMembers: z.array(FamilyMemberSchema).optional(),
    customCategories: z.array(CustomCategorySchema).optional(),
    assets: z.array(AssetSchema).optional(),
    snapshots: z.array(SnapshotSchema).optional(),
    exportedAt: z.string().optional(),
    version: z.string().optional(),
});