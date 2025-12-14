
import fs from 'fs';
import path from 'path';

// Credentials reused
const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function run() {
    const sqlPath = path.join(process.cwd(), 'fix_phantom.sql');
    console.log('Reading Fix Phantom Script:', sqlPath);
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
    } catch (err) {
        console.error('Network Error:', err);
    }
}

run().catch(e => console.error(e));
