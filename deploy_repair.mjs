
import fs from 'fs';
import path from 'path';

// Credentials reused
const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function run() {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20251214_accounting_repair.sql');
    console.log('Reading Accounting Repair Script:', sqlPath);
    let query = fs.readFileSync(sqlPath, 'utf8');

    console.log('Posting via fetch to:', `${supabaseUrl}/rest/v1/rpc/exec`);

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
            console.log('✅ SUCCESS: Accounting Repair Applied!');
        } else {
            console.log('❌ FAILURE: Could not apply repair.');
            console.log('Error Details:', text);
        }
    } catch (err) {
        console.error('Network Error:', err);
    }
}

run().catch(e => console.error(e));
