// Script para testar se as correções das parcelas compartilhadas estão funcionando
// Execute no console do navegador (F12)

console.log('=== TESTE: Parcelas Compartilhadas ===');

async function testarParcelasCompartilhadas() {
    try {
        // Verificar se o SharedTransactionManager está disponível
        if (!window.sharedTransactionManager) {
            console.error('❌ SharedTransactionManager não encontrado');
            return;
        }

        const manager = window.sharedTransactionManager;
        console.log('✅ SharedTransactionManager encontrado');

        // Limpar cache
        manager.clearCache();
        console.log('✅ Cache limpo');

        // Verificar usuário autenticado
        const { data: { user }, error: userError } = await manager.supabase.auth.getUser();
        if (userError || !user) {
            console.error('❌ Usuário não autenticado:', userError);
            return;
        }
        console.log('✅ Usuário autenticado:', user.email);

        // Dados de teste para parcelas compartilhadas
        const testData = {
            transactions: [
                {
                    description: 'TESTE - Seguro Carro (1/3)',
                    amount: 95.00,
                    category_id: 'OTHER',
                    account_id: null,
                    shared_with: [{
                        user_id: user.id, // Usar o próprio usuário para teste
                        amount: 95.00
                    }],
                    installment_number: 1,
                    total_installments: 3,
                    due_date: '2025-01-01'
                },
                {
                    description: 'TESTE - Seguro Carro (2/3)',
                    amount: 95.00,
                    category_id: 'OTHER',
                    account_id: null,
                    shared_with: [{
                        user_id: user.id,
                        amount: 95.00
                    }],
                    installment_number: 2,
                    total_installments: 3,
                    due_date: '2025-02-01'
                },
                {
                    description: 'TESTE - Seguro Carro (3/3)',
                    amount: 95.00,
                    category_id: 'OTHER',
                    account_id: null,
                    shared_with: [{
                        user_id: user.id,
                        amount: 95.00
                    }],
                    installment_number: 3,
                    total_installments: 3,
                    due_date: '2025-03-01'
                }
            ]
        };

        console.log('📦 Testando importação de parcelas...');
        console.log('Dados de teste:', testData);

        // Testar a função de importação
        const result = await manager.importSharedInstallments(testData);
        
        console.log('📊 Resultado da importação:', result);

        if (result.success) {
            console.log('✅ SUCESSO! Parcelas importadas com sucesso');
            console.log(`✅ ${result.results.length} parcelas criadas`);
            
            // Aguardar um pouco e verificar se aparecem no banco
            setTimeout(async () => {
                console.log('🔍 Verificando se as parcelas aparecem no banco...');
                
                const { data: testTransactions, error: searchError } = await manager.supabase
                    .from('transactions')
                    .select('*')
                    .ilike('description', '%TESTE - Seguro Carro%')
                    .order('created_at', { ascending: false });
                
                if (searchError) {
                    console.error('❌ Erro ao buscar transações de teste:', searchError);
                } else {
                    console.log('📊 Transações de teste encontradas:', testTransactions?.length || 0);
                    if (testTransactions && testTransactions.length > 0) {
                        console.table(testTransactions.map(t => ({
                            id: t.id.substring(0, 8),
                            description: t.description,
                            amount: t.amount,
                            date: t.date,
                            is_shared: t.is_shared,
                            current_installment: t.current_installment,
                            total_installments: t.total_installments
                        })));
                        console.log('✅ CORREÇÕES FUNCIONANDO! As parcelas aparecem no banco');
                    } else {
                        console.warn('⚠️ Parcelas não encontradas no banco - pode haver um problema');
                    }
                }
            }, 2000);
            
        } else {
            console.error('❌ FALHA na importação');
            console.error('Erros:', result.errors);
        }

    } catch (error) {
        console.error('❌ Erro inesperado:', error);
    }
}

// Executar o teste
testarParcelasCompartilhadas();

console.log('=== INSTRUÇÕES ===');
console.log('1. Execute este script no console do navegador');
console.log('2. Aguarde os resultados da importação');
console.log('3. Verifique se as transações de teste aparecem');
console.log('4. Se funcionou, as correções estão OK!');
console.log('=== FIM TESTE ===');