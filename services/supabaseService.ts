import { supabase } from '../integrations/supabase/client';
import { 
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset, 
    CustomCategory, Snapshot, UserProfile 
} from '../types';

// Helper to get current user
const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
    return user.id;
};

// Generic Mapper (DB snake_case -> App camelCase)
const mapToApp = (data: any): any => {
    if (Array.isArray(data)) return data.map(mapToApp);
    if (data === null || typeof data !== 'object') return data;
    
    const newObj: any = {};
    for (const key in data) {
        if (key === 'user_id') continue;
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
        
        // Specific overrides if needed
        if (key === 'account_id') newObj['accountId'] = data[key];
        else if (key === 'destination_account_id') newObj['destinationAccountId'] = data[key];
        else newObj[camelKey] = data[key];
    }
    return newObj;
};

// Mapper for Saving (App camelCase -> DB snake_case)
const mapToDB = (data: any, userId: string): any => {
    const newObj: any = { user_id: userId };
    
    // Copia propriedades básicas e converte para snake_case
    const keys = {
        id: 'id',
        name: 'name',
        amount: 'amount',
        date: 'date',
        type: 'type',
        category: 'category',
        description: 'description',
        currency: 'currency',
        
        // Accounts
        initialBalance: 'initial_balance',
        balance: 'balance',
        limit: 'limit',
        closingDay: 'closing_day',
        dueDay: 'due_day',
        isInternational: 'is_international',
        
        // Transactions
        accountId: 'account_id',
        destinationAccountId: 'destination_account_id',
        tripId: 'trip_id',
        isRecurring: 'is_recurring',
        frequency: 'frequency',
        recurrenceDay: 'recurrence_day',
        lastGenerated: 'last_generated',
        isInstallment: 'is_installment',
        currentInstallment: 'current_installment',
        totalInstallments: 'total_installments',
        originalAmount: 'original_amount',
        seriesId: 'series_id',
        enableNotification: 'enable_notification',
        notificationDate: 'notification_date',
        observation: 'observation',
        isShared: 'is_shared',
        sharedWith: 'shared_with',
        payerId: 'payer_id',
        isSettled: 'is_settled',
        isRefund: 'is_refund',
        
        // Trips
        startDate: 'start_date',
        endDate: 'end_date',
        budget: 'budget',
        imageUrl: 'image_url',
        participants: 'participants',
        itinerary: 'itinerary',
        checklist: 'checklist',
        shoppingList: 'shopping_list',
        exchangeEntries: 'exchange_entries',
        
        // Others
        role: 'role',
        email: 'email',
        targetAmount: 'target_amount',
        currentAmount: 'current_amount',
        deadline: 'deadline',
        icon: 'icon',
        color: 'color',
        categoryId: 'category_id',
        period: 'period',
        alertThreshold: 'alert_threshold',
        rollover: 'rollover',
        ticker: 'ticker',
        quantity: 'quantity',
        averagePrice: 'average_price',
        currentPrice: 'current_price',
        lastUpdate: 'last_update',
        tradeHistory: 'trade_history',
        totalBalance: 'total_balance',
        totalInvested: 'total_invested',
        totalDebt: 'total_debt',
        netWorth: 'net_worth',
        
        // Meta
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deleted: 'deleted'
    };

    for (const [appKey, dbKey] of Object.entries(keys)) {
        if (data[appKey] !== undefined) {
            newObj[dbKey] = data[appKey];
        }
    }

    return newObj;
};

export const supabaseService = {
    // GENERIC CRUD
    async getAll(table: string) {
        const userId = await getUserId();
        let query = supabase.from(table).select('*').eq('user_id', userId).eq('deleted', false);
        
        if (table === 'transactions' || table === 'assets' || table === 'snapshots') {
            query = query.order('date', { ascending: false });
        } else {
            query = query.order('created_at', { ascending: true });
        }
        
        const { data, error } = await query;
        if (error) throw error;
        return mapToApp(data);
    },

    async create(table: string, item: any) {
        const userId = await getUserId();
        const dbItem = mapToDB(item, userId);
        
        console.log(`Creating in ${table}:`, dbItem); // Debug log

        const { error } = await supabase.from(table).insert(dbItem);
        if (error) {
            console.error(`Error creating in ${table}:`, error);
            throw error;
        }
    },

    async update(table: string, item: any) {
        const userId = await getUserId();
        const dbItem = mapToDB(item, userId);
        const { error } = await supabase.from(table).update(dbItem).eq('id', item.id).eq('user_id', userId);
        if (error) throw error;
    },

    async delete(table: string, id: string) {
        const userId = await getUserId();
        const { error } = await supabase.from(table).update({ deleted: true }).eq('id', id).eq('user_id', userId);
        if (error) throw error;
    },

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
    async getSnapshots() { return this.getAll('snapshots'); }
};