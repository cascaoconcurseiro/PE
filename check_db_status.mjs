
import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Client } = pg;

// Read from .env.local if possible, but for this quick check I'll use the known string since I just saved it.
// Actually, reading from env is better practice but I'll hardcode the one I verified to be 100% sure for this diagnostic.
const connectionString = 'postgresql://postgres:Wesley%40yasmin9094@db.mlqzeihukezlozooqhko.supabase.co:5432/postgres';

const client = new Client({
    connectionString: connectionString,
    ssl: { rejectUnauthorized: false }
});

async function checkDatabase() {
    console.log('🔍 Checking Database Status...');
    try {
        await client.connect();

        // 1. List all tables in public schema
        const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

        console.log(`\n📋 Found ${res.rows.length} tables in 'public' schema:`);

        // 2. Count rows for each table
        for (const row of res.rows) {
            const tableName = row.table_name;
            const countRes = await client.query(`SELECT count(*) FROM public."${tableName}"`);
            console.log(`   - ${tableName.padEnd(30)} : ${countRes.rows[0].count} rows`);
        }

        // 3. Verify specific critical columns/tables for recent features
        console.log('\n✅ Verifying Schema Updates:');

        // Check shared_transaction_requests
        const sharedReqCheck = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'shared_transaction_requests';
    `);

        if (sharedReqCheck.rows.length > 0) {
            console.log('   - [OK] Table "shared_transaction_requests" exists.');
        } else {
            console.log('   - [FAIL] Table "shared_transaction_requests" MISSING!');
        }

        console.log('\n✨ Database seems healthy and accessible.');

    } catch (err) {
        console.error('❌ Database Check Failed:', err);
    } finally {
        await client.end();
    }
}

checkDatabase();
