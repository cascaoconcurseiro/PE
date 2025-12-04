import pg from 'pg';

const { Client } = pg;

const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
});

async function verifyChanges() {
    try {
        await client.connect();
        console.log('Connected to database\n');

        // Check payer_id type
        const typeResult = await client.query(`
            SELECT data_type 
            FROM information_schema.columns
            WHERE table_name = 'transactions' 
              AND column_name = 'payer_id'
        `);
        console.log('payer_id type:', typeResult.rows[0]?.data_type || 'NOT FOUND');

        // Check if new fields exist
        const fieldsResult = await client.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_name = 'transactions' 
              AND column_name IN ('related_member_id', 'settled_by_tx_id', 'reconciled', 'reconciled_with', 'destination_amount', 'exchange_rate')
            ORDER BY column_name
        `);
        console.log('\nNew fields found:', fieldsResult.rows.map(r => r.column_name).join(', '));

        // Count indexes
        const indexResult = await client.query(`
            SELECT COUNT(*) as count
            FROM pg_indexes
            WHERE tablename = 'transactions'
        `);
        console.log('\nTotal indexes on transactions:', indexResult.rows[0].count);

        // Count constraints
        const constraintResult = await client.query(`
            SELECT conname
            FROM pg_constraint
            WHERE conrelid = 'public.transactions'::regclass
              AND conname LIKE 'check_%'
            ORDER BY conname
        `);
        console.log('\nCheck constraints:', constraintResult.rows.map(r => r.conname).join(', '));

        console.log('\n✅ Verification complete!');

    } catch (err) {
        console.error('Error:', err.message);
    } finally {
        await client.end();
    }
}

verifyChanges();
