import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string from user provided data (Non-pooling for DDL)
const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:K2VWCkfBQjoguxsZ@aws-1-us-east-1.pooler.supabase.com:5432/postgres";

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function setupDatabase() {
    try {
        console.log('Connecting to Supabase Postgres...');
        await client.connect();
        console.log('Connected.');

        // Rename 'limit' column to 'credit_limit' to avoid reserved keyword issues
        console.log('Renaming "limit" column to "credit_limit"...');
        try {
            await client.query('ALTER TABLE public.accounts RENAME COLUMN "limit" TO credit_limit;');
            console.log('Column renamed successfully.');
        } catch (e) {
            if (e.code === '42703') {
                console.log('Column "limit" does not exist (maybe already renamed).');
            } else {
                console.log('Error renaming column (ignoring if it already exists):', e.message);
            }
        }

    } catch (err) {
        console.error('Error executing schema:', err.message);
    } finally {
        await client.end();
        console.log('Connection closed.');
    }
}

setupDatabase();
