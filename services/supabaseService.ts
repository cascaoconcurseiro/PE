import { supabase } from '../integrations/supabase/client';
import { 
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, 
    CustomCategory, Snapshot, UserProfile 
} from '../types';

// Helper to get current user
const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');
    return user.id;
};

// Generic Mapper (converts snake_case from DB to camelCase for App)
const mapToApp = (data: any): any => {
    if (Array.isArray(data)) return data.map(mapToApp);
    if (data === null || typeof data !== 'object') return data;
    
    const newObj: any = {};
    for (const key in data) {
        if (key === 'user_id') continue;
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        
        // Specific Mappings (keeping previous logic)
        if (key === 'account_id') newObj['accountId'] = data[key];
        else if (key === 'destination_account_id') newObj['destinationAccountId'] = data[key];
        else if (key === 'trip_id') newObj['tripId'] = data[key];
        else if (key === 'is_recurring') newObj['isRecurring'] = data[key];
        else if (key === 'recurrence_day') newObj['recurrenceDay'] = data[key];
        else if (key === 'last_generated') newObj['lastGenerated'] = data[key];
        else if (key === 'is_installment') newObj['isInstallment'] = data[key];
        else if (key === 'current_installment') newObj['currentInstallment'] = data[key];
        else if (key === 'total_installments') newObj['totalInstallments'] = data[key];
        else if (key === 'original_amount') newObj['originalAmount'] = data[key];
        else if (key === 'series_id') newObj['seriesId'] = data[key];
        else if (key === 'enable_notification') newObj['enableNotification'] = data[key];
        else if (key === 'notification_date') newObj['notificationDate'] = data[key];
        else if (key === 'is_shared') newObj['isShared'] = data[key];
        else if (key === 'shared_with') newObj['sharedWith'] = data[key];
        else if (key === 'payer_id') newObj['payerId'] = data[key];
        else if (key === 'is_settled') newObj['isSettled'] = data[key];
        else if (key === 'is_refund') newObj['isRefund'] = data[key];
        else if (key === 'start_date') newObj['startDate'] = data[key];
        else if (key === 'end_date') newObj['endDate'] = data[key];
        else if (key === 'image_url') newObj['imageUrl'] = data[key];
        else if (key === 'shopping_list') newObj['shoppingList'] = data[key];
        else if (key === 'exchange_entries') newObj['exchangeEntries'] = data[key];
        else if (key === 'target_amount') newObj['targetAmount'] = data[key];
        else if (key === 'current_amount') newObj['currentAmount'] = data[key];
        else if (key === 'category_id') newObj['categoryId'] = data[key];
        else if (key === 'alert_threshold') newObj['alertThreshold'] = data[key];
        else if (key === 'average_price') newObj['averagePrice'] = data[key];
        else if (key === 'current_price') newObj['currentPrice'] = data[key];
        else if (key === 'last_update') newObj['lastUpdate'] = data[key];
        else if (key === 'trade_history') newObj['tradeHistory'] = data[key];
        else if (key === 'initial_balance') newObj['initialBalance'] = data[key];
        else if (key === 'closing_day') newObj['closingDay'] = data[key];
        else if (key === 'due_day') newObj['dueDay'] = data[key];
        else if (key === 'is_international') newObj['isInternational'] = data[key];
        else if (key === 'total_balance') newObj['totalBalance'] = data[key];
        else if (key === 'total_invested') newObj['totalInvested'] = data[key];
        else if (key === 'total_debt') newObj['totalDebt'] = data[key];
        else if (key === 'net_worth') newObj['netWorth'] = data[key];
        else newObj[camelKey] = data[key];
    }
    return newObj;
};

