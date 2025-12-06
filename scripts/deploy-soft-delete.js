import pg from 'pg';

const { Client } = pg;

const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function deploySoftDelete() {
    try {
        console.log('🔌 Connecting to Supabase Postgres...');
        await client.connect();
        console.log('✅ Connected successfully.\n');

        console.log('🛠️ Creating RPC function: soft_delete_account...');

        // LOGIC: Atomic soft delete of Account + Related Transactions
        await client.query(`
            CREATE OR REPLACE FUNCTION soft_delete_account(p_account_id UUID, p_user_id UUID)
            RETURNS VOID
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                -- 1. Soft delete transactions where this account is origin OR destination
                UPDATE transactions
                SET 
                    deleted = true,
                    updated_at = NOW()
                WHERE 
                    user_id = p_user_id 
                    AND deleted = false
                    AND (account_id = p_account_id OR destination_account_id = p_account_id);

                -- 2. Soft delete the account itself
                UPDATE accounts
                SET 
                    deleted = true,
                    updated_at = NOW()
                WHERE 
                    id = p_account_id 
                    AND user_id = p_user_id;
            END;
            $$;
        `);

        console.log('   ✅ RPC function created successfully.');

    } catch (err) {
        console.error('❌ Error executing deployment:', err.message);
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

deploySoftDelete();
