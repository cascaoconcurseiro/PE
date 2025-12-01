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

        const schemaPath = path.join(__dirname, '..', 'SUPABASE_SCHEMA.sql');
        console.log(`Reading schema from ${schemaPath}...`);
        const sql = fs.readFileSync(schemaPath, 'utf8');

        console.log('Executing SQL schema...');

        // Split by semicolon to run statements individually
        // Naive split, but works for this specific schema file structure
        const statements = sql.split(/;\s*[\r\n]+/).filter(s => s.trim().length > 0);

        console.log(`Found ${statements.length} statements.`);

        for (const statement of statements) {
            try {
                await client.query(statement);
            } catch (err) {
                // Ignore "already exists" errors
                // 42P07: relation already exists
                // 42710: duplicate object (policy, etc)
                if (err.code === '42P07' || err.code === '42710') {
                    console.log('Object already exists, skipping.');
                } else {
                    console.error('Error executing statement:', err.message);
                    console.error('Statement start:', statement.substring(0, 50));
                }
            }
        }

        console.log('Schema created successfully!');
    } catch (err) {
        console.error('Error executing schema:', err.message);
        if (err.code) console.error('Error code:', err.code);
        if (err.detail) console.error('Error detail:', err.detail);
    } finally {
        await client.end();
        console.log('Connection closed.');
    }
}

setupDatabase();
