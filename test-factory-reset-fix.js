/**
 * Script de teste para verificar se a correção do factory reset funciona
 * Execute este script após aplicar a migração 20251222_fix_factory_reset_cascade.sql
 */

const { createClient } = require('@supabase/supabase-js')

// Configure suas credenciais do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL'
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY'

const supabase = createClient(supabaseUrl, supabaseKey)

async function testFactoryResetFix() {
  console.log('🔍 Testando correção do Factory Reset...\n')
  
  try {
    // 1. Obter ID do usuário atual (substitua pelo ID real)
    const userId = 'SEU_USER_ID_AQUI' // ⚠️ SUBSTITUA PELO ID REAL
    
    if (userId === 'SEU_USER_ID_AQUI') {
      console.log('❌ Por favor, substitua SEU_USER_ID_AQUI pelo ID real do usuário')
      return
    }
    
    console.log(`👤 Testando para usuário: ${userId}\n`)
    
    // 2. Diagnosticar problema antes da correção
    console.log('📊 Diagnóstico antes da correção:')
    const { data: diagnosis, error: diagError } = await supabase.rpc('diagnose_factory_reset_issue_v2', {
      target_user_id: userId
    })
    
    if (diagError) {
      console.error('❌ Erro no diagnóstico:', diagError)
      return
    }
    
    console.log('   - Transações próprias:', diagnosis.own_transactions)
    console.log('   - Transações espelho:', diagnosis.mirror_transactions)
    console.log('   - Participações compartilhadas:', diagnosis.shared_participation)
    console.log('   - Espelhos órfãos:', diagnosis.orphan_mirrors)
    console.log('   - Transações no fluxo de caixa:', diagnosis.cashflow_transactions)
    console.log('   - Problema identificado:', diagnosis.problem_identified ? '✅ SIM' : '❌ NÃO')
    console.log('   - Diagnóstico:', diagnosis.diagnosis)
    console.log()
    
    // 3. Se há problema, executar factory reset corrigido
    if (diagnosis.problem_identified) {
      console.log('🔧 Executando factory reset corrigido...')
      
      const { data: resetResult, error: resetError } = await supabase.rpc('execute_factory_reset_complete_v2', {
        target_user_id: userId
      })
      
      if (resetError) {
        console.error('❌ Erro no factory reset:', resetError)
        return
      }
      
      console.log('✅ Factory reset executado com sucesso!')
      console.log('   - Transações próprias deletadas:', resetResult.transactions_deleted)
      console.log('   - Transações espelho deletadas:', resetResult.mirror_transactions_deleted)
      console.log('   - Participações removidas:', resetResult.shared_participation_removed)
      console.log('   - Contas deletadas:', resetResult.accounts_deleted)
      console.log('   - Tempo de execução:', resetResult.execution_time_ms, 'ms')
      console.log()
      
      // 4. Verificar se a correção foi completa
      console.log('🔍 Verificando completude da correção...')
      
      const { data: verification, error: verifyError } = await supabase.rpc('verify_factory_reset_completeness_v2', {
        target_user_id: userId
      })
      
      if (verifyError) {
        console.error('❌ Erro na verificação:', verifyError)
        return
      }
      
      console.log('   - Reset completo:', verification.is_complete ? '✅ SIM' : '❌ NÃO')
      console.log('   - Transações restantes:', verification.remaining_transactions)
      console.log('   - Espelhos restantes:', verification.remaining_mirror_transactions)
      console.log('   - Participações restantes:', verification.remaining_shared_participation)
      console.log('   - Contas restantes:', verification.remaining_accounts)
      console.log()
      
      // 5. Testar fluxo de caixa
      console.log('💰 Testando fluxo de caixa...')
      
      const { data: cashflow, error: cashflowError } = await supabase.rpc('get_monthly_cashflow', {
        p_year: 2024,
        p_user_id: userId
      })
      
      if (cashflowError) {
        console.error('❌ Erro no fluxo de caixa:', cashflowError)
        return
      }
      
      if (cashflow && cashflow.length > 0) {
        console.log('❌ PROBLEMA: Fluxo de caixa ainda retorna dados!')
        console.log('   Dados retornados:', cashflow)
      } else {
        console.log('✅ Fluxo de caixa está limpo (sem dados)')
      }
      
    } else {
      console.log('✅ Nenhum problema identificado - factory reset já está funcionando corretamente')
    }
    
    console.log('\n🎉 Teste concluído!')
    
  } catch (error) {
    console.error('❌ Erro durante o teste:', error)
  }
}

// Executar teste
testFactoryResetFix()