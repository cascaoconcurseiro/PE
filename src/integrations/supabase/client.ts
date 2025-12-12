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
const robustStorageAdapter = (() => {
    let memoryStore: Record<string, string> = {};

    // Cookie Helpers
    const setCookie = (name: string, value: string, days = 365) => {
        try {
            const date = new Date();
            date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
            const expires = "expires=" + date.toUTCString();
            const isSecure = window.location.protocol === 'https:';
            // Use SameSite=None; Secure for broader compatibility in iframes/safari, fallback to Lax
            const sameSite = isSecure ? "SameSite=None; Secure" : "SameSite=Lax";
            document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;${sameSite}`;
        } catch (e) {
            console.warn("Cookie storage failed:", e);
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

    // Safe LocalStorage
    const safeLocalStorage = {
        getItem: (key: string): string | null => {
            try { return localStorage.getItem(key); } catch (e) { return null; }
        },
        setItem: (key: string, value: string): void => {
            try { localStorage.setItem(key, value); } catch (e) {
                console.warn("LocalStorage setItem failed (using fallback):", e);
            }
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
})();

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        storage: robustStorageAdapter,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});