// Mapper for Saving
const mapToDB = (data: any, userId: string): any => {
    const newObj: any = { user_id: userId };
    
    // Basic Fields
    if (data.id) newObj.id = data.id;
    if (data.createdAt) newObj.created_at = data.createdAt;
    if (data.updatedAt) newObj.updated_at = data.updatedAt;
    if (data.deleted !== undefined) newObj.deleted = data.deleted;

    // General
    if (data.name !== undefined) newObj.name = data.name;
    if (data.amount !== undefined) newObj.amount = data.amount;
    if (data.date !== undefined) newObj.date = data.date;
    if (data.type !== undefined) newObj.type = data.type;
    if (data.category !== undefined) newObj.category = data.category;
    if (data.description !== undefined) newObj.description = data.description;
    if (data.currency !== undefined) newObj.currency = data.currency;

    // Accounts
    if (data.initialBalance !== undefined) newObj.initial_balance = data.initialBalance;
    if (data.balance !== undefined) newObj.balance = data.balance;
    if (data.limit !== undefined) newObj["limit"] = data.limit;
    if (data.closingDay !== undefined) newObj.closing_day = data.closingDay;
    if (data.dueDay !== undefined) newObj.due_day = data.dueDay;
    if (data.isInternational !== undefined) newObj.is_international = data.isInternational;

    // Transactions
    if (data.accountId !== undefined) newObj.account_id = data.accountId;
    if (data.destinationAccountId !== undefined) newObj.destination_account_id = data.destinationAccountId;
    if (data.tripId !== undefined) newObj.trip_id = data.tripId;
    if (data.isRecurring !== undefined) newObj.is_recurring = data.isRecurring;
    if (data.frequency !== undefined) newObj.frequency = data.frequency;
    if (data.recurrenceDay !== undefined) newObj.recurrence_day = data.recurrenceDay;
    if (data.lastGenerated !== undefined) newObj.last_generated = data.lastGenerated;
    if (data.isInstallment !== undefined) newObj.is_installment = data.isInstallment;
    if (data.currentInstallment !== undefined) newObj.current_installment = data.currentInstallment;
    if (data.totalInstallments !== undefined) newObj.total_installments = data.totalInstallments;
    if (data.originalAmount !== undefined) newObj.original_amount = data.originalAmount;
    if (data.seriesId !== undefined) newObj.series_id = data.seriesId;
    if (data.enableNotification !== undefined) newObj.enable_notification = data.enableNotification;
    if (data.notificationDate !== undefined) newObj.notification_date = data.notificationDate;
    if (data.observation !== undefined) newObj.observation = data.observation;
    if (data.isShared !== undefined) newObj.is_shared = data.isShared;
    if (data.sharedWith !== undefined) newObj.shared_with = data.sharedWith;
    if (data.payerId !== undefined) newObj.payer_id = data.payerId;
    if (data.isSettled !== undefined) newObj.is_settled = data.isSettled;
    if (data.isRefund !== undefined) newObj.is_refund = data.isRefund;

    // Trips
    if (data.startDate !== undefined) newObj.start_date = data.startDate;
    if (data.endDate !== undefined) newObj.end_date = data.endDate;
    if (data.budget !== undefined) newObj.budget = data.budget;
    if (data.imageUrl !== undefined) newObj.image_url = data.imageUrl;
    if (data.participants !== undefined) newObj.participants = data.participants;
    if (data.itinerary !== undefined) newObj.itinerary = data.itinerary;
    if (data.checklist !== undefined) newObj.checklist = data.checklist;
    if (data.shoppingList !== undefined) newObj.shopping_list = data.shoppingList;
    if (data.exchangeEntries !== undefined) newObj.exchange_entries = data.exchangeEntries;

    // Family
    if (data.role !== undefined) newObj.role = data.role;
    if (data.email !== undefined) newObj.email = data.email;

    // Goals
    if (data.targetAmount !== undefined) newObj.target_amount = data.targetAmount;
    if (data.currentAmount !== undefined) newObj.current_amount = data.currentAmount;
    if (data.deadline !== undefined) newObj.deadline = data.deadline;
    if (data.icon !== undefined) newObj.icon = data.icon;
    if (data.color !== undefined) newObj.color = data.color;

    // Budgets
    if (data.categoryId !== undefined) newObj.category_id = data.categoryId;
    if (data.period !== undefined) newObj.period = data.period;
    if (data.alertThreshold !== undefined) newObj.alert_threshold = data.alertThreshold;
    if (data.rollover !== undefined) newObj.rollover = data.rollover;

    // Assets
    if (data.ticker !== undefined) newObj.ticker = data.ticker;
    if (data.quantity !== undefined) newObj.quantity = data.quantity;
    if (data.averagePrice !== undefined) newObj.average_price = data.averagePrice;
    if (data.currentPrice !== undefined) newObj.current_price = data.currentPrice;
    if (data.lastUpdate !== undefined) newObj.last_update = data.lastUpdate;
    if (data.tradeHistory !== undefined) newObj.trade_history = data.tradeHistory;

    // Snapshots
    if (data.totalBalance !== undefined) newObj.total_balance = data.totalBalance;
    if (data.totalInvested !== undefined) newObj.total_invested = data.totalInvested;
    if (data.totalDebt !== undefined) newObj.total_debt = data.totalDebt;
    if (data.netWorth !== undefined) newObj.net_worth = data.netWorth;

    return newObj;
};

