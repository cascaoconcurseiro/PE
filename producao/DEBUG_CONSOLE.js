// ============================================================================
// SCRIPT DE DEBUG - EXECUTAR NO CONSOLE DO NAVEGADOR
// ============================================================================
// Como usar:
// 1. Pressione F12 para abrir o console
// 2. Copie e cole este código
// 3. Pressione Enter
// 4. Tente criar uma transação parcelada
// 5. Veja os logs que aparecem
// ============================================================================

// Interceptar chamadas ao Supabase
const originalFetch = window.fetch;
window.fetch = function(...args) {
    const url = args[0];
    
    // Log de chamadas RPC
    if (typeof url === 'string' && url.includes('rpc/create_financial_record')) {
        console.log('🔵 CHAMADA RPC create_financial_record:', args);
        
        // Tentar extrair o body
        if (args[1] && args[1].body) {
            try {
                const body = JSON.parse(args[1].body);
                console.log('📦 DADOS ENVIADOS:', {
                    amount: body.p_amount,
                    date: body.p_date,
                    description: body.p_description,
                    is_installment: body.p_is_installment,
                    current_installment: body.p_current_installment,
                    total_installments: body.p_total_installments,
                    series_id: body.p_series_id
                });
            } catch (e) {
                console.log('❌ Erro ao parsear body:', e);
            }
        }
    }
    
    // Chamar o fetch original e logar a resposta
    return originalFetch.apply(this, args).then(response => {
        if (typeof url === 'string' && url.includes('rpc/create_financial_record')) {
            response.clone().json().then(data => {
                console.log('✅ RESPOSTA RPC:', data);
            }).catch(e => {
                console.log('❌ Erro ao ler resposta:', e);
            });
        }
        return response;
    });
};

console.log('✅ DEBUG ATIVADO! Agora tente criar uma transação parcelada.');
console.log('📊 Você verá os logs de cada chamada ao banco de dados.');

// ============================================================================
// O QUE PROCURAR NOS LOGS:
// 
// 1. Quantas vezes "CHAMADA RPC" aparece?
//    - Deve aparecer 10 vezes para 10 parcelas
//
// 2. As datas (p_date) são diferentes?
//    - Devem ser: 2025-01-XX, 2025-02-XX, 2025-03-XX, etc.
//
// 3. Os valores (p_amount) estão corretos?
//    - Para 100 total em 10 parcelas, deve ser 10 cada
//
// 4. Há algum erro na resposta?
//    - Se houver, copie e me envie
// ============================================================================
