
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function forceLink() {
    console.log('🛠️ FORCE LINKING TRIPS...\n');

    const filePath = 'force-link-trips-v2.sql';
    const fullPath = path.join(__dirname, filePath);
    const sql = fs.readFileSync(fullPath, 'utf8');

    const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        body: JSON.stringify({ query: sql }),
        headers: { 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
    });

    if (response.ok) {
        console.log('✅ Force Link Executed Successfully.');
        // Try to get logs if possible, but exec usually returns minimal info.
        // We rely on the side-effect.
    } else {
        console.error(`⚠️ Error:`, await response.text());
    }
}

forceLink();
