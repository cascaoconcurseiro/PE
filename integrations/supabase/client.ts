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

// Custom storage adapter to handle restricted environments (e.g. Incognito, strict privacy settings)
// where accessing localStorage throws "Access to storage is not allowed"
const memoryStore: Record<string, string> = {};

// LocalStorage references removed to prevent 'Access to storage is not allowed' errors in strict environments.
const safeLocalStorage = {
    getItem: (key: string): string | null => null,
    setItem: (key: string, value: string): void => { },
    removeItem: (key: string): void => { }
};

const memoryStorage = {
    getItem: (key: string) => { return null; },
    setItem: (key: string, value: string) => { },
    removeItem: (key: string) => { }
};

export const supabase = createClient(supabaseUrl || '', supabaseKey || '', {
    auth: {
        storage: memoryStorage, // Force memory storage
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false
    }
});