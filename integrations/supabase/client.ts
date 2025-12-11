import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

// Display clear error message if environment variables are missing
if (!supabaseUrl || !supabaseKey) {
    console.error(
        '❌ Supabase configuration missing!\n\n' +
        'Please create a .env.local file in the project root with:\n\n' +
        'VITE_SUPABASE_URL=https://mlqzeihukezlozooqhko.supabase.co\n' +
        'VITE_SUPABASE_ANON_KEY=your-anon-key-here\n\n' +
        'Get your anon key from: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/settings/api'
    );
}

// Robust Storage Adapter
// Attempts to use localStorage to keep user logged in.
// If valid storage access is blocked (e.g. strict rules), it silently falls back to in-memory storage.
// This allows the app to function (session-only) without crashing.
const robustStorageAdapter = (() => {
    let memoryStore: Record<string, string> = {};
    let isStorageAvailable = false;

    // Initial check
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const testKey = '__storage_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            isStorageAvailable = true;
        }
    } catch (e) {
        console.warn('⚠️ LocalStorage is blocked/unavailable. Session will not persist after refresh.');
        isStorageAvailable = false;
    }

    return {
        getItem: (key: string): string | null => {
            try {
                if (isStorageAvailable) {
                    return window.localStorage.getItem(key);
                }
            } catch (error) {
                // Ignore
            }
            return memoryStore[key] || null;
        },
        setItem: (key: string, value: string): void => {
            try {
                if (isStorageAvailable) {
                    window.localStorage.setItem(key, value);
                    return;
                }
            } catch (error) {
                // Determine if quota exceeded vs blocked
                // But in any case, fallback
            }
            memoryStore[key] = value;
        },
        removeItem: (key: string): void => {
            try {
                if (isStorageAvailable) {
                    window.localStorage.removeItem(key);
                    return;
                }
            } catch (error) {
                // Ignore
            }
            delete memoryStore[key];
        }
    };
})();

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        storage: robustStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});