// Audit Helper
const logAction = async (table: string, id: string, action: 'CREATE' | 'UPDATE' | 'DELETE', details?: any) => {
    try {
        const userId = await getUserId();
        // Mapeia tabela para entidade
        let entity = table.toUpperCase().replace('S', ''); // TRANSACTIONS -> TRANSACTION
        if (entity === 'FAMILY_MEMBER') entity = 'FAMILY';
        if (entity === 'CUSTOM_CATEGORIE') entity = 'CATEGORY'; // Fix plural edge case
        
        // Don't block the main thread with audit logs
        supabase.from('audit_logs').insert({
            user_id: userId,
            entity,
            entity_id: id,
            action,
            changes: details ? JSON.stringify(details) : null
        }).then(({ error }) => {
            if (error) console.error('Audit Log Error:', error);
        });
    } catch (e) {
        console.error('Audit Log Failed', e);
    }
};

export const supabaseService = {
    // GENERIC CRUD
    async getAll(table: string) {
        let query = supabase.from(table).select('*').eq('deleted', false);
        
        // Apply Ordering based on Table
        if (table === 'transactions' || table === 'assets' || table === 'snapshots') {
            query = query.order('date', { ascending: false }); // Newest first for Transactions/Snapshots
        } else if (table === 'trips') {
            query = query.order('start_date', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: true }); // Default
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return mapToApp(data);
    },

    async create(table: string, item: any) {
        const userId = await getUserId();
        const dbItem = mapToDB(item, userId);
        const { error } = await supabase.from(table).insert(dbItem);
        if (error) throw error;
        await logAction(table, item.id, 'CREATE', item);
    },

    async update(table: string, item: any) {
        const userId = await getUserId();
        const dbItem = mapToDB(item, userId);
        const { error } = await supabase.from(table).update(dbItem).eq('id', item.id);
        if (error) throw error;
        await logAction(table, item.id, 'UPDATE', { name: item.name, amount: item.amount }); // Minimal log
    },

    async delete(table: string, id: string) {
        const { error } = await supabase.from(table).update({ deleted: true }).eq('id', id);
        if (error) throw error;
        await logAction(table, id, 'DELETE');
    },

    // BULK OPERATIONS (For Migration/Sync)
    async bulkCreate(table: string, items: any[]) {
        const userId = await getUserId();
        const dbItems = items.map(i => mapToDB(i, userId));
        const { error } = await supabase.from(table).upsert(dbItems);
        if (error) throw error;
    },
    
    // SPECIFIC FETCHERS
    async getTransactions() { return this.getAll('transactions'); },
    async getAccounts() { return this.getAll('accounts'); },
    async getTrips() { return this.getAll('trips'); },
    async getFamilyMembers() { return this.getAll('family_members'); },
    async getGoals() { return this.getAll('goals'); },
    async getBudgets() { return this.getAll('budgets'); },
    async getAssets() { return this.getAll('assets'); },
    async getCustomCategories() { return this.getAll('custom_categories'); },
    async getSnapshots() { 
        // Snapshots don't have 'deleted' column typically, but let's check or assume all
        const { data, error } = await supabase.from('snapshots').select('*').order('date', { ascending: false }); 
        if (error) throw error;
        return mapToApp(data);
    }
};