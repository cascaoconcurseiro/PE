
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function deployV5() {
    console.log('🚀 DEPLOY V5: Shared Trips & Notifications...\n');

    // 1. Deploy SQL Migration
    const filePath = 'supabase/migrations/20251213_fix_shared_visibility_v5.sql';
    const fullPath = path.join(__dirname, filePath);
    const sql = fs.readFileSync(fullPath, 'utf8');

    console.log('--- Applying Migration ---');
    let response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        body: JSON.stringify({ query: sql }),
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
    });

    if (!response.ok) {
        console.error(`⚠️ Migration Failed:`, await response.text());
        return;
    }
    console.log('✅ Migration Applied.');

    // 2. Run Retrofit Function
    console.log('--- Running Retrofit (Healing Data) ---');
    const retrofitQuery = `SELECT fix_orphan_shared_trips();`;

    response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        body: JSON.stringify({ query: retrofitQuery }),
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
    });

    if (response.ok) {
        const result = await response.json();
        console.log(`✅ Retrofit Result:`, JSON.stringify(result, null, 2));
    } else {
        console.error(`⚠️ Retrofit Failed:`, await response.text());
    }
}

deployV5();
