export const CacheService = {
    set: <T>(key: string, data: T): void => {
        // No-op: Caching disabled by strict no-storage policy
    },

    get: <T>(key: string): T | null => {
        // Always return null to force database fetch
        return null;
    },

    clear: (key: string): void => {
        // No-op
    },

    clearAll: (): void => {
        // No-op
    }
};
