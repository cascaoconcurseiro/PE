// Teste direto da função RPC create_shared_transaction_v2
// Execute no console do navegador (F12)

console.log('🧪 TESTE: Função RPC create_shared_transaction_v2');

async function testarRPC() {
    try {
        // Verificar se temos acesso ao Supabase
        let supabase;
        
        if (window.sharedTransactionManager?.supabase) {
            supabase = window.sharedTransactionManager.supabase;
            console.log('✅ Usando Supabase do SharedTransactionManager');
        } else if (window.supabase) {
            supabase = window.supabase;
            console.log('✅ Usando Supabase global');
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
        console.log('✅ Usuário autenticado:', user.email);

        // Dados de teste simples
        const testData = {
            p_description: 'TESTE RPC - Parcela Compartilhada',
            p_amount: 95.00,
            p_category: 'OTHER',
            p_date: '2025-01-15',
            p_account_id: null, // Importante: null para compartilhadas
            p_shared_splits: [{
                user_id: user.id,
                amount: 95.00,
                email: user.email || 'test@example.com'
            }],
            p_trip_id: null,
            p_installment_data: {
                total: 3,
                series_id: null
            }
        };

        console.log('📦 Dados de teste:', testData);

        // Testar a função RPC
        console.log('🚀 Chamando create_shared_transaction_v2...');
        
        const { data: result, error } = await supabase.rpc('create_shared_transaction_v2', testData);

        if (error) {
            console.error('❌ ERRO na RPC:', error);
            console.log('Detalhes do erro:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
            
            // Verificar se a função existe
            console.log('🔍 Verificando se a função RPC existe...');
            const { data: functions, error: funcError } = await supabase
                .from('pg_proc')
                .select('proname')
                .ilike('proname', '%create_shared_transaction%');
                
            if (funcError) {
                console.log('⚠️ Não foi possível verificar funções RPC');
            } else {
                console.log('📋 Funções RPC encontradas:', functions);
            }
            
        } else {
            console.log('✅ SUCESSO na RPC!');
            console.log('📊 Resultado:', result);
            
            if (result?.success) {
                console.log('🎉 Transação criada com sucesso!');
                console.log('🆔 Transaction ID:', result.data?.transaction_id);
                
                // Verificar se a transação aparece no banco
                setTimeout(async () => {
                    console.log('🔍 Verificando se a transação aparece no banco...');
                    
                    const { data: createdTx, error: searchError } = await supabase
                        .from('transactions')
                        .select('*')
                        .eq('id', result.data?.transaction_id);
                    
                    if (searchError) {
                        console.error('❌ Erro ao buscar transação criada:', searchError);
                    } else if (createdTx && createdTx.length > 0) {
                        console.log('✅ Transação encontrada no banco!');
                        console.table(createdTx.map(t => ({
                            id: t.id.substring(0, 8),
                            description: t.description,
                            amount: t.amount,
                            is_shared: t.is_shared,
                            domain: t.domain,
                            deleted: t.deleted
                        })));
                    } else {
                        console.warn('⚠️ Transação não encontrada no banco');
                    }
                }, 1000);
                
            } else {
                console.warn('⚠️ RPC executou mas retornou success=false');
                console.log('Erro retornado:', result?.error);
            }
        }

    } catch (error) {
        console.error('❌ Erro inesperado:', error);
    }
}

// Executar teste
testarRPC();

console.log('=== INTERPRETAÇÃO DOS RESULTADOS ===');
console.log('✅ SUCESSO = A função RPC está funcionando');
console.log('❌ ERRO = Há problema na função RPC ou permissões');
console.log('⚠️ SUCCESS=FALSE = RPC executa mas há erro interno');
console.log('=====================================');