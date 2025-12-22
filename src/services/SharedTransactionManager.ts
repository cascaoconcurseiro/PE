/**
 * SharedTransactionManager - Centralized service for shared transaction operations
 * 
 * Handles all shared transaction logic with local caching and automatic synchronization
 * Requirements: 2.1, 2.2
 */

import { createClient } from '@supabase/supabase-js';

// Simple EventEmitter implementation for browser compatibility
class SimpleEventEmitter {
    private events: { [key: string]: Function[] } = {};

    on(event: string, listener: Function) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(listener);
    }

    emit(event: string, ...args: any[]) {
        if (this.events[event]) {
            this.events[event].forEach(listener => listener(...args));
        }
    }

    off(event: string, listener: Function) {
        if (this.events[event]) {
            this.events[event] = this.events[event].filter(l => l !== listener);
        }
    }
}

// Types
interface SharedTransaction {
    id: string;
    user_id: string;
    description: string;
    amount: number;
    category_id: string;
    account_id: string;
    status: 'pending' | 'completed' | 'failed';
    shared_with: SharedParticipant[];
    created_at: string;
    updated_at: string;
}

interface SharedParticipant {
    user_id: string;
    amount: number;
    status: 'pending' | 'accepted' | 'rejected' | 'paid';
    request_id?: string;
}

interface SharedRequest {
    id: string;
    original_transaction_id: string;
    requested_by_user_id: string;
    requested_to_user_id: string;
    amount: number;
    description: string;
    status: 'pending' | 'accepted' | 'rejected';
    created_at: string;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

class SharedTransactionManager extends SimpleEventEmitter {
    private supabase = createClient(
        process.env.VITE_SUPABASE_URL!,
        process.env.VITE_SUPABASE_ANON_KEY!
    );
    
    private cache = new Map<string, CacheEntry<any>>();
    private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    private syncInterval: number | null = null;
    
    constructor() {
        super();
        this.startAutoSync();
        this.setupRealtimeSubscriptions();
    }

    // ==================
    // CACHE MANAGEMENT
    // ==================

    private getCacheKey(type: string, id: string): string {
        return `${type}:${id}`;
    }

    private setCache<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
        this.cache.set(key, {
            data,
            timestamp: Date.now(),
            ttl
        });
    }

    private getCache<T>(key: string): T | null {
        const entry = this.cache.get(key);
        if (!entry) return null;
        
        if (Date.now() - entry.timestamp > entry.ttl) {
            this.cache.delete(key);
            return null;
        }
        
        return entry.data as T;
    }

    private invalidateCache(pattern: string): void {
        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.cache.delete(key);
            }
        }
    }

    // ==================
    // SHARED TRANSACTION OPERATIONS
    // ==================

    async createSharedTransaction(data: {
        description: string;
        amount: number;
        category_id: string;
        account_id: string;
        shared_with: { user_id: string; amount: number }[];
        installments?: number;
        due_date?: string;
    }): Promise<{ success: boolean; data?: any; error?: string }> {
        try {
            // Use the recovery system wrapper for automatic retry
            const { data: result, error } = await this.supabase.rpc('create_shared_transaction_with_retry', {
                p_transaction_data: {
                    description: data.description,
                    amount: data.amount,
                    category_id: data.category_id,
                    account_id: data.account_id,
                    shared_with: data.shared_with,
                    installments: data.installments || 1,
                    due_date: data.due_date
                },
                p_user_id: (await this.supabase.auth.getUser()).data.user?.id
            });

            if (error) {
                console.error('Error creating shared transaction:', error);
                return { success: false, error: error.message };
            }

            // Invalidate relevant caches
            this.invalidateCache('shared_transactions');
            this.invalidateCache('shared_requests');
            
            // Emit event for UI updates
            this.emit('transactionCreated', result);
            
            return { success: true, data: result };
        } catch (error) {
            console.error('Unexpected error creating shared transaction:', error);
            return { success: false, error: 'Unexpected error occurred' };
        }
    }

    async getSharedTransactions(userId: string, forceRefresh: boolean = false): Promise<SharedTransaction[]> {
        const cacheKey = this.getCacheKey('shared_transactions', userId);
        
        if (!forceRefresh) {
            const cached = this.getCache<SharedTransaction[]>(cacheKey);
            if (cached) return cached;
        }

        try {
            const { data, error } = await this.supabase
                .from('shared_transaction_mirrors')
                .select(`
                    *,
                    original_transaction:transactions(*)
                `)
                .eq('user_id', userId)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const transactions = data?.map(mirror => ({
                id: mirror.id,
                user_id: mirror.user_id,
                description: mirror.description,
                amount: mirror.amount,
                category_id: mirror.category_id,
                account_id: mirror.account_id,
                status: mirror.status,
                shared_with: [], // Will be populated separately
                created_at: mirror.created_at,
                updated_at: mirror.updated_at
            })) || [];

            this.setCache(cacheKey, transactions);
            return transactions;
        } catch (error) {
            console.error('Error fetching shared transactions:', error);
            return [];
        }
    }

    async getSharedRequests(userId: string, forceRefresh: boolean = false): Promise<SharedRequest[]> {
        const cacheKey = this.getCacheKey('shared_requests', userId);
        
        if (!forceRefresh) {
            const cached = this.getCache<SharedRequest[]>(cacheKey);
            if (cached) return cached;
        }

        try {
            const { data, error } = await this.supabase
                .from('shared_transaction_requests')
                .select('*')
                .eq('requested_to_user_id', userId)
                .eq('status', 'pending')
                .order('created_at', { ascending: false });

            if (error) throw error;

            const requests = data || [];
            this.setCache(cacheKey, requests);
            return requests;
        } catch (error) {
            console.error('Error fetching shared requests:', error);
            return [];
        }
    }

    async respondToSharedRequest(
        requestId: string, 
        response: 'accept' | 'reject',
        accountId?: string
    ): Promise<{ success: boolean; error?: string }> {
        try {
            const { data, error } = await this.supabase.rpc('respond_to_shared_request_v2', {
                p_request_id: requestId,
                p_response: response,
                p_account_id: accountId,
                p_user_id: (await this.supabase.auth.getUser()).data.user?.id
            });

            if (error) {
                console.error('Error responding to shared request:', error);
                return { success: false, error: error.message };
            }

            // Invalidate caches
            this.invalidateCache('shared_requests');
            this.invalidateCache('shared_transactions');
            
            // Emit event
            this.emit('requestResponded', { requestId, response, data });
            
            return { success: true };
        } catch (error) {
            console.error('Unexpected error responding to request:', error);
            return { success: false, error: 'Unexpected error occurred' };
        }
    }

    async syncSharedTransaction(transactionId: string): Promise<{ success: boolean; error?: string }> {
        try {
            const userId = (await this.supabase.auth.getUser()).data.user?.id;
            if (!userId) {
                return { success: false, error: 'User not authenticated' };
            }

            const { data, error } = await this.supabase.rpc('sync_shared_transaction_with_retry', {
                p_transaction_id: transactionId,
                p_user_id: userId
            });

            if (error) {
                console.error('Error syncing shared transaction:', error);
                return { success: false, error: error.message };
            }

            // Invalidate caches
            this.invalidateCache('shared_transactions');
            
            // Emit event
            this.emit('transactionSynced', { transactionId, data });
            
            return { success: true };
        } catch (error) {
            console.error('Unexpected error syncing transaction:', error);
            return { success: false, error: 'Unexpected error occurred' };
        }
    }

    // ==================
    // BATCH OPERATIONS
    // ==================

    async importSharedInstallments(data: {
        transactions: Array<{
            description: string;
            amount: number;
            category_id: string;
            account_id: string; // Será ignorado na nova função
            shared_with: { user_id: string; amount: number }[];
            installment_number: number;
            total_installments: number;
            due_date: string;
        }>;
    }): Promise<{ success: boolean; results: any[]; errors: string[] }> {
        const results: any[] = [];
        const errors: string[] = [];

        for (const transaction of data.transactions) {
            try {
                // CORREÇÃO: Usar função específica para importação que não afeta contas
                const { data: result, error } = await this.supabase.rpc('import_shared_installment_v2', {
                    p_description: transaction.description,
                    p_amount: transaction.amount,
                    p_category: transaction.category_id,
                    p_date: transaction.due_date,
                    p_shared_splits: transaction.shared_with.map(split => ({
                        user_id: split.user_id,
                        amount: split.amount,
                        email: '' // Será preenchido pela função se necessário
                    })),
                    p_installment_data: {
                        current: transaction.installment_number,
                        total: transaction.total_installments,
                        series_id: null // Será gerado automaticamente
                    }
                });

                if (error) {
                    errors.push(`Failed to import installment ${transaction.installment_number}: ${error.message}`);
                } else {
                    results.push(result);
                }
            } catch (error: any) {
                errors.push(`Failed to import installment ${transaction.installment_number}: ${error.message}`);
            }
        }

        return {
            success: errors.length === 0,
            results,
            errors
        };
    }

    // ==================
    // REAL-TIME SYNCHRONIZATION
    // ==================

    private setupRealtimeSubscriptions(): void {
        // Subscribe to shared transaction requests
        this.supabase
            .channel('shared_requests')
            .on('postgres_changes', 
                { event: '*', schema: 'public', table: 'shared_transaction_requests' },
                (payload) => {
                    this.handleRealtimeUpdate('shared_requests', payload);
                }
            )
            .subscribe();

        // Subscribe to shared transaction mirrors
        this.supabase
            .channel('shared_mirrors')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'shared_transaction_mirrors' },
                (payload) => {
                    this.handleRealtimeUpdate('shared_transactions', payload);
                }
            )
            .subscribe();
    }

    private handleRealtimeUpdate(type: string, payload: any): void {
        // Invalidate relevant caches
        this.invalidateCache(type);
        
        // Emit events for UI updates
        this.emit('realtimeUpdate', { type, payload });
        
        switch (payload.eventType) {
            case 'INSERT':
                this.emit(`${type}Created`, payload.new);
                break;
            case 'UPDATE':
                this.emit(`${type}Updated`, payload.new);
                break;
            case 'DELETE':
                this.emit(`${type}Deleted`, payload.old);
                break;
        }
    }

    private startAutoSync(): void {
        // Sync every 30 seconds
        this.syncInterval = setInterval(() => {
            this.performAutoSync();
        }, 30000);
    }

    private async performAutoSync(): Promise<void> {
        try {
            const userId = (await this.supabase.auth.getUser()).data.user?.id;
            if (!userId) return;

            // Force refresh of critical data
            await Promise.all([
                this.getSharedTransactions(userId, true),
                this.getSharedRequests(userId, true)
            ]);

            this.emit('autoSyncCompleted');
        } catch (error) {
            console.error('Auto sync failed:', error);
            this.emit('autoSyncFailed', error);
        }
    }

    // ==================
    // UTILITY METHODS
    // ==================

    async getOperationQueueStats(): Promise<any> {
        try {
            const { data, error } = await this.supabase.rpc('get_operation_queue_stats');
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting queue stats:', error);
            return null;
        }
    }

    async getReconciliationStats(): Promise<any> {
        try {
            const { data, error } = await this.supabase.rpc('get_inconsistency_stats');
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error getting reconciliation stats:', error);
            return null;
        }
    }

    clearCache(): void {
        this.cache.clear();
        this.emit('cacheCleared');
    }

    destroy(): void {
        if (this.syncInterval) {
            clearInterval(this.syncInterval);
            this.syncInterval = null;
        }
        
        this.cache.clear();
        this.removeAllListeners();
    }
}

// Singleton instance
export const sharedTransactionManager = new SharedTransactionManager();
export default SharedTransactionManager;