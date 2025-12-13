
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function fetchLiveCode() {
    console.log('🔬 EXTRAINDO CÓDIGO VIVO DO BANCO DE DADOS (V2 DEBUG)...\n');

    // Lista de funções críticas para auditar
    const targetFunctions = [
        'handle_transaction_mirroring_v4'
    ];

    for (const funcName of targetFunctions) {
        const query = `
            SELECT pg_get_functiondef(p.oid) as source_code 
            FROM pg_proc p 
            WHERE p.proname = '${funcName}'
        `;

        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ query: query })
            });

            if (response.ok) {
                const result = await response.json();
                // DUMP COMPLETO DO JSON
                console.log(`\nRAW JSON FOR ${funcName}:`);
                console.log(JSON.stringify(result, null, 2));

            } else {
                console.error(`⚠️ Erro HTTP:`, await response.text());
            }
        } catch (e) {
            console.error(`❌ Exception: ${e.message}`);
        }
    }
}

fetchLiveCode();
