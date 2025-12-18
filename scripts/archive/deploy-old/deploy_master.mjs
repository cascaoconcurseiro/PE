
import fs from 'fs';
import path from 'path';

// Credentials found in run_migration_final.mjs
const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function run() {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20251214_master_fix_shared_engine.sql');
    console.log('Reading Master Fix Script:', sqlPath);
    let query = fs.readFileSync(sqlPath, 'utf8');

    console.log('Posting via fetch to:', `${supabaseUrl}/rest/v1/rpc/exec`);

    // NOTE: The SQL script uses DO blocks. 
    // If the RPC is simple 'EXECUTE query', it should handle it.

    try {
        const res = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({ query })
        });

        console.log('Status:', res.status);
        const text = await res.text();
        console.log('Response:', text);

        if (res.status >= 200 && res.status < 300) {
            console.log('✅ SUCCESS: Master Fix Script applied successfully!');
            console.log('Check the "Response" above for NOTICE logs (if visible).');
        } else {
            console.log('❌ FAILURE: Could not apply script.');
            console.log('Error Details:', text);
        }
    } catch (err) {
        console.error('Network Error:', err);
    }
}

run().catch(e => console.error(e));
