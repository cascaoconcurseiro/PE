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
// Priority: LocalStorage -> Cookie -> Memory
// This ensures persistence even if LocalStorage is blocked (common in embedded views/incognito).
const robustStorageAdapter = (() => {
    let memoryStore: Record<string, string> = {};
    let isStorageAvailable = false;

    // Cookie Helpers
    const setCookie = (name: string, value: string, days = 365) => {
        try {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();
            document.cookie = name + "=" + encodeURIComponent(value) + ";" + expires + ";path=/;SameSite=Lax";
        } catch (e) {
            // Ignore cookie errors
        }
    };

    const getCookie = (name: string): string | null => {
        try {
            const nameEQ = name + "=";
            const ca = document.cookie.split(';');
            for (let i = 0; i < ca.length; i++) {
                let c = ca[i];
                while (c.charAt(0) === ' ') c = c.substring(1, c.length);
                if (c.indexOf(nameEQ) === 0) return decodeURIComponent(c.substring(nameEQ.length, c.length));
            }
        } catch (e) {
            // Ignore
        }
        return null;
    };

    const removeCookie = (name: string) => {
        try {
            document.cookie = name + "=; Path=/; Expires=Thu, 01 Jan 1970 00:00:01 GMT;";
        } catch (e) {
            // Ignore
        }
    };

    // Initial check for LocalStorage
    try {
        if (typeof window !== 'undefined' && window.localStorage) {
            const testKey = '__storage_test__';
            window.localStorage.setItem(testKey, testKey);
            window.localStorage.removeItem(testKey);
            isStorageAvailable = true;
        }
    } catch (e) {
        console.warn('⚠️ LocalStorage is blocked. Falling back to Cookies/Memory.');
        isStorageAvailable = false;
    }

    return {
        getItem: (key: string): string | null => {
            // 1. Try LocalStorage
            if (isStorageAvailable) {
                try {
                    const item = window.localStorage.getItem(key);
                    if (item) return item;
                } catch (e) { /* Ignore */ }
            }

            // 2. Try Cookie (Fallback)
            const cookieItem = getCookie(key);
            if (cookieItem) return cookieItem;

            // 3. Memory (Last Resort)
            return memoryStore[key] || null;
        },
        setItem: (key: string, value: string): void => {
            // 1. Try LocalStorage
            if (isStorageAvailable) {
                try {
                    window.localStorage.setItem(key, value);
                    // Also set cookie as backup? No, duplication might be messy. 
                    // But if LS fails randomly later, cookie is good. 
                    // Let's stick to one primary source to avoid sync issues.
                    return;
                } catch (error) {
                    console.warn('LocalStorage write failed, switching to Cookie.');
                }
            }

            // 2. Try Cookie
            try {
                setCookie(key, value);
                return;
            } catch (e) {
                // Ignore
            }

            // 3. Memory
            memoryStore[key] = value;
        },
        removeItem: (key: string): void => {
            // Aggressively clear EVERYTHING to ensure logout
            if (isStorageAvailable) {
                try { window.localStorage.removeItem(key); } catch (e) { }
            }
            removeCookie(key);
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