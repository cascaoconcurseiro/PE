// Script completo: Verificar e Corrigir Banco de Dados
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// SQL para correções do schema
const schemaCorrections = `
-- 1. Corrigir tipo do campo payer_id (UUID -> TEXT)
ALTER TABLE public.transactions 
ALTER COLUMN payer_id TYPE text USING payer_id::text;

-- 2. Adicionar campos faltantes
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS related_member_id text,
ADD COLUMN IF NOT EXISTS settled_by_tx_id uuid REFERENCES public.transactions(id),
ADD COLUMN IF NOT EXISTS reconciled boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS reconciled_with text,
ADD COLUMN IF NOT EXISTS destination_amount numeric,
ADD COLUMN IF NOT EXISTS exchange_rate numeric;

-- 3. Adicionar constraints de validação
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_payer_id_format;
ALTER TABLE public.transactions ADD CONSTRAINT check_payer_id_format 
CHECK (
    payer_id IS NULL OR 
    payer_id IN ('me', 'user') OR 
    payer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_exchange_rate_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_exchange_rate_positive 
CHECK (exchange_rate IS NULL OR exchange_rate > 0);

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_destination_amount_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_destination_amount_positive 
CHECK (destination_amount IS NULL OR destination_amount > 0);

ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_amount_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_amount_positive 
CHECK (amount > 0);
`;

// SQL para criar índices de performance
const performanceIndexes = `
-- Índices para TRANSACTIONS
CREATE INDEX IF NOT EXISTS idx_transactions_user_date_deleted 
ON public.transactions(user_id, date DESC, deleted) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_account 
ON public.transactions(account_id) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_destination 
ON public.transactions(destination_account_id) 
WHERE destination_account_id IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_trip 
ON public.transactions(trip_id) 
WHERE trip_id IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_category 
ON public.transactions(category) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_transactions_type 
ON public.transactions(type) 
WHERE deleted = false;

-- Índices para ACCOUNTS
CREATE INDEX IF NOT EXISTS idx_accounts_user_deleted 
ON public.accounts(user_id, deleted) 
WHERE deleted = false;

CREATE INDEX IF NOT EXISTS idx_accounts_type 
ON public.accounts(type) 
WHERE deleted = false;

-- Índices para TRIPS
CREATE INDEX IF NOT EXISTS idx_trips_user_dates 
ON public.trips(user_id, start_date, end_date) 
WHERE deleted = false;

-- Índices para ASSETS
CREATE INDEX IF NOT EXISTS idx_assets_user_type 
ON public.assets(user_id, type) 
WHERE deleted = false;

-- Índices para BUDGETS
CREATE INDEX IF NOT EXISTS idx_budgets_user_month 
ON public.budgets(user_id, month) 
WHERE deleted = false;

-- Índices para GOALS
CREATE INDEX IF NOT EXISTS idx_goals_user_status 
ON public.goals(user_id, completed) 
WHERE deleted = false;
`;

async function executeSQL(sql, description) {
    console.log(`\n🔧 ${description}...`);
    try {
        // Tentar executar via SQL direto
        const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseServiceKey,
                'Authorization': `Bearer ${supabaseServiceKey}`
            },
            body: JSON.stringify({ query: sql })
        });

        if (response.ok) {
            console.log(`✅ ${description} - Concluído`);
            return true;
        } else {
            console.log(`⚠️  ${description} - Método RPC não disponível`);
            console.log(`💡 Execute manualmente no SQL Editor do Supabase`);
            return false;
        }
    } catch (error) {
        console.log(`⚠️  ${description} - ${error.message}`);
        console.log(`💡 Execute manualmente no SQL Editor do Supabase`);
        return false;
    }
}

