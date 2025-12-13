
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function verify() {
    console.log('🔍 VERIFICANDO DEPLOY...');

    // Check Columns
    console.log('1. Checando Colunas...');
    const queries = [
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'mirror_transaction_id'",
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'family_members' AND column_name = 'connection_status'"
    ];

    let success = true;

    for (const q of queries) {
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: q })
        });

        const result = await response.json();
        if (result && result.length > 0) {
            console.log(`   ✅ Encontrado: ${result[0].column_name}`);
        } else {
            console.error(`   ❌ NÃO ENCONTRADO (Erro no DDL)`);
            success = false;
        }
    }

    // Check Functions
    console.log('2. Checando Funções...');
    const funcQuery = "SELECT routine_name FROM information_schema.routines WHERE routine_name = 'handle_transaction_mirroring_v4'";
    const resFunc = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
        },
        body: JSON.stringify({ query: funcQuery })
    });
    const funcResult = await resFunc.json();

    if (funcResult && funcResult.length > 0) {
        console.log(`   ✅ Função Encontrada: ${funcResult[0].routine_name}`);
    } else {
        console.error(`   ❌ Função handle_transaction_mirroring_v4 NÃO ENCONTRADA (Erro no DML/Logic)`);
        success = false;
    }

    if (success) {
        console.log('\n🟢 SISTEMA VERIFICADO E OPERACIONAL.');
    } else {
        console.log('\n🔴 FALHAS ENCONTRADAS. Verifique os logs.');
    }
}

verify();
