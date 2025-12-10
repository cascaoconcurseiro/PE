
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
const client = new Client({
    connectionString: dbUrl,
    ssl: { rejectUnauthorized: false }
});

async function run() {
    await client.connect();
    try {
        const sql = fs.readFileSync(path.join(process.cwd(), 'verify_balance.sql'), 'utf8');
        const res = await client.query(sql);

        fs.writeFileSync(path.join(process.cwd(), 'balance_audit.json'), JSON.stringify(res.rows, null, 2));
        console.log("✅ Balance audit saved to balance_audit.json");
    } catch (err) {
        console.error(err);
    } finally {
        await client.end();
    }
}
run();
