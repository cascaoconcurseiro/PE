
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const files = [
    'supabase/migrations/20251213_user_request_part1_ddl.sql',
    'supabase/migrations/20251213_user_request_part2_func1.sql',
    'supabase/migrations/20251213_user_request_part3_trig1.sql',
    'supabase/migrations/20251213_user_request_part4_func2.sql',
    'supabase/migrations/20251213_user_request_part5_trig2.sql'
];

async function deploy() {
    console.log('🚀 RE-APPLYING USER SQL (SAFE MODE)...\n');

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

deploy();
