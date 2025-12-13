
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const files = [
    'supabase/migrations/20251213_user_request_part4_func2.sql',
];

async function deployFix() {
    console.log('🚀 REDEPLOYING CORRECTED LOGIC (PART 4)...\n');

    for (const f of files) {
        const fullPath = path.join(__dirname, f);
        console.log(`📄 Executing: ${f}`);
        const sql = fs.readFileSync(fullPath, 'utf8');

        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            body: JSON.stringify({ query: sql }),
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
        });

        if (response.ok) {
            console.log(`   ✅ Success`);
        } else {
            console.error(`   ⚠️ Failed: ${await response.text()}`);
        }
    }
}

deployFix();
