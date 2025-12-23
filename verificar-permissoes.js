// Verificar permissões e RLS (Row Level Security)
// Execute no console do navegador (F12)

console.log('🔒 VERIFICAÇÃO: Permissões e RLS');

async function verificarPermissoes() {
    try {
        // Obter cliente Supabase
        let supabase;
        
        if (window.sharedTransactionManager?.supabase) {
            supabase = window.sharedTransactionManager.supabase;
        } else if (window.supabase) {
            supabase = window.supabase;
        } else {
            console.error('❌ Supabase não encontrado');
            return;
        }

        // Verificar autenticação
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            console.error('❌ Usuário não autenticado:', authError);
            return;
        }
        console.log('✅ Usuário:', user.email, 'ID:', user.id);

        // 1. Testar acesso à tabela transactions
        console.log('🔍 Testando acesso à tabela transactions...');
        const { data: txTest, error: txError } = await supabase
            .from('transactions')
            .select('id, description, amount, is_shared')
            .limit(5);

        if (txError) {
            console.error('❌ Erro ao acessar transactions:', txError);
        } else {
            console.log(`✅ Acesso a transactions OK: ${txTest?.length || 0} registros`);
        }

        // 2. Testar inserção em transactions
        console.log('🔍 Testando inserção em transactions...');
        const testTransaction = {
            user_id: user.id,
            description: 'TESTE PERMISSÃO - DELETE DEPOIS',
            amount: 1.00,
            type: 'DESPESA',
            category: 'OTHER',
            date: new Date().toISOString().split('T')[0],
            currency: 'BRL',
            is_shared: false,
            deleted: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };

        const { data: insertTest, error: insertError } = await supabase
            .from('transactions')
            .insert(testTransaction)
            .select();

        if (insertError) {
            console.error('❌ Erro ao inserir em transactions:', insertError);
        } else {
            console.log('✅ Inserção em transactions OK');
            
            // Deletar o teste
            if (insertTest && insertTest[0]) {
                await supabase
                    .from('transactions')
                    .delete()
                    .eq('id', insertTest[0].id);
                console.log('🧹 Transação de teste removida');
            }
        }

        // 3. Testar acesso a shared_transaction_requests
        console.log('🔍 Testando acesso a shared_transaction_requests...');
        const { data: reqTest, error: reqError } = await supabase
            .from('shared_transaction_requests')
            .select('*')
            .limit(5);

        if (reqError) {
            console.error('❌ Erro ao acessar shared_transaction_requests:', reqError);
        } else {
            console.log(`✅ Acesso a shared_transaction_requests OK: ${reqTest?.length || 0} registros`);
        }

        // 4. Testar acesso a shared_transaction_mirrors
        console.log('🔍 Testando acesso a shared_transaction_mirrors...');
        const { data: mirrorTest, error: mirrorError } = await supabase
            .from('shared_transaction_mirrors')
            .select('*')
            .limit(5);

        if (mirrorError) {
            console.error('❌ Erro ao acessar shared_transaction_mirrors:', mirrorError);
        } else {
            console.log(`✅ Acesso a shared_transaction_mirrors OK: ${mirrorTest?.length || 0} registros`);
        }

        // 5. Verificar se as funções RPC existem
        console.log('🔍 Verificando funções RPC disponíveis...');
        
        // Testar função simples primeiro
        const { data: versionTest, error: versionError } = await supabase.rpc('version');
        if (versionError) {
            console.error('❌ Erro ao chamar RPC version:', versionError);
        } else {
            console.log('✅ RPC básico funcionando');
        }

        // Testar nossa função específica com dados mínimos
        const { data: rpcTest, error: rpcError } = await supabase.rpc('create_shared_transaction_v2', {
            p_description: 'TESTE RPC',
            p_amount: 1,
            p_category: 'OTHER',
            p_date: '2025-01-01',
            p_account_id: null,
            p_shared_splits: [{
                user_id: user.id,
                amount: 1,
                email: user.email || 'test@test.com'
            }]
        });

        if (rpcError) {
            console.error('❌ Erro na RPC create_shared_transaction_v2:', rpcError);
            
            // Verificar se é erro de função não encontrada
            if (rpcError.message?.includes('function') && rpcError.message?.includes('does not exist')) {
                console.error('🚨 PROBLEMA: Função RPC não existe no banco!');
                console.log('💡 Solução: Execute as migrações do Supabase');
            }
        } else {
            console.log('✅ RPC create_shared_transaction_v2 acessível');
            console.log('Resultado:', rpcTest);
        }

        // 6. Verificar contas disponíveis
        console.log('🔍 Verificando contas do usuário...');
        const { data: accounts, error: accountError } = await supabase
            .from('accounts')
            .select('id, name, type, currency')
            .eq('user_id', user.id)
            .eq('deleted', false);

        if (accountError) {
            console.error('❌ Erro ao buscar contas:', accountError);
        } else {
            console.log(`💳 Contas encontradas: ${accounts?.length || 0}`);
            if (accounts && accounts.length > 0) {
                console.table(accounts);
            }
        }

        // 7. Verificar membros da família
        console.log('🔍 Verificando membros da família...');
        const { data: members, error: memberError } = await supabase
            .from('family_members')
            .select('id, name, email, linked_user_id')
            .eq('user_id', user.id);

        if (memberError) {
            console.error('❌ Erro ao buscar membros:', memberError);
        } else {
            console.log(`👥 Membros encontrados: ${members?.length || 0}`);
            if (members && members.length > 0) {
                console.table(members);
            }
        }

    } catch (error) {
        console.error('❌ Erro na verificação de permissões:', error);
    }
}

// Executar verificação
verificarPermissoes();

console.log('=== DIAGNÓSTICO ===');
console.log('Se todos os testes passaram = Permissões OK');
console.log('Se RPC não existe = Execute migrações do Supabase');
console.log('Se inserção falha = Problema de RLS');
console.log('Se acesso falha = Problema de autenticação');
console.log('===================');