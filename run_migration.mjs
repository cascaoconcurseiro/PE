
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Credentials derived from previous context (apply-constraints.mjs)
const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    console.log('🚀 Iniciando migração do banco de dados (Despesas Compartilhadas)...');

    try {
        const sqlFilePath = path.join(process.cwd(), 'SHARED_EXPENSES_MIGRATION.sql');
        const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');

        console.log(`📖 Lendo arquivo SQL: ${sqlFilePath}`);

        // Using REST API directly for RPC execution as in previous examples
        // This relies on the 'exec' function being present in the database (common in Supabase setups for this user)
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: sqlContent })
        });

        if (response.ok) {
            console.log('✅ Migração aplicada com SUCESSO!');
            const text = await response.text();
            if (text) console.log('Output:', text);
        } else {
            console.error('❌ Falha ao aplicar migração via RPC.');
            console.error('Status:', response.status);
            const text = await response.text();
            console.error('Erro:', text);

            throw new Error(`RPC Failed: ${response.statusText}`);
        }

    } catch (error) {
        console.error('❌ Erro fatal durante a migração:', error);
        process.exit(1);
    }
}

runMigration();
