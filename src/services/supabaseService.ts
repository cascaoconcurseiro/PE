import { supabase } from '../integrations/supabase/client';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, SyncStatus, UserProfile, Snapshot
} from '../types';
import { DBTransaction, DBAccount, DBTrip, DBBudget, DBGoal, DBFamilyMember, DBAsset, DBSnapshot, DBCustomCategory } from '../types/db';

// Helper to get current user
const getUserId = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Usuário não autenticado. Por favor, faça login novamente.');
    return user.id;
};

// Generic Mapper (DB snake_case -> App camelCase)
const mapToApp = <T>(data: any): T => {
    if (Array.isArray(data)) return data.map(mapToApp) as any;
    if (data === null || typeof data !== 'object') return data;

    const newObj: any = {};
    for (const key in data) {
        // if (key === 'user_id') continue; // We need userId for ownership checks now
        const camelKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());

        // Specific overrides if needed
        if (key === 'account_id') newObj['accountId'] = data[key];
        else if (key === 'destination_account_id') newObj['destinationAccountId'] = data[key];
        else newObj[camelKey] = data[key];
    }
    return newObj as T;
};

// Mapper for Saving (App camelCase -> DB snake_case)
const mapToDB = (data: any, userId: string): any => {
    const newObj: any = { user_id: userId };

    // Copia propriedades básicas e converte para snake_case
    const keys: Record<string, string> = {
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
        limit: 'credit_limit',
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
        settledAt: 'settled_at', // ✅ PERSISTENCE FIX
        isRefund: 'is_refund',
        destinationAmount: 'destination_amount',
        exchangeRate: 'exchange_rate',

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
        deleted: 'deleted',
        syncStatus: 'sync_status',
        externalId: 'external_id'
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
    async getAll<T>(table: string): Promise<T[]> {
        const userId = await getUserId();
        let query = supabase.from(table).select('*').eq('user_id', userId).eq('deleted', false);

        if (table === 'transactions' || table === 'snapshots') {
            query = query.order('date', { ascending: false });
        } else if (table === 'assets') {
            // Assets don't have a 'date' column, sort by ticker or creation
            query = query.order('ticker', { ascending: true });
        } else {
            query = query.order('created_at', { ascending: true });
        }

        const { data, error } = await query;

        if (error) {
            console.error(`Supabase fetch error on ${table}:`, error);
            if (error.code === '42703') { // Undefined column
                console.warn(`Column missing in ${table}. DB Schema might need update.`);
                return [];
            }
            throw error;
        }
        return mapToApp(data) as T[];
    },

    async create(table: string, item: any) {
        const userId = await getUserId();
        const dbItem = mapToDB(item, userId);

        const { error } = await supabase.from(table).insert(dbItem);
        if (error) {
            console.error(`Error creating in ${table}:`, error);
            throw error;
        }
    },

    async update(table: string, item: any) {
        const userId = await getUserId();
        const dbItem = mapToDB(item, userId);
        // Don't update ID or UserID
        delete dbItem.id;
        delete dbItem.user_id;

        const { error } = await supabase.from(table).update(dbItem).eq('id', item.id).eq('user_id', userId);
        if (error) throw error;
    },

    async delete(table: string, id: string) {
        const userId = await getUserId();
        // Soft delete
        const { error } = await supabase.from(table).update({ deleted: true }).eq('id', id).eq('user_id', userId);
        if (error) throw error;
    },

    async deleteTransactionSeries(seriesId: string) {
        const userId = await getUserId();
        // Soft delete all transactions in series
        const { error } = await supabase
            .from('transactions')
            .update({ deleted: true, updated_at: new Date().toISOString() })
            .eq('series_id', seriesId)
            .eq('user_id', userId);

        if (error) throw error;
    },

    async deleteTripCascade(tripId: string) {
        const userId = await getUserId();

        // 1. Soft delete the TRIP
        const { error: tripError } = await supabase
            .from('trips')
            .update({ deleted: true, updated_at: new Date().toISOString() })
            .eq('id', tripId)
            .eq('user_id', userId);

        if (tripError) throw tripError;

        // 2. Unlink associated TRANSACTIONS (Preserve history)
        // We set trip_id to NULL so they remain in the user's ledger but are no longer grouped.
        const { error: txError } = await supabase
            .from('transactions')
            .update({ trip_id: null, updated_at: new Date().toISOString() })
            .eq('trip_id', tripId)
            .eq('user_id', userId);

        if (txError) {
            console.error("Failed to unlink transactions for trip:", tripId, txError);
            // We log but continue, as the trip itself will be deleted.
        }
    },

    async softDeleteAccount(accountId: string) {
        const userId = await getUserId();

        // 🚨 CRITICAL FIX: DO NOT DELETE TRANSACTIONS.
        // Deleting transactions destroys the history of OTHER accounts (e.g. Transfers).
        // Principles of Double Entry: You cannot erase one side of the ledger without breaking the other.
        // We only mark the ACCOUNT as deleted. Transactions remain in history, potentially pointing to a "Ghost" account.
        // BalanceEngine handles this by warning but preserving the destination side of transfers.

        // 3. Mark the account itself as deleted
        const { error: accError } = await supabase
            .from('accounts')
            .update({ deleted: true })
            .eq('id', accountId)
            .eq('user_id', userId);

        if (accError) {
            console.error('Error deleting account:', accError);
            throw accError;
        }
    },

    async bulkCreate(table: string, items: any[]) {
        if (!items.length) return;
        const userId = await getUserId();
        const dbItems = items.map(i => mapToDB(i, userId));

        const { error } = await supabase.from(table).upsert(dbItems);
        if (error) {
            console.error(`Bulk create failed for ${table}:`, error);
            throw error;
        }
    },

    async recreateTransactionSeries(oldSeriesId: string, newTransactions: any[]) {
        const userId = await getUserId();
        // Prepare DB items
        const dbItems = newTransactions.map(t => mapToDB(t, userId));

        const { error } = await supabase.rpc('recreate_transaction_series', {
            p_old_series_id: oldSeriesId,
            p_new_transactions: dbItems
        });

        if (error) {
            console.error('Failed to recreate transaction series atomically:', error);
            throw error;
        }
    },

    // SPECIFIC FETCHERS
    async getAccountBalances() {
        try {
            const userId = await getUserId();
            // Call RPC
            const { data, error } = await supabase.rpc('get_account_totals', { p_user_id: userId });
            if (error) throw error;
            return data as { account_id: string, calculated_balance: number }[];
        } catch (e) {
            console.error("Failed to fetch account balances via RPC:", e);
            return []; // Fallback will be handled by client using local calculation if needed
        }
    },

    async getTransactions(startDate?: string, endDate?: string, includeDeleted = false): Promise<Transaction[]> {
        const userId = await getUserId();
        let query = supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId);

        if (!includeDeleted) {
            query = query.eq('deleted', false);
        }

        query = query.order('date', { ascending: false });

        if (startDate) {
            query = query.gte('date', startDate);
        }
        if (endDate) {
            query = query.lte('date', endDate);
        }

        const { data, error } = await query;

        if (error) {
            console.error('Error fetching transactions:', error);
            return [];
        }
        return mapToApp<Transaction[]>(data);
    },

    // PHASE 4: CONTEXT-AWARE FETCHING (Rescue orphaned shared debts)
    async getUnsettledSharedTransactions(olderThan?: string): Promise<Transaction[]> {
        const userId = await getUserId();
        let query = supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('deleted', false)
            .eq('is_settled', false) // Only active debts
            .or('is_shared.eq.true,shared_with.neq.null'); // Context: Shared

        if (olderThan) {
            query = query.lt('date', olderThan);
        }

        const { data, error } = await query.order('date', { ascending: false });

        if (error) {
            console.error('Error fetching unsettled shared transactions:', error);
            return [];
        }
        return mapToApp<Transaction[]>(data);
    },

    // PHASE 5: REPORTING & HYDRATION
    async getMonthlyCashflow(year: number): Promise<{ month: number, income: number, expense: number }[]> {
        const userId = await getUserId();
        const { data, error } = await supabase.rpc('get_monthly_cashflow', {
            p_year: year,
            p_user_id: userId
        });

        if (error) {
            console.error('Error fetching monthly cashflow:', error);
            return [];
        }
        return data || [];
    },
    async getAccounts(): Promise<Account[]> { return this.getAll<Account>('accounts'); },
    async getTrips(): Promise<Trip[]> { return this.getAll<Trip>('trips'); },
    async getFamilyMembers(): Promise<FamilyMember[]> { return this.getAll<FamilyMember>('family_members'); },
    async getGoals(): Promise<Goal[]> { return this.getAll<Goal>('goals'); },
    async getBudgets(): Promise<Budget[]> { return this.getAll<Budget>('budgets'); },
    async getAssets(): Promise<Asset[]> { return this.getAll<Asset>('assets'); },
    async getCustomCategories(): Promise<CustomCategory[]> { return this.getAll<CustomCategory>('custom_categories'); },
    async getSnapshots(): Promise<Snapshot[]> { return this.getAll<Snapshot>('snapshots'); },

    // DANGER: WIPE ALL DATA (SAFE MODE)
    async dangerouslyWipeAllData() {
        const userId = await getUserId();
        console.warn(`🚨 INICIANDO WIPE SEGURO PARA USUÁRIO: ${userId}`);

        // OPTIMIZED: Use Server-Side RPC for atomic and safe deletion
        const { error } = await supabase.rpc('reset_own_data');

        if (error) {
            console.error('Falha ao resetar dados (RPC):', error);
            throw error;
        }

        console.log('✅ WIPE SEGURO CONCLUÍDO COM SUCESSO via RPC.');
    }
};