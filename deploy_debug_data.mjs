
import fs from 'fs';
import path from 'path';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function dumpDataDirectly() {
    const headers = {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`
    };

    const accRes = await fetch(`${supabaseUrl}/rest/v1/accounts?select=id,name,type,balance,currency`, { headers });
    const accData = await accRes.json();
    console.log('--- ACCOUNTS ---');
    console.table(accData);
}

dumpDataDirectly().catch(e => console.error(e));
