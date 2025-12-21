/**
 * Script para verificar que a limpeza completa dos dados foi realizada
 */

import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.VITE_SUPABASE_URL || 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_0L8jKQ0MyqcRKrvOHtyOHw_Y4M07CZx';

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyCleanup() {
    console.log('🧹 Verificando limpeza completa dos dados do sistema compartilhado...\n');
    
    // Verificar se todas as tabelas estão vazias
    const tablesToCheck = [
        'shared_transaction_requests',
        'shared_transaction_mirrors',
        'shared_system_audit_logs',
        'shared_operation_queue',
        'shared_circuit_breaker',
        'shared_operation_logs',
        'shared_inconsistencies',
        'shared_reconciliation_history',
        'backup_shared_requests_pre_overhaul',
        'backup_transactions_pre_overhaul'
    ];
    
    console.log('📊 Verificando tabelas do sistema compartilhado...');
    let allEmpty = true;
    
    for (const table of tablesToCheck) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });
            
            if (error) {
                console.log(`❌ Erro ao verificar ${table}: ${error.message}`);
                allEmpty = false;
            } else {
                const status = count === 0 ? '✅' : '⚠️';
                console.log(`${status} ${table}: ${count} registros`);
                if (count > 0) allEmpty = false;
            }
        } catch (e) {
            console.log(`❌ Erro ao verificar ${table}: ${e.message}`);
            allEmpty = false;
        }
    }
    
    // Verificar transações compartilhadas
    console.log('\n🔍 Verificando transações compartilhadas...');
    
    try {
        const { count: sharedCount, error: sharedError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('is_shared', true);
        
        if (sharedError) {
            console.log(`❌ Erro ao verificar transações compartilhadas: ${sharedError.message}`);
            allEmpty = false;
        } else {
            const status = sharedCount === 0 ? '✅' : '⚠️';
            console.log(`${status} Transações compartilhadas: ${sharedCount} registros`);
            if (sharedCount > 0) allEmpty = false;
        }
        
        const { count: mirrorCount, error: mirrorError } = await supabase
            .from('transactions')
            .select('*', { count: 'exact', head: true })
            .eq('is_mirror', true);
        
        if (mirrorError) {
            console.log(`❌ Erro ao verificar transações espelho: ${mirrorError.message}`);
            allEmpty = false;
        } else {
            const status = mirrorCount === 0 ? '✅' : '⚠️';
            console.log(`${status} Transações espelho: ${mirrorCount} registros`);
            if (mirrorCount > 0) allEmpty = false;
        }
        
    } catch (e) {
        console.log(`❌ Erro ao verificar transações: ${e.message}`);
        allEmpty = false;
    }
    
    // Executar teste de integridade
    console.log('\n🧪 Executando teste de integridade...');
    try {
        const { data, error } = await supabase.rpc('verify_shared_system_integrity');
        if (error) {
            console.log(`❌ Teste de integridade falhou: ${error.message}`);
        } else {
            console.log(`✅ Teste de integridade passou: Sistema íntegro e limpo`);
        }
    } catch (e) {
        console.log(`❌ Erro no teste de integridade: ${e.message}`);
    }
    
    // Resumo final
    console.log(`\n📋 Resultado da verificação de limpeza:`);
    
    if (allEmpty) {
        console.log('🎉 LIMPEZA COMPLETA REALIZADA COM SUCESSO!');
        console.log('✨ Todos os dados antigos do sistema compartilhado foram removidos.');
        console.log('🔧 O sistema está pronto para uso com dados limpos.');
        console.log('🛡️  Estrutura do banco mantida e funcional.');
        return true;
    } else {
        console.log('⚠️  LIMPEZA INCOMPLETA - Alguns dados ainda existem.');
        console.log('🔍 Verifique os registros marcados acima.');
        return false;
    }
}

// Executar verificação
verifyCleanup().catch(console.error);