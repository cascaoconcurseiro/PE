import { supabase } from '../integrations/supabase/client';
import {
    Account, Transaction, Trip, Budget, Goal, FamilyMember, Asset,
    CustomCategory, SyncStatus, UserProfile, Snapshot
} from '../types';
import { UserSettings } from '../types/UserSettings';
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
        else if (key === 'source_transaction_id') newObj['sourceTransactionId'] = data[key]; // Map the Lock Flag
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

    const nullableUUIDs = [
        'account_id', 'destination_account_id', 'trip_id', 'series_id', 'payer_id',
        'related_member_id', 'settled_by_tx_id', 'reconciled_with', 'category_id', 'source_trip_id'
    ];

    for (const [appKey, dbKey] of Object.entries(keys)) {
        if (data[appKey] !== undefined) {
            let value = data[appKey];
            // Sanitize: Empty String -> NULL for UUIDs
            if (typeof value === 'string' && value === '' && nullableUUIDs.includes(dbKey)) {
                value = null;
            }
            newObj[dbKey] = value;
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

    // NEW: Time-Windowed Fetching (Scalability)
    async getTransactionsByRange(startDate: string, endDate: string) {
        const userId = await getUserId();

        // Ensure inclusive range (00:00:00 to 23:59:59) if passed as date strings
        // But usually input is YYYY-MM-DD. Supabase date column is DATE or TIMESTAMP?
        // Schema says DATE. So strict comparison works.

        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .eq('user_id', userId)
            .eq('deleted', false)
            .gte('date', startDate)
            .lte('date', endDate)
            .order('date', { ascending: false });

        if (error) throw error;
        return mapToApp<Transaction[]>(data);
    },

    async create(table: string, item: any) {
        const userId = await getUserId();

        // 🚀 ROUTING: Transactions & Trips -> RPC (Backend Centric)
        if (table === 'transactions') {
            return this.createTransactionWithValidation(item);
        }
        if (table === 'trips') {
            return this.createTripRPC(item);
        }

        const dbItem = mapToDB(item, userId);

        const { error } = await supabase.from(table).insert(dbItem);
        if (error) {
            console.error(`Error creating in ${table}:`, error);
            throw error;
        }
    },

    // NEW (Phase 8): RPC-Based Transaction Creation
    async createTransactionWithValidation(transaction: Partial<Transaction>) {
        const userId = await getUserId();

        // Map Application Object to RPC Parameters
        const params = {
            p_description: transaction.description,
            p_amount: transaction.amount,
            p_type: transaction.type,
            p_category: transaction.category,
            p_date: transaction.date,
            p_account_id: transaction.accountId,
            p_destination_account_id: transaction.destinationAccountId || null,
            p_trip_id: transaction.tripId || null,
            p_is_shared: transaction.isShared || false,
            p_domain: transaction.domain || null,
            // Extended Fields (Phase 8 Fix)
            p_is_installment: transaction.isInstallment || false,
            p_current_installment: transaction.currentInstallment || null,
            p_total_installments: transaction.totalInstallments || null,
            p_series_id: transaction.seriesId || null,
            p_is_recurring: transaction.isRecurring || false,
            p_frequency: transaction.frequency || null,
            p_shared_with: transaction.sharedWith || [] // Enabling Mirroring Data
        };

        const { data, error } = await supabase.rpc('create_transaction', params);

        if (error) {
            console.error('Failed to create transaction via RPC:', error);
            throw error;
        }
        return data; // Returns the new UUID
    },

    // NEW (Phase 8): Debt Settlement
    async settleDebt(splitId: string, paymentAccountId: string) {
        const { data, error } = await supabase.rpc('settle_split', {
            p_split_id: splitId,
            p_payment_account_id: paymentAccountId
        });

        if (error) {
            console.error('Failed to settle debt via RPC:', error);
            throw error;
        }
        return data;
    },

    // --- RPC HELPERS ---

    async createTripRPC(trip: any) {
        const params = {
            p_name: trip.name,
            p_description: trip.description || '',
            p_start_date: trip.startDate,
            p_end_date: trip.endDate,
            p_currency: trip.currency,
            p_status: trip.status || 'PLANNED',
            p_participants: trip.participants || []
        };
        const { data, error } = await supabase.rpc('create_trip', params);
        if (error) {
            console.error('Create Trip RPC Failed:', error);
            throw error;
        }
        return data;
    },

    async updateTripRPC(trip: any) {
        const params = {
            p_id: trip.id,
            p_name: trip.name,
            p_description: trip.description || '',
            p_start_date: trip.startDate,
            p_end_date: trip.endDate,
            p_currency: trip.currency,
            p_status: trip.status,
            p_participants: trip.participants || []
        };
        const { error } = await supabase.rpc('update_trip', params);
        if (error) {
            console.error('Update Trip RPC Failed:', error);
            throw error;
        }
    },

    async updateTransactionRPC(transaction: any) {
        const params = {
            p_id: transaction.id,
            p_description: transaction.description,
            p_amount: transaction.amount,
            p_type: transaction.type,
            p_category: transaction.category,
            p_date: transaction.date,
            p_account_id: transaction.accountId,
            p_destination_account_id: transaction.destinationAccountId || null,
            p_trip_id: transaction.tripId || null,
            p_is_shared: transaction.isShared || false,
            p_domain: transaction.domain || null,
            p_is_installment: transaction.isInstallment || false,
            p_current_installment: transaction.currentInstallment || null,
            p_total_installments: transaction.totalInstallments || null,
            p_series_id: transaction.seriesId || null,
            p_is_recurring: transaction.isRecurring || false,
            p_frequency: transaction.frequency || null,
            p_is_settled: transaction.isSettled || false
        };
        const { error } = await supabase.rpc('update_transaction', params);
        if (error) {
            console.error('Update Transaction RPC Failed:', error);
            throw error;
        }
    },

    async update(table: string, item: any) {
        const userId = await getUserId();

        // 🚀 ROUTING: Trips -> RPC
        if (table === 'trips') {
            return this.updateTripRPC(item);
        }
        // 🚀 ROUTING: Transactions -> RPC
        if (table === 'transactions' && item.id) {
            return this.updateTransactionRPC(item);
        }

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

        // ATOMIC RPC CALL
        const { error } = await supabase.rpc('delete_trip_cascade_rpc', {
            p_trip_id: tripId,
            p_user_id: userId
        });

        if (error) {
            console.error("Failed to execute atomic delete_trip_cascade_rpc:", error);
            throw error;
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
        // 1. Delete Old Series
        await this.deleteTransactionSeries(oldSeriesId);

        // 2. Create New Items via Validated RPC
        for (const tx of newTransactions) {
            await this.createTransactionWithValidation(tx);
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
    async getTrips(): Promise<Trip[]> {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return [];
        const userId = user.id;
        const userEmail = user.email;

        let query = supabase
            .from('trips')
            .select('*')
            .eq('deleted', false);

        // Fetch Own Trips OR Shared Trips (where I am a participant by email)
        if (userEmail) {
            // Use Supabase 'or' syntax with JSONB containment
            // user_id.eq.ID, or participants.cs.[{"email":"EMAIL"}]
            query = query.or(`user_id.eq.${userId},participants.cs.[{"email": "${userEmail}"}]`);
        } else {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query.order('start_date', { ascending: false });

        if (error) {
            console.error('Error fetching trips:', error);
            return [];
        }
        return mapToApp<Trip[]>(data);
    },

    async getFamilyMembers(): Promise<FamilyMember[]> { return this.getAll<FamilyMember>('family_members'); },
    async getGoals(): Promise<Goal[]> { return this.getAll<Goal>('goals'); },
    async getBudgets(): Promise<Budget[]> { return this.getAll<Budget>('budgets'); },
    async getAssets(): Promise<Asset[]> { return this.getAll<Asset>('assets'); },
    async getCustomCategories(): Promise<CustomCategory[]> { return this.getAll<CustomCategory>('custom_categories'); },
    async getSnapshots(): Promise<Snapshot[]> { return this.getAll<Snapshot>('snapshots'); },

    async bulkDelete(table: string, ids: string[]) {
        if (!ids.length) return;
        const { error } = await supabase
            .from(table)
            .update({ deleted: true }) // Soft Delete
            .in('id', ids);

        if (error) throw error;
    },

    // DANGER: WIPE ALL DATA (SAFE MODE)
    // SMART FACTORY RESET
    async performSmartReset(unlinkFamily: boolean = false) {
        const userId = await getUserId();
        console.warn(`🚨 INICIANDO SMART RESET (Unlink Family: ${unlinkFamily}) PARA USUÁRIO: ${userId}`);

        // Call the new Logic-Aware RPC
        const { error } = await supabase.rpc('fn_smart_factory_reset', {
            p_unlink_family: unlinkFamily
        });

        if (error) {
            console.error('Falha ao resetar dados (Smart RPC):', error);
            throw error;
        }

        console.log('✅ SMART RESET CONCLUÍDO COM SUCESSO.');
    },

    // User Settings
    async getUserSettings(userId: string): Promise<UserSettings | null> {
        const { data, error } = await supabase
            .from('user_settings')
            .select('*')
            .eq('user_id', userId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') return null; // Not found
            throw error;
        }

        return data as UserSettings;
    },

    async upsertUserSettings(userId: string, settings: UserSettings): Promise<void> {
        const { error } = await supabase
            .from('user_settings')
            .upsert({
                user_id: userId,
                notifications: settings.notifications,
                security: settings.security,
                preferences: settings.preferences,
                privacy: settings.privacy,
                appearance: settings.appearance,
                updated_at: new Date().toISOString()
            });

        if (error) throw error;
    },

    async checkTripExists(userId: string, name: string, startDate: string): Promise<boolean> {
        const { data, error } = await supabase
            .from('trips')
            .select('id')
            .eq('user_id', userId)
            .ilike('name', name)
            .eq('start_date', startDate)
            .eq('deleted', false)
            .maybeSingle();

        if (error) throw error;
        return !!data;
    }
};