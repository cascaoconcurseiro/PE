// Teste simples da função RPC create_shared_transaction_v2
// Execute no console do navegador

console.log('=== TESTE: create_shared_transaction_v2 ===');

// Verificar se o supabase está disponível
if (window.supabase || (window.sharedTransactionManager && window.sharedTransactionManager.supabase)) {
    const supabase = window.supabase || window.sharedTransactionManager.supabase;
    
    console.log('✅ Supabase client encontrado');
    
    // Teste 1: Verificar se a função existe
    supabase.rpc('create_shared_transaction_v2', {
        p_description: 'TESTE - Parcela Compartilhada',
        p_amount: 100.00,
        p_category: 'OTHER',
        p_date: '2025-01-01',
        p_account_id: null,
        p_shared_splits: [{
            user_id: 'test-user-id',
            amount: 100.00,
            email: 'test@example.com'
        }],
        p_trip_id: null,
        p_installment_data: {
            total: 3,
            series_id: null
        }
    }).then(({ data, error }) => {
        if (error) {
            console.error('❌ Erro na função RPC:', error);
            console.log('Detalhes do erro:', {
                message: error.message,
                details: error.details,
                hint: error.hint,
                code: error.code
            });
        } else {
            console.log('✅ Função RPC executada com sucesso!');
            console.log('Resultado:', data);
        }
    }).catch(err => {
        console.error('❌ Erro inesperado:', err);
    });
    
    // Teste 2: Verificar usuário atual
    supabase.auth.getUser().then(({ data: { user }, error }) => {
        if (error) {
            console.error('❌ Erro ao buscar usuário:', error);
        } else if (user) {
            console.log('✅ Usuário autenticado:', {
                id: user.id,
                email: user.email
            });
        } else {
            console.warn('⚠️ Usuário não autenticado');
        }
    });
    
} else {
    console.error('❌ Supabase client não encontrado');
    console.log('Variáveis disponíveis:', Object.keys(window).filter(k => k.toLowerCase().includes('supabase')));
}

console.log('=== FIM TESTE ===');