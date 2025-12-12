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
// Priority: Cookie -> Memory
// LocalStorage Logic Restored for 'Remember Me'
// We wrap in try-catch to avoid "Access denied" crashes in restrictive environments.
const safeLocalStorage = {
    getItem: (key: string): string | null => {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    },
    setItem: (key: string, value: string): void => {
        try { localStorage.setItem(key, value); } catch (e) { }
    },
    removeItem: (key: string): void => {
        try { localStorage.removeItem(key); } catch (e) { }
    }
};

return {
    getItem: (key: string): string | null => {
        // Priority: LocalStorage -> Cookie -> Memory

        // 1. LocalStorage
        const localItem = safeLocalStorage.getItem(key);
        if (localItem) return localItem;

        // 2. Cookie (Fallback)
        const cookieItem = getCookie(key);
        if (cookieItem) return cookieItem;

        // 3. Memory (Last Resort)
        return memoryStore[key] || null;
    },
    setItem: (key: string, value: string): void => {
        // Priority: LocalStorage -> Cookie -> Memory

        // 1. LocalStorage
        safeLocalStorage.setItem(key, value);

        // 2. Cookie
        try {
            setCookie(key, value);
        } catch (e) {
            // Ignore
        }

        // 3. Memory
        memoryStore[key] = value;
    },
    removeItem: (key: string): void => {
        safeLocalStorage.removeItem(key);
        removeCookie(key);
        delete memoryStore[key];
    }
};
}) ();

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        storage: robustStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});