// Script para resetar o banco de dados Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function resetDatabase() {
    console.log('🔄 Iniciando reset do banco de dados...\n');

    try {
        // Deletar dados na ordem correta (respeitando foreign keys)
        const tables = [
            'snapshots',
            'custom_categories',
            'family_members',
            'goals',
            'budgets',
            'assets',
            'trips',
            'transactions',
            'accounts',
            'profiles'
        ];

        for (const table of tables) {
            console.log(`🗑️  Deletando dados de: ${table}...`);
            const { error } = await supabase
                .from(table)
                .delete()
                .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

            if (error) {
                console.error(`❌ Erro ao deletar ${table}:`, error.message);
            } else {
                console.log(`✅ ${table} - OK`);
            }
        }

        console.log('\n📊 Verificando resultado...\n');

        // Verificar contagem
        for (const table of tables) {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.error(`❌ Erro ao contar ${table}:`, error.message);
            } else {
                console.log(`${table.padEnd(20)} | ${count} registros`);
            }
        }

        console.log('\n✅ BANCO DE DADOS RESETADO COM SUCESSO!');
        console.log('⚠️  Faça logout e login novamente no aplicativo.\n');

    } catch (error) {
        console.error('❌ Erro geral:', error.message);
    }
}

resetDatabase();
