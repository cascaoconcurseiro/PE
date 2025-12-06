import pg from 'pg';
import { fileURLToPath } from 'url';

const { Client } = pg;

// Connection string from existing scripts (scripts/apply-corrections.js)
const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runFix() {
    try {
        console.log('🔌 Connecting to Supabase Postgres...');
        await client.connect();
        console.log('✅ Connected successfully.\n');

        console.log('🛠️ Creating user_settings table...');

        await client.query(`
            CREATE TABLE IF NOT EXISTS public.user_settings (
                id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
                
                notifications JSONB DEFAULT '{
                    "enableBillReminders": true,
                    "enableBudgetAlerts": true,
                    "enableGoalReminders": true,
                    "reminderDaysBefore": 3,
                    "preferredNotificationTime": "09:00"
                }'::jsonb,
                
                security JSONB DEFAULT '{
                    "twoFactorEnabled": false,
                    "activeSessions": [],
                    "loginHistory": []
                }'::jsonb,
                
                preferences JSONB DEFAULT '{
                    "language": "pt-BR",
                    "dateFormat": "DD/MM/YYYY",
                    "timeFormat": "24h",
                    "weekStartsOn": "monday",
                    "defaultCurrency": "BRL"
                }'::jsonb,
                
                privacy JSONB DEFAULT '{
                    "shareAnalytics": false,
                    "hideBalanceInSharedScreens": false,
                    "familyMemberPermissions": {}
                }'::jsonb,
                
                appearance JSONB DEFAULT '{
                    "fontSize": "medium",
                    "density": "comfortable",
                    "customCategoryColors": {}
                }'::jsonb,
                
                created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
                
                UNIQUE(user_id)
            );
        `);
        console.log('   ✅ Table public.user_settings created/verified.');

        console.log('🔒 Enabling Row Level Security...');
        await client.query(`ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;`);
        console.log('   ✅ RLS Enabled.');

        console.log('👮 Create generic policy...');
        // Drop existing to avoid conflicts if re-running
        try {
            await client.query(`DROP POLICY IF EXISTS "Users can CRUD own settings" ON public.user_settings;`);
        } catch (e) { }

        await client.query(`
            CREATE POLICY "Users can CRUD own settings" ON public.user_settings
            FOR ALL USING (auth.uid() = user_id);
        `);
        console.log('   ✅ Policy created.');

        console.log('\n🎉 SUCCESS! user_settings table is ready.');

    } catch (err) {
        console.error('❌ Error executing fix:', err.message);
        console.error(err.stack);
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

runFix();
