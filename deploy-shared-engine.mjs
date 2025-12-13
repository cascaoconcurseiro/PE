
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// CONFIGURAÇÃO SUPABASE (Reaproveitada do optimize-full-db.mjs)
const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

// Arquivos para executar em ordem de dependência
const filesToExecute = [
    'supabase/backups/2025-12-13_shared_refactor/00_backup_tables.sql',
    'supabase/migrations/20251213100000_shared_engine_ddl.sql',
    'supabase/migrations/20251213100001_shared_engine_logic.sql'
];

async function executeSqlFile(filePath) {
    const fullPath = path.join(__dirname, filePath);
    console.log(`\n📄 Lendo arquivo: ${filePath}...`);

    try {
        const sqlContent = fs.readFileSync(fullPath, 'utf8');
        console.log(`⚡ Executando SQL no Supabase...`);

        // Usando o endpoint RPC 'exec' que já existe no projeto
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
            console.log(`✅ Sucesso! Arquivo aplicado.`);
        } else {
            const errorText = await response.text();
            console.error(`⚠️ Falha na execução.`);
            console.error(`Detalhes: ${errorText}`);
            // Se falhar o backup, não devemos continuar
            if (filePath.includes('backup')) {
                throw new Error('Falha crítica no backup. Abortando operação.');
            }
        }

    } catch (e) {
        console.error(`❌ Erro crítico: ${e.message}`);
        process.exit(1);
    }
}

async function runDeploy() {
    console.log('🚀 INICIANDO DEPLOY DO MOTOR COMPARTILHADO (SHARED ENGINE V4)\n');

    for (const file of filesToExecute) {
        await executeSqlFile(file);
    }

    console.log('\n🏁 Deploy Concluído com Sucesso.');
    console.log('O sistema agora possui:');
    console.log('  1. Backups de segurança em tables _backup_20251213');
    console.log('  2. Colunas de controle (mirror_message_id, connection_status)');
    console.log('  3. Triggers de inteligência (Auto-Connect, Mirroring, Isolamento)');
}

runDeploy();
