// Script para verificar transações do seguro do carro
// Execute no console do navegador (F12)

console.log('=== VERIFICAÇÃO: Seguro do Carro ===');

// 1. Verificar se o SharedTransactionManager está funcionando
if (window.sharedTransactionManager) {
    console.log('✅ SharedTransactionManager encontrado');
    
    // Limpar cache para busca fresca
    window.sharedTransactionManager.clearCache();
    console.log('✅ Cache limpo');
    
    // 2. Buscar transações relacionadas a seguro de carro
    window.sharedTransactionManager.supabase
        .from('transactions')
        .select('*')
        .ilike('description', '%seguro%')
        .order('created_at', { ascending: false })
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Erro ao buscar transações de seguro:', error);
            } else {
                console.log('📊 Transações de seguro encontradas:', data?.length || 0);
                
                // Filtrar por carro especificamente
                const seguroCarro = data?.filter(t => 
                    t.description.toLowerCase().includes('carro') ||
                    t.description.toLowerCase().includes('seguro')
                ) || [];
                
                console.log('🚗 Transações de seguro de carro:', seguroCarro.length);
                
                if (seguroCarro.length > 0) {
                    console.table(seguroCarro.map(t => ({
                        id: t.id.substring(0, 8),
                        description: t.description,
                        amount: t.amount,
                        date: t.date,
                        is_shared: t.is_shared,
                        current_installment: t.current_installment,
                        total_installments: t.total_installments,
                        series_id: t.series_id?.substring(0, 8),
                        deleted: t.deleted,
                        domain: t.domain
                    })));
                    
                    // Verificar parcelas de R$ 95,00
                    const parcelas95 = seguroCarro.filter(t => t.amount === 95);
                    console.log('💰 Parcelas de R$ 95,00:', parcelas95.length);
                    
                    // Verificar séries de 10 parcelas
                    const series10x = seguroCarro.filter(t => t.total_installments === 10);
                    console.log('📦 Séries de 10 parcelas:', series10x.length);
                    
                    // Agrupar por series_id
                    const seriesMap = {};
                    seguroCarro.forEach(t => {
                        if (t.series_id) {
                            if (!seriesMap[t.series_id]) {
                                seriesMap[t.series_id] = [];
                            }
                            seriesMap[t.series_id].push(t);
                        }
                    });
                    
                    console.log('📋 Séries encontradas:', Object.keys(seriesMap).length);
                    Object.entries(seriesMap).forEach(([seriesId, transactions]) => {
                        console.log(`Série ${seriesId.substring(0, 8)}: ${transactions.length} parcelas`);
                    });
                } else {
                    console.warn('⚠️ Nenhuma transação de seguro de carro encontrada');
                }
            }
        });
    
    // 3. Verificar solicitações pendentes
    window.sharedTransactionManager.supabase
        .from('shared_transaction_requests')
        .select(`
            *,
            transactions!inner(description, amount)
        `)
        .ilike('transactions.description', '%seguro%')
        .eq('status', 'PENDING')
        .then(({ data, error }) => {
            if (error) {
                console.error('❌ Erro ao buscar solicitações:', error);
            } else {
                console.log('📋 Solicitações pendentes de seguro:', data?.length || 0);
                if (data && data.length > 0) {
                    console.table(data.map(r => ({
                        id: r.id.substring(0, 8),
                        transaction_id: r.transaction_id?.substring(0, 8),
                        invited_email: r.invited_email,
                        assigned_amount: r.assigned_amount,
                        status: r.status,
                        description: r.transactions?.description
                    })));
                }
            }
        });
        
} else {
    console.error('❌ SharedTransactionManager não encontrado');
}

// 4. Verificar estado da aplicação
console.log('🔍 Verificando estado da aplicação...');

// Tentar acessar transações do estado global
if (window.React) {
    console.log('⚛️ React detectado - verificando componentes');
}

// 5. Verificar se há erros no console
console.log('📝 Verifique se há erros no console acima');
console.log('📝 Se não houver transações, elas podem não ter sido criadas ainda');
console.log('📝 Use o SQL fornecido para verificar diretamente no banco');

console.log('=== FIM VERIFICAÇÃO ===');