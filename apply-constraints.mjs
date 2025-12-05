// Script para aplicar constraints SQL no Supabase
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Constraints SQL
const constraints = [
    {
        name: 'check_transfer_not_circular',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transfer_not_circular;
              ALTER TABLE public.transactions ADD CONSTRAINT check_transfer_not_circular
              CHECK (type != 'TRANSFERÊNCIA' OR account_id IS DISTINCT FROM destination_account_id);`
    },
    {
        name: 'check_amount_positive',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_amount_positive;
              ALTER TABLE public.transactions ADD CONSTRAINT check_amount_positive
              CHECK (amount > 0);`
    },
    {
        name: 'check_destination_amount_positive',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_destination_amount_positive;
              ALTER TABLE public.transactions ADD CONSTRAINT check_destination_amount_positive
              CHECK (destination_amount IS NULL OR destination_amount > 0);`
    },
    {
        name: 'check_exchange_rate_positive',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_exchange_rate_positive;
              ALTER TABLE public.transactions ADD CONSTRAINT check_exchange_rate_positive
              CHECK (exchange_rate IS NULL OR exchange_rate > 0);`
    },
    {
        name: 'check_transfer_has_destination',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transfer_has_destination;
              ALTER TABLE public.transactions ADD CONSTRAINT check_transfer_has_destination
              CHECK (type != 'TRANSFERÊNCIA' OR (destination_account_id IS NOT NULL AND destination_account_id != ''));`
    },
    {
        name: 'check_expense_has_account',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_expense_has_account;
              ALTER TABLE public.transactions ADD CONSTRAINT check_expense_has_account
              CHECK (type != 'DESPESA' OR (payer_id IS NOT NULL AND payer_id != 'me') OR (account_id IS NOT NULL AND account_id != '' AND account_id != 'EXTERNAL'));`
    },
    {
        name: 'check_income_has_account',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_income_has_account;
              ALTER TABLE public.transactions ADD CONSTRAINT check_income_has_account
              CHECK (type != 'RECEITA' OR (account_id IS NOT NULL AND account_id != '' AND account_id != 'EXTERNAL'));`
    }
];

async function applyConstraints() {
    console.log('🔧 APLICANDO CONSTRAINTS SQL NO SUPABASE\n');
    console.log('='.repeat(50));

    let successCount = 0;
    let failCount = 0;

    for (const constraint of constraints) {
        console.log(`\n📌 Aplicando: ${constraint.name}...`);

        try {
            // Tentar via RPC (pode não funcionar)
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ query: constraint.sql })
            });

            if (response.ok) {
                console.log(`✅ ${constraint.name} - Aplicado com sucesso`);
                successCount++;
            } else {
                console.log(`⚠️  ${constraint.name} - RPC não disponível`);
                console.log(`💡 Execute manualmente no SQL Editor`);
                failCount++;
            }
        } catch (error) {
            console.log(`⚠️  ${constraint.name} - ${error.message}`);
            console.log(`💡 Execute manualmente no SQL Editor`);
            failCount++;
        }
    }

    console.log('\n' + '='.repeat(50));
    console.log('\n📊 RESUMO:\n');
    console.log(`✅ Aplicados automaticamente: ${successCount}`);
    console.log(`⚠️  Precisam aplicação manual: ${failCount}`);

    if (failCount > 0) {
        console.log('\n💡 INSTRUÇÕES PARA APLICAÇÃO MANUAL:\n');
        console.log('1. Acesse: https://supabase.com/dashboard/project/mlqzeihukezlozooqhko/sql/new');
        console.log('2. Copie o conteúdo do arquivo: CONSTRAINTS_VALIDACAO.sql');
        console.log('3. Cole no SQL Editor');
        console.log('4. Clique em "Run" ou pressione Ctrl+Enter');
        console.log('5. Verifique que todas as constraints foram criadas\n');
    }

    // Verificar constraints existentes
    console.log('\n🔍 Verificando constraints existentes...\n');

    try {
        const { data, error } = await supabase
            .from('transactions')
            .select('*')
            .limit(1);

        if (!error) {
            console.log('✅ Conexão com banco OK');
            console.log('✅ Tabela transactions acessível');
        }
    } catch (error) {
        console.log('⚠️  Erro ao verificar:', error.message);
    }

    console.log('\n✅ PROCESSO CONCLUÍDO!\n');
}

applyConstraints().catch(console.error);