async function checkDatabaseHealth() {
    console.log('\n📊 VERIFICANDO SAÚDE DO BANCO DE DADOS\n');
    console.log('='.repeat(50));

    const issues = [];

    // 1. Verificar contagem de registros
    console.log('\n1️⃣  Contagem de Registros:');
    const tables = ['profiles', 'accounts', 'transactions', 'trips', 'budgets', 'goals', 'family_members', 'assets', 'snapshots', 'custom_categories'];

    for (const table of tables) {
        try {
            const { count, error } = await supabase
                .from(table)
                .select('*', { count: 'exact', head: true });

            if (error) {
                console.log(`   ❌ ${table.padEnd(20)} - Erro: ${error.message}`);
                issues.push(`Erro ao acessar tabela ${table}`);
            } else {
                console.log(`   ✅ ${table.padEnd(20)} - ${count || 0} registros`);
            }
        } catch (error) {
            console.log(`   ❌ ${table.padEnd(20)} - ${error.message}`);
            issues.push(`Erro ao acessar tabela ${table}`);
        }
    }

    // 2. Verificar transações órfãs (sem conta)
    console.log('\n2️⃣  Verificando Transações Órfãs:');
    try {
        const { data: transactions } = await supabase
            .from('transactions')
            .select('id, description, account_id')
            .is('account_id', null)
            .eq('deleted', false);

        if (transactions && transactions.length > 0) {
            console.log(`   ⚠️  ${transactions.length} transações sem conta encontradas`);
            issues.push(`${transactions.length} transações órfãs (sem conta)`);
        } else {
            console.log('   ✅ Nenhuma transação órfã');
        }
    } catch (error) {
        console.log(`   ⚠️  Não foi possível verificar: ${error.message}`);
    }

    // 3. Verificar transferências sem destino
    console.log('\n3️⃣  Verificando Transferências:');
    try {
        const { data: transfers } = await supabase
            .from('transactions')
            .select('id, description, destination_account_id')
            .eq('type', 'TRANSFER')
            .is('destination_account_id', null)
            .eq('deleted', false);

        if (transfers && transfers.length > 0) {
            console.log(`   ⚠️  ${transfers.length} transferências sem destino`);
            issues.push(`${transfers.length} transferências sem conta de destino`);
        } else {
            console.log('   ✅ Todas as transferências têm destino');
        }
    } catch (error) {
        console.log(`   ⚠️  Não foi possível verificar: ${error.message}`);
    }

    // 4. Verificar duplicatas
    console.log('\n4️⃣  Verificando Duplicatas:');
    try {
        const { data: transactions } = await supabase
            .from('transactions')
            .select('description, amount, date')
            .eq('deleted', false);

        if (transactions) {
            const seen = new Map();
            let duplicates = 0;

            transactions.forEach(tx => {
                const key = `${tx.description}-${tx.amount}-${tx.date}`;
                seen.set(key, (seen.get(key) || 0) + 1);
            });

            seen.forEach((count, key) => {
                if (count > 1) duplicates++;
            });

            if (duplicates > 0) {
                console.log(`   ⚠️  ${duplicates} possíveis duplicatas encontradas`);
                issues.push(`${duplicates} possíveis transações duplicadas`);
            } else {
                console.log('   ✅ Nenhuma duplicata encontrada');
            }
        }
    } catch (error) {
        console.log(`   ⚠️  Não foi possível verificar: ${error.message}`);
    }

    // Resumo
    console.log('\n' + '='.repeat(50));
    console.log('\n📋 RESUMO DA VERIFICAÇÃO:\n');

    if (issues.length === 0) {
        console.log('✅ BANCO DE DADOS SAUDÁVEL!');
        console.log('   Nenhum problema detectado.\n');
    } else {
        console.log(`⚠️  ${issues.length} PROBLEMA(S) DETECTADO(S):\n`);
        issues.forEach((issue, i) => {
            console.log(`   ${i + 1}. ${issue}`);
        });
        console.log('');
    }

    return issues;
}

async function applyCorrections() {
    console.log('\n🔧 APLICANDO CORREÇÕES NO BANCO DE DADOS\n');
    console.log('='.repeat(50));

    // Tentar aplicar correções de schema
    await executeSQL(schemaCorrections, 'Correções de Schema');

    // Tentar aplicar índices de performance
    await executeSQL(performanceIndexes, 'Índices de Performance');

    console.log('\n💡 IMPORTANTE:');
    console.log('   Se as correções não foram aplicadas automaticamente,');
    console.log('   execute os arquivos SQL manualmente no Supabase SQL Editor:');
    console.log('   - CORRECOES_COMPLETAS.sql');
    console.log('   - APPLY_INDEXES.sql\n');
}

async function main() {
    console.log('\n🚀 VERIFICAÇÃO E CORREÇÃO DO BANCO DE DADOS');
    console.log('='.repeat(50));

    // 1. Verificar saúde
    const issues = await checkDatabaseHealth();

    // 2. Aplicar correções
    await applyCorrections();

    // 3. Verificar novamente
    if (issues.length > 0) {
        console.log('\n🔄 Verificando novamente após correções...');
        await checkDatabaseHealth();
    }

    console.log('\n✅ PROCESSO CONCLUÍDO!\n');
}

main().catch(console.error);
