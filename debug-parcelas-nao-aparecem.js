// Script de debug para investigar por que as parcelas não aparecem
// Execute no console do navegador (F12)

console.log('🔍 INVESTIGAÇÃO: Por que as parcelas não aparecem?');

async function investigarParcelas() {
    try {
        // 1. Verificar se o SharedTransactionManager existe
        if (!window.sharedTransactionManager) {
            console.error('❌ SharedTransactionManager não encontrado');
            console.log('💡 Tentando importar manualmente...');
            
            // Tentar acessar via módulos
            if (window.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
                console.log('⚛️ React DevTools detectado');
            }
            
            return;
        }

        const manager = window.sharedTransactionManager;
        console.log('✅ SharedTransactionManager encontrado');

        // 2. Verificar autenticação
        const { data: { user }, error: authError } = await manager.supabase.auth.getUser();
        if (authError || !user) {
            console.error('❌ Problema de autenticação:', authError);
            return;
        }
        console.log('✅ Usuário autenticado:', user.email);

        // 3. Limpar cache e forçar refresh
        manager.clearCache();
        console.log('🧹 Cache limpo');

        // 4. Verificar transações no banco DIRETAMENTE
        console.log('🔍 Verificando transações no banco...');
        
        const { data: allTransactions, error: dbError } = await manager.supabase
            .from('transactions')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false })
            .limit(50);

        if (dbError) {
            console.error('❌ Erro ao buscar transações:', dbError);
            return;
        }

        console.log(`📊 Total de transações no banco: ${allTransactions?.length || 0}`);

        // 5. Filtrar por compartilhadas
        const sharedTransactions = allTransactions?.filter(t => 
            t.is_shared === true || 
            (t.shared_with && t.shared_with.length > 0) ||
            t.payer_id !== null
        ) || [];

        console.log(`🤝 Transações compartilhadas: ${sharedTransactions.length}`);

        if (sharedTransactions.length > 0) {
            console.table(sharedTransactions.map(t => ({
                id: t.id.substring(0, 8),
                description: t.description,
                amount: t.amount,
                date: t.date,
                is_shared: t.is_shared,
                shared_with: t.shared_with ? JSON.stringify(t.shared_with) : null,
                payer_id: t.payer_id,
                domain: t.domain,
                deleted: t.deleted
            })));
        }

        // 6. Verificar parcelas especificamente
        const installments = allTransactions?.filter(t => 
            t.is_installment === true || 
            t.current_installment !== null ||
            t.total_installments !== null
        ) || [];

        console.log(`📦 Parcelas encontradas: ${installments.length}`);

        if (installments.length > 0) {
            console.table(installments.map(t => ({
                id: t.id.substring(0, 8),
                description: t.description,
                amount: t.amount,
                current: t.current_installment,
                total: t.total_installments,
                is_shared: t.is_shared,
                deleted: t.deleted
            })));
        }

        // 7. Verificar seguro do carro especificamente
        const seguroCarro = allTransactions?.filter(t => 
            t.description && (
                t.description.toLowerCase().includes('seguro') ||
                t.description.toLowerCase().includes('carro')
            )
        ) || [];

        console.log(`🚗 Transações de seguro/carro: ${seguroCarro.length}`);

        if (seguroCarro.length > 0) {
            console.table(seguroCarro.map(t => ({
                id: t.id.substring(0, 8),
                description: t.description,
                amount: t.amount,
                date: t.date,
                current: t.current_installment,
                total: t.total_installments,
                is_shared: t.is_shared,
                deleted: t.deleted,
                domain: t.domain
            })));
        }

        // 8. Verificar solicitações pendentes
        const { data: requests, error: reqError } = await manager.supabase
            .from('shared_transaction_requests')
            .select('*')
            .eq('invited_user_id', user.id)
            .eq('status', 'PENDING');

        if (!reqError && requests) {
            console.log(`📋 Solicitações pendentes: ${requests.length}`);
            if (requests.length > 0) {
                console.table(requests.map(r => ({
                    id: r.id.substring(0, 8),
                    transaction_id: r.transaction_id?.substring(0, 8),
                    email: r.invited_email,
                    amount: r.assigned_amount,
                    status: r.status
                })));
            }
        }

        // 9. Verificar estado da aplicação
        console.log('🔍 Verificando estado da aplicação...');
        
        // Tentar acessar o estado do React
        if (window.React && window.React.__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED) {
            console.log('⚛️ React encontrado - tentando acessar estado...');
        }

        // 10. Testar função de busca do SharedTransactionManager
        console.log('🧪 Testando função getSharedTransactions...');
        try {
            const sharedTxs = await manager.getSharedTransactions(user.id, true);
            console.log(`📊 getSharedTransactions retornou: ${sharedTxs?.length || 0} transações`);
        } catch (error) {
            console.error('❌ Erro em getSharedTransactions:', error);
        }

        // 11. Verificar se há problemas de RLS (Row Level Security)
        console.log('🔒 Testando acesso direto às tabelas...');
        
        const { data: testAccess, error: accessError } = await manager.supabase
            .from('shared_transaction_mirrors')
            .select('*')
            .limit(5);

        if (accessError) {
            console.error('❌ Problema de acesso a shared_transaction_mirrors:', accessError);
        } else {
            console.log(`✅ Acesso a mirrors OK: ${testAccess?.length || 0} registros`);
        }

    } catch (error) {
        console.error('❌ Erro na investigação:', error);
    }
}

// Executar investigação
investigarParcelas();

console.log('=== PRÓXIMOS PASSOS ===');
console.log('1. Analise os resultados acima');
console.log('2. Se há transações no banco mas não aparecem na UI, é problema de sincronização');
console.log('3. Se não há transações no banco, elas não foram criadas');
console.log('4. Verifique se há erros de RLS ou permissões');
console.log('========================');