import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || import.meta.env.SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || import.meta.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Key is missing. Please check .env.local');
}

// Custom storage adapter to handle restricted environments (e.g. Incognito, strict privacy settings)
// where accessing localStorage throws "Access to storage is not allowed"
const safeLocalStorage = {
    getItem: (key: string): string | null => {
        try {
            return localStorage.getItem(key);
        } catch (error) {
            console.warn('LocalStorage access restricted, falling back to memory (read)', error);
            return null;
        }
    },
    setItem: (key: string, value: string): void => {
        try {
            localStorage.setItem(key, value);
        } catch (error) {
            console.warn('LocalStorage access restricted, falling back to memory (write)', error);
        }
    },
    removeItem: (key: string): void => {
        try {
            localStorage.removeItem(key);
        } catch (error) {
            console.warn('LocalStorage access restricted (remove)', error);
        }
    }
};

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        storage: safeLocalStorage,
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});