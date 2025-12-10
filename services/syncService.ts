import { supabaseService } from './supabaseService';
import { Transaction } from '../types';

const QUEUE_KEY = 'pe_sync_queue';

export type SyncOperation =
    | { type: 'ADD_TRANSACTION'; payload: any } // using any to accommodate omit<id> logic if needed, but preferably full object
    | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
    | { type: 'DELETE_TRANSACTION'; payload: string }; // ID

interface QueueItem {
    id: string;
    op: SyncOperation;
    timestamp: number;
}

export const SyncService = {
    getQueue: (): QueueItem[] => {
        try {
            const stored = localStorage.getItem(QUEUE_KEY);
            return stored ? JSON.parse(stored) : [];
        } catch {
            return [];
        }
    },

    addToQueue: (op: SyncOperation) => {
        const queue = SyncService.getQueue();
        const item: QueueItem = {
            id: crypto.randomUUID(),
            op,
            timestamp: Date.now()
        };
        queue.push(item);
        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
        } catch (e) {
            console.warn('Sync queue write failed', e);
        }
    },

    clearQueue: () => {
        try {
            localStorage.removeItem(QUEUE_KEY);
        } catch (e) {
            console.warn('Sync queue clear failed', e);
        }
    },

    removeFromQueue: (id: string) => {
        const queue = SyncService.getQueue();
        const newQueue = queue.filter(item => item.id !== id);

        try {
            localStorage.setItem(QUEUE_KEY, JSON.stringify(newQueue));
        } catch (e) {
            console.warn('Sync queue remove failed', e);
        }
    },

    processQueue: async (): Promise<{ success: number; failed: number }> => {
        const queue = SyncService.getQueue();
        if (queue.length === 0) return { success: 0, failed: 0 };

        let successCount = 0;
        let failedCount = 0;

        // Process sequentially to maintain order logic
        for (const item of queue) {
            try {
                switch (item.op.type) {
                    case 'ADD_TRANSACTION':
                        // Check if it already exists (idempotency) to avoid duplicates if partial fail
                        await supabaseService.create('transactions', item.op.payload);
                        break;
                    case 'UPDATE_TRANSACTION':
                        await supabaseService.update('transactions', item.op.payload);
                        break;
                    case 'DELETE_TRANSACTION':
                        await supabaseService.delete('transactions', item.op.payload);
                        break;
                }
                // If successful, remove from queue
                SyncService.removeFromQueue(item.id);
                successCount++;
            } catch (error) {
                console.error(`Failed to sync item ${item.id}`, error);
                failedCount++;
                // Keep in queue for retry? Or move to 'dead letter queue'?
                // For now, keep in queue.
            }
        }

        return { success: successCount, failed: failedCount };
    }
};
