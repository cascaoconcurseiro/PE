import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Connection string from setup-db.js
const connectionString = "postgres://postgres.mlqzeihukezlozooqhko:[PASSWORD]@aws-1-us-east-1.pooler.supabase.com:5432/postgres";
// Note: Password 'Wesley@yasmin9094' contains special char '@', so must be URL encoded as %40 if strict, 
// BUT typically connection string parsers handle it if standard. 
// However, the '@' separates user:pass from host. 
// So 'postgres:pass@word@host' is ambiguous.
// URL encoding '@' in password is required. '@' -> '%40'
// User password: [REDACTED]
// Encoded: [REDACTED]

const client = new Client({
    connectionString,
    ssl: {
        rejectUnauthorized: false
    }
});

async function runMigration() {
    try {
        console.log('Connecting to Supabase Postgres...');
        await client.connect();

        const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250109_consolidated_apply.sql');
        console.log(`Reading migration from ${migrationPath}...`);

        if (!fs.existsSync(migrationPath)) {
            console.error('Migration file not found!');
            process.exit(1);
        }

        const sql = fs.readFileSync(migrationPath, 'utf8');
        console.log('Executing migration...');

        // Simple execution (naively splitting or running full block if pg supports it)
        // For functions/triggers, usually better to run strictly or split carefully.
        // This SQL file uses $$ delimiters which might confuse simple splitters.
        // We will try running the whole thing as one command if possible, or split by specific known markers if needed.
        // PG client usually handles multiple statements if strictly separated by ;
        // But strictly, let's try to pass the whole string. PG library supports multiple statements.

        await client.query(sql);

        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await client.end();
    }
}

runMigration();
