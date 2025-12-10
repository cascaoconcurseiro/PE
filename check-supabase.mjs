// Script para verificar conexão e schema do Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0L8jKQ0MyqcRKrvOHtyOHw_Y4M07CZx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkConnection() {
    console.log('\n🔍 VERIFICANDO CONEXÃO COM SUPABASE...\n');
    console.log('URL:', supabaseUrl);
    console.log('Key:', supabaseKey.substring(0, 20) + '...');

    try {
        // Test 1: Basic connection
        console.log('\n📡 Teste 1: Conexão básica...');
        const { data: healthData, error: healthError } = await supabase.from('accounts').select('count');
        if (healthError && healthError.code !== 'PGRST116') {
            console.log('❌ Erro de conexão:', healthError.message);
        } else {
            console.log('✅ Conexão estabelecida!');
        }

        // Test 2: Check tables exist
        console.log('\n📊 Teste 2: Verificando tabelas...');
        const tables = ['accounts', 'transactions', 'trips', 'budgets', 'goals', 'family_members', 'assets', 'snapshots', 'custom_categories'];

        for (const table of tables) {
            const { error } = await supabase.from(table).select('id').limit(1);
            if (error) {
                console.log(`   ❌ ${table}: ${error.message}`);
            } else {
                console.log(`   ✅ ${table}: OK`);
            }
        }

        // Test 3: Check user_settings table
        console.log('\n⚙️ Teste 3: Verificando user_settings...');
        const { error: settingsError } = await supabase.from('user_settings').select('id').limit(1);
        if (settingsError) {
            console.log('   ⚠️ user_settings:', settingsError.message);
            console.log('   → Pode precisar criar a tabela via SQL Editor');
        } else {
            console.log('   ✅ user_settings: OK');
        }

        // Test 4: Auth check
        console.log('\n🔐 Teste 4: Verificando autenticação...');
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.log('   ⚠️ Nenhum usuário autenticado (normal se executando fora do app)');
        } else {
            console.log(`   ✅ Usuário autenticado: ${user.email}`);
        }

        console.log('\n✨ VERIFICAÇÃO CONCLUÍDA!\n');

    } catch (error) {
        console.error('\n❌ ERRO CRÍTICO:', error);
    }
}

checkConnection();
