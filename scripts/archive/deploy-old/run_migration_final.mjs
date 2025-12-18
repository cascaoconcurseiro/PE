
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function run() {
    const sqlPath = path.join(process.cwd(), 'supabase', 'migrations', '20250109_force_fix_rpc.sql');
    console.log('Reading:', sqlPath);
    const query = fs.readFileSync(sqlPath, 'utf8');

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
            console.log('SUCCESS: Migration applied.');
        } else {
            console.log('FAILURE: Migration failed.');
        }
    } catch (err) {
        console.error('Network Error:', err);
    }
}

run().catch(e => console.error(e));
