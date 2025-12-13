
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function checkTrips() {
    console.log('🕵️‍♀️ Checking TRIPS Schema...\n');

    // Check columns of 'trips'
    const query = `
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_name = 'trips';
    `;

    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            body: JSON.stringify({ query: query }),
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
        });

        if (response.ok) {
            const result = await response.json();
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.error(`⚠️ Error:`, await response.text());
        }
    } catch (e) {
        console.error(`❌ Exception: ${e.message}`);
    }
}

checkTrips();
