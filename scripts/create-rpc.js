import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string used in other scripts
const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runSql() {
    try {
        console.log('Connecting to Supabase Postgres...');
        await client.connect();
        console.log('Connected.');

        const sqlPath = path.join(__dirname, '../CREATE_RPC_GET_ACCOUNT_TOTALS.sql');
        const sql = fs.readFileSync(sqlPath, 'utf8');

        console.log('Executing SQL...');
        await client.query(sql);
        console.log('✅ RPC get_account_totals created successfully!');

    } catch (err) {
        console.error('❌ Error executing SQL:', err.message);
    } finally {
        await client.end();
        console.log('Connection closed.');
    }
}

runSql();
