// Script para testar o factory reset
// Execute no console do navegador após fazer login

async function testFactoryReset() {
  console.log('🧪 INICIANDO TESTE DO FACTORY RESET');
  
  // 1. Verificar dados antes do reset
  console.log('📊 Dados antes do reset:');
  const { data: beforeData } = await supabase.rpc('diagnose_user_data', {
    target_user_id: (await supabase.auth.getUser()).data.user.id
  });
  console.log('Antes:', beforeData);
  
  // 2. Executar factory reset
  console.log('🔄 Executando factory reset...');
  const { data: resetResult } = await supabase.rpc('execute_factory_reset_complete_v2', {
    target_user_id: (await supabase.auth.getUser()).data.user.id
  });
  console.log('Resultado do reset:', resetResult);
  
  // 3. Verificar dados após o reset
  console.log('📊 Dados após o reset:');
  const { data: afterData } = await supabase.rpc('diagnose_user_data', {
    target_user_id: (await supabase.auth.getUser()).data.user.id
  });
  console.log('Depois:', afterData);
  
  // 4. Verificar transações visíveis
  console.log('👁️ Transações visíveis no fluxo de caixa:');
  const { data: visibleTxs } = await supabase.rpc('get_user_visible_transactions', {
    target_user_id: (await supabase.auth.getUser()).data.user.id
  });
  console.log('Transações visíveis:', visibleTxs);
  
  // 5. Verificar completude
  console.log('✅ Verificando completude:');
  const { data: completeness } = await supabase.rpc('verify_factory_reset_completeness_v2', {
    target_user_id: (await supabase.auth.getUser()).data.user.id
  });
  console.log('Completude:', completeness);
  
  console.log('🏁 TESTE CONCLUÍDO');
}

// Execute a função
testFactoryReset().catch(console.error);