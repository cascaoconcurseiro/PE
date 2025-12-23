// Script de debug para verificar parcelas compartilhadas
// Execute este script no console do navegador para debugar

console.log('=== DEBUG: Parcelas Compartilhadas ===');

// 1. Verificar se o SharedTransactionManager está funcionando
if (window.sharedTransactionManager) {
    console.log('✅ SharedTransactionManager encontrado');
    
    // 2. Limpar cache para forçar busca fresca
    window.sharedTransactionManager.clearCache();
    console.log('✅ Cache limpo');
    
    // 3. Verificar transações no banco
    window.sharedTransactionManager.supabase
        .from('transactions')
        .select('*')
        .eq('is_shared', true)
        .order('created_at', { ascending: false })
        .limit(10)
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Erro ao buscar transações compartilhadas:', error);
            } else {
                console.log('📊 Transações compartilhadas encontradas:', data?.length || 0);
                console.table(data?.map(t => ({
                    id: t.id.substring(0, 8),
                    description: t.description,
                    amount: t.amount,
                    date: t.date,
                    domain: t.domain,
                    is_shared: t.is_shared,
                    shared_with: t.shared_with?.length || 0,
                    current_installment: t.current_installment,
                    total_installments: t.total_installments
                })));
            }
        });
    
    // 4. Verificar solicitações pendentes
    window.sharedTransactionManager.supabase
        .from('shared_transaction_requests')
        .select('*')
        .eq('status', 'PENDING')
        .order('created_at', { ascending: false })
        .limit(5)
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Erro ao buscar solicitações:', error);
            } else {
                console.log('📋 Solicitações pendentes:', data?.length || 0);
                console.table(data?.map(r => ({
                    id: r.id.substring(0, 8),
                    transaction_id: r.transaction_id?.substring(0, 8),
                    invited_email: r.invited_email,
                    assigned_amount: r.assigned_amount,
                    status: r.status,
                    created_at: r.created_at
                })));
            }
        });
    
} else {
    console.error('❌ SharedTransactionManager não encontrado');
}

// 5. Verificar se há transações no estado da aplicação
if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
    console.log('🔍 Verificando estado da aplicação...');
    // Tentar encontrar o componente Shared na árvore do React
    const fiber = document.querySelector('[data-testid="shared-component"]')?._reactInternalFiber;
    if (fiber) {
        console.log('✅ Componente Shared encontrado');
    }
}

console.log('=== FIM DEBUG ===');