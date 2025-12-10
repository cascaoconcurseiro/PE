import { supabaseService } from './supabaseService';
import { Transaction } from '../types';

export type SyncOperation =
    | { type: 'ADD_TRANSACTION'; payload: any }
    | { type: 'UPDATE_TRANSACTION'; payload: Transaction }
    | { type: 'DELETE_TRANSACTION'; payload: string };

interface QueueItem {
    id: string;
    op: SyncOperation;
    timestamp: number;
}

// In-memory queue (non-persistent)
let memoryQueue: QueueItem[] = [];

export const SyncService = {
    getQueue: (): QueueItem[] => {
        return memoryQueue;
    },

    addToQueue: (op: SyncOperation) => {
        const item: QueueItem = {
            id: crypto.randomUUID(),
            op,
            timestamp: Date.now()
        };
        memoryQueue.push(item);
    },

    clearQueue: () => {
        memoryQueue = [];
    },

    removeFromQueue: (id: string) => {
        memoryQueue = memoryQueue.filter(item => item.id !== id);
    },

    processQueue: async (): Promise<{ success: number; failed: number }> => {
        const queue = SyncService.getQueue();
        if (queue.length === 0) return { success: 0, failed: 0 };

        let successCount = 0;
        let failedCount = 0;

        // Clone queue to avoid modification issues during iteration, or handle carefully
        // We modify 'memoryQueue' via removeFromQueue inside loop.
        const snapshot = [...queue];

        for (const item of snapshot) {
            try {
                // Verify item is still in queue (sync concurrency)
                if (!memoryQueue.find(q => q.id === item.id)) continue;

                switch (item.op.type) {
                    case 'ADD_TRANSACTION':
                        await supabaseService.create('transactions', item.op.payload);
                        break;
                    case 'UPDATE_TRANSACTION':
                        await supabaseService.update('transactions', item.op.payload);
                        break;
                    case 'DELETE_TRANSACTION':
                        await supabaseService.delete('transactions', item.op.payload);
                        break;
                }

                SyncService.removeFromQueue(item.id);
                successCount++;
            } catch (error) {
                console.error(`Failed to sync item ${item.id}`, error);
                failedCount++;
            }
        }

        return { success: successCount, failed: failedCount };
    }
};
