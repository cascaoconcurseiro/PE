
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function diagnose() {
    console.log('🔍 DIGNOSTICO DEPLOY...');

    // Check Columns
    const q1 = "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'mirror_transaction_id'";

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: q1 })
        });

        if (!response.ok) {
            console.log('HTTP Error:', response.status, await response.text());
        } else {
            const json = await response.json();
            console.log('Result Full JSON:', JSON.stringify(json, null, 2));
        }

    } catch (e) {
        console.error('Exception:', e);
    }
}

diagnose();
