import pg from 'pg';

const { Client } = pg;

// Connection string from existing scripts
const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function optimizeDatabase() {
    try {
        console.log('🔌 Connecting to Supabase Postgres...');
        await client.connect();
        console.log('✅ Connected successfully.\n');

        console.log('🛠️ Creating RPC function: get_account_totals...');

        // LOGIC: Recalculate balances server-side
        // Note: We cast SUM to numeric and handle NULLs with COALESCE.
        // We filter by user_id AND deleted=false.
        // PayerId check: (payer_id IS NULL OR payer_id = 'me' OR payer_id = 'user')

        await client.query(`
            CREATE OR REPLACE FUNCTION get_account_totals(p_user_id UUID)
            RETURNS TABLE (
                account_id UUID,
                calculated_balance NUMERIC
            ) 
            LANGUAGE plpgsql
            SECURITY DEFINER
            AS $$
            BEGIN
                RETURN QUERY
                SELECT
                    a.id as account_id,
                    (
                        COALESCE(a.initial_balance, 0) + 
                        COALESCE(SUM(
                            CASE
                                -- Outgoing (Expense or Transfer Out from this account)
                                WHEN t.account_id = a.id AND t.type IN ('EXPENSE', 'TRANSFER') THEN -t.amount
                                
                                -- Incoming (Income into this account)
                                WHEN t.account_id = a.id AND t.type = 'INCOME' THEN t.amount
                                
                                -- Incoming Transfer (Transfer In to this account)
                                WHEN t.destination_account_id = a.id AND t.type = 'TRANSFER' THEN
                                    CASE
                                        WHEN t.destination_amount IS NOT NULL THEN t.destination_amount
                                        ELSE t.amount -- Fallback for same currency
                                    END
                                ELSE 0
                            END
                        ), 0)
                    ) as calculated_balance
                FROM accounts a
                LEFT JOIN transactions t ON 
                    (t.account_id = a.id OR t.destination_account_id = a.id)
                    AND t.deleted = false
                    AND (t.payer_id IS NULL OR t.payer_id = 'me' OR t.payer_id = 'user') -- Ignore expenses paid by others
                WHERE a.user_id = p_user_id 
                  AND a.deleted = false
                GROUP BY a.id, a.initial_balance;
            END;
            $$;
        `);

        console.log('   ✅ RPC function created successfully.');

        console.log('\n🎉 Database optimization complete!');

    } catch (err) {
        console.error('❌ Error executing optimization:', err.message);
        console.error(err.stack);
    } finally {
        await client.end();
        console.log('🔌 Connection closed.');
    }
}

optimizeDatabase();
