const PREFIX = 'pe_cache_';
const EXPIRY = 1000 * 60 * 60 * 24; // 24 hours

interface CacheItem<T> {
    data: T;
    timestamp: number;
    version: string;
}

export const CacheService = {
    set: <T>(key: string, data: T): void => {
        try {
            const item: CacheItem<T> = {
                data,
                timestamp: Date.now(),
                version: '1.0'
            };
            localStorage.setItem(PREFIX + key, JSON.stringify(item));
        } catch (e) {
            console.warn('Cache write failed', e);
        }
    },

    get: <T>(key: string): T | null => {
        try {
            const stored = localStorage.getItem(PREFIX + key);
            if (!stored) return null;

            const item: CacheItem<T> = JSON.parse(stored);

            // Check expiry (optional, depends on strategy)
            if (Date.now() - item.timestamp > EXPIRY) {
                // localStorage.removeItem(PREFIX + key);
                // return null;
                // For offline first, we might want to return expired data if network fail
                return item.data;
            }

            return item.data;
        } catch (e) {
            console.warn('Cache read failed', e);
            return null;
        }
    },

    clear: (key: string): void => {
        try {
            localStorage.removeItem(PREFIX + key);
        } catch (e) {
            console.warn('Cache clear failed', e);
        }
    },

    clearAll: (): void => {
        try {
            Object.keys(localStorage).forEach(key => {
                if (key.startsWith(PREFIX)) {
                    localStorage.removeItem(key);
                }
            });
        } catch (e) {
            console.warn('Cache clearAll failed', e);
        }
    }
};
