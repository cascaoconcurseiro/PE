
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, '../.env.local');
let dbUrl = process.env.DATABASE_URL;

if (!dbUrl && fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/DATABASE_URL=(.*)/);
    if (match) dbUrl = match[1].trim();
}

const { Client } = pg;
const client = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });

async function run() {
    await client.connect();
    try {
        const res = await client.query(`
            SELECT routine_definition 
            FROM information_schema.routines 
            WHERE routine_name = 'update_ledger_balances'
        `);

        if (res.rows.length > 0) {
            const body = res.rows[0].routine_definition;
            fs.writeFileSync(path.join(process.cwd(), 'function_body.txt'), body);
            console.log("✅ Function body written to function_body.txt");
        } else {
            console.log("Function not found.");
        }
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
