
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function deployAudit() {
    console.log('🚀 DEPLOY MÓDULO AUDITORIA & RECUPERAÇÃO (SECTION 4)...\n');

    const filePath = 'supabase/migrations/20251213100002_shared_engine_audit.sql';
    const fullPath = path.join(__dirname, filePath);

    try {
        const sqlContent = fs.readFileSync(fullPath, 'utf8');
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            body: JSON.stringify({ query: sqlContent }),
            headers: { 'Content-Type': 'application/json', 'apikey': supabaseServiceKey, 'Authorization': `Bearer ${supabaseServiceKey}` }
        });

        if (response.ok) {
            console.log(`✅ Sucesso! Tabela system_logs e função rebuild instaladas.`);
        } else {
            console.error(`⚠️ Falha na execução: ${await response.text()}`);
        }
    } catch (e) {
        console.error(`❌ Erro: ${e.message}`);
    }
}

deployAudit();
