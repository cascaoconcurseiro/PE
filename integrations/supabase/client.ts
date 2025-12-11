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
// LocalStorage is explicitly EXCLUDED by system audit.
const robustStorageAdapter = (() => {
    let memoryStore: Record<string, string> = {};


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

    // LocalStorage Logic Removed by Audit Request

    return {
        getItem: (key: string): string | null => {
            // Priority: Cookie -> Memory (NO LocalStorage)

            // 1. Try Cookie
            const cookieItem = getCookie(key);
            if (cookieItem) return cookieItem;

            // 2. Memory
            return memoryStore[key] || null;
        },
        setItem: (key: string, value: string): void => {
            // Priority: Cookie -> Memory

            // 1. Try Cookie
            try {
                setCookie(key, value);
            } catch (e) {
                // Ignore
            }

            // 2. Memory
            memoryStore[key] = value;
        },
        removeItem: (key: string): void => {
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