import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1scXplaWh1a2V6bG96b29xaGtvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjI5NDUzNTIsImV4cCI6MjA3ODUyMTM1Mn0.a5c7KqOcW3PVG8HpSoRXXkTX2x1ziHlTW0fmlatWGZg';

const supabase = createClient(supabaseUrl, supabaseKey);

async function createUserSettingsTable() {
    console.log('🔧 Creating user_settings table...\n');

    try {
        // Read SQL file
        const sqlPath = path.join(__dirname, 'CREATE_USER_SETTINGS_TABLE.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        // Execute SQL (note: this requires service_role key for DDL operations)
        console.log('⚠️  Note: This script requires SUPABASE_SERVICE_ROLE_KEY');
        console.log('📋 Please run the SQL manually in Supabase SQL Editor:\n');
        console.log('1. Go to https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql');
        console.log('2. Copy the content of CREATE_USER_SETTINGS_TABLE.sql');
        console.log('3. Paste and run it\n');

        // Verify if table exists (this will work with anon key)
        const { data, error } = await supabase
            .from('user_settings')
            .select('count')
            .limit(1);

        if (error) {
            if (error.message.includes('relation "public.user_settings" does not exist')) {
                console.log('❌ Table user_settings does NOT exist yet');
                console.log('👉 Please create it using the SQL Editor as described above\n');
            } else {
                console.log('❌ Error checking table:', error.message);
            }
        } else {
            console.log('✅ Table user_settings already exists!');
        }

    } catch (err) {
        console.error('❌ Error:', err.message);
    }
}

createUserSettingsTable();
