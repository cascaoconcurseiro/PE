// Reset do banco usando a API do Supabase corretamente
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function deleteAllFromTable(tableName) {
    try {
        // Primeiro, buscar todos os IDs
        const { data: rows, error: fetchError } = await supabase
            .from(tableName)
            .select('id');

        if (fetchError) {
            console.error(`❌ Erro ao buscar ${tableName}:`, fetchError.message);
            return false;
        }

        if (!rows || rows.length === 0) {
            console.log(`✅ ${tableName.padEnd(20)} - já vazio`);
            return true;
        }

        // Deletar todos os registros
        const ids = rows.map(r => r.id);
        const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .in('id', ids);

        if (deleteError) {
            console.error(`❌ Erro ao deletar ${tableName}:`, deleteError.message);
            return false;
        }

        console.log(`✅ ${tableName.padEnd(20)} - ${rows.length} registros deletados`);
        return true;

    } catch (error) {
        console.error(`❌ Erro em ${tableName}:`, error.message);
        return false;
    }
}

async function resetDatabase() {
    console.log('🔄 Iniciando reset do banco de dados...\n');
    console.log('🗑️  Deletando dados (ordem correta para foreign keys)...\n');

    // Ordem correta respeitando foreign keys
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
        await deleteAllFromTable(table);
    }

    console.log('\n📊 Verificando resultado final...\n');

    // Verificar contagem final
    for (const table of tables) {
        const { count, error } = await supabase
            .from(table)
            .select('*', { count: 'exact', head: true });

        if (!error) {
            console.log(`${table.padEnd(20)} | ${count || 0} registros`);
        }
    }

    console.log('\n✅ BANCO DE DADOS RESETADO COM SUCESSO!');
    console.log('⚠️  Faça logout e login novamente no aplicativo.\n');
}

resetDatabase().catch(console.error);
