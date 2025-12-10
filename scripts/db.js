
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read .env.local manually since we don't want to add dotenv dependency just for this
const envPath = path.resolve(__dirname, '../.env.local');
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.*)/);
    if (match) {
        dbUrl = match[1].trim();
    }
}

if (!dbUrl) {
    console.error('❌ DATABASE_URL not found in environment or .env.local');
    process.exit(1);
}

const { Client } = pg;
const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false } // Supabase requires SSL
});

async function run() {
    const sqlFile = process.argv[2];
    if (!sqlFile) {
        console.error('Usage: node scripts/db.js <path-to-sql-file>');
        process.exit(1);
    }

    const fullPath = path.resolve(process.cwd(), sqlFile);
    if (!fs.existsSync(fullPath)) {
        console.error(`❌ File not found: ${fullPath}`);
        process.exit(1);
    }

    console.log(`🔌 Connecting to database...`);
    await client.connect();

    try {
        const sql = fs.readFileSync(fullPath, 'utf8');
        console.log(`🚀 Executing: ${path.basename(fullPath)}...`);

        const res = await client.query(sql);
        console.log('✅ Success! Rows returned:', res.rowCount);
        if (res.rows && res.rows.length > 0) {
            console.log(JSON.stringify(res.rows, null, 2));
        }
    } catch (err) {
        console.error('❌ Error executing SQL:', err.message);
        process.exit(1);
    } finally {
        await client.end();
    }
}

run();
