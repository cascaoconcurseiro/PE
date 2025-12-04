// Script simplificado para resetar via SQL
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

async function resetDatabase() {
    console.log('🔄 Resetando banco de dados via SQL...\n');

    const resetSQL = `
        BEGIN;
        
        DELETE FROM public.snapshots;
        DELETE FROM public.custom_categories;
        DELETE FROM public.family_members;
        DELETE FROM public.goals;
        DELETE FROM public.budgets;
        DELETE FROM public.assets;
        DELETE FROM public.trips;
        DELETE FROM public.transactions;
        DELETE FROM public.accounts;
        DELETE FROM public.profiles;
        
        COMMIT;
    `;

    const verifySQL = `
        SELECT 'profiles' as tabela, COUNT(*) as registros FROM public.profiles
        UNION ALL SELECT 'accounts', COUNT(*) FROM public.accounts
        UNION ALL SELECT 'transactions', COUNT(*) FROM public.transactions
        UNION ALL SELECT 'trips', COUNT(*) FROM public.trips
        UNION ALL SELECT 'assets', COUNT(*) FROM public.assets
        UNION ALL SELECT 'budgets', COUNT(*) FROM public.budgets
        UNION ALL SELECT 'goals', COUNT(*) FROM public.goals
        UNION ALL SELECT 'family_members', COUNT(*) FROM public.family_members
        UNION ALL SELECT 'custom_categories', COUNT(*) FROM public.custom_categories
        UNION ALL SELECT 'snapshots', COUNT(*) FROM public.snapshots;
    `;

    try {
        // Executar reset
        console.log('🗑️  Deletando todos os dados...');
        const { error: resetError } = await supabase.rpc('exec_sql', { sql: resetSQL });

        if (resetError) {
            console.error('❌ Erro ao resetar:', resetError.message);
            console.log('\n💡 Tentando método alternativo...\n');

            // Método alternativo: deletar tabela por tabela
            const tables = ['snapshots', 'custom_categories', 'family_members', 'goals', 'budgets', 'assets', 'trips', 'transactions', 'accounts', 'profiles'];

            for (const table of tables) {
                console.log(`🗑️  ${table}...`);
                const { error } = await supabase.from(table).delete().gte('id', '00000000-0000-0000-0000-000000000000');
                if (!error) console.log(`✅ ${table} - OK`);
            }
        } else {
            console.log('✅ Dados deletados com sucesso!');
        }

        // Verificar
        console.log('\n📊 Verificando resultado...\n');
        const { data, error: verifyError } = await supabase.rpc('exec_sql', { sql: verifySQL });

        if (data) {
            console.table(data);
        }

        console.log('\n✅ RESET CONCLUÍDO!');
        console.log('⚠️  Faça logout e login no aplicativo.\n');

    } catch (error) {
        console.error('❌ Erro:', error.message);
    }
}

resetDatabase();
