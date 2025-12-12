import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// FULL SPECTRUM OPTIMIZATIONS
const optimizations = [
    // --- TRANSACTIONS EXTRAS ---
    {
        name: 'idx_transactions_trip_id',
        sql: `CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON public.transactions (trip_id);`
    },
    {
        name: 'fk_transactions_trip_set_null',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_trip;
              ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_trip
              FOREIGN KEY (trip_id) REFERENCES public.trips(id) ON DELETE SET NULL;`
    },

    // --- TRIPS ---
    {
        name: 'check_trip_dates_valid',
        sql: `ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS check_trip_dates_valid;
              ALTER TABLE public.trips ADD CONSTRAINT check_trip_dates_valid
              CHECK (end_date >= start_date);`
    },
    {
        name: 'check_trip_budget_positive',
        sql: `ALTER TABLE public.trips DROP CONSTRAINT IF EXISTS check_trip_budget_positive;
              ALTER TABLE public.trips ADD CONSTRAINT check_trip_budget_positive
              CHECK (budget IS NULL OR budget >= 0);`
    },

    // --- BUDGETS ---
    {
        name: 'idx_budgets_user_period',
        sql: `CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.budgets (user_id, period);`
    },
    {
        name: 'check_budget_target_positive',
        sql: `ALTER TABLE public.budgets DROP CONSTRAINT IF EXISTS check_budget_target_positive;
              ALTER TABLE public.budgets ADD CONSTRAINT check_budget_target_positive
              CHECK (target_amount > 0);`
    },

    // --- GOALS ---
    {
        name: 'check_goal_target_positive',
        sql: `ALTER TABLE public.goals DROP CONSTRAINT IF EXISTS check_goal_target_positive;
              ALTER TABLE public.goals ADD CONSTRAINT check_goal_target_positive
              CHECK (target_amount > 0);`
    },

    // --- ACCOUNTS ---
    {
        name: 'check_account_limit_positive',
        sql: `ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS check_account_limit_positive;
              ALTER TABLE public.accounts ADD CONSTRAINT check_account_limit_positive
              CHECK (credit_limit IS NULL OR credit_limit >= 0);`
    },

    // --- ASSETS (INVESTMENTS) ---
    {
        name: 'idx_assets_type_ticker',
        sql: `CREATE INDEX IF NOT EXISTS idx_assets_type_ticker ON public.assets (type, ticker);`
    },
    {
        name: 'check_asset_positive_values',
        sql: `ALTER TABLE public.assets DROP CONSTRAINT IF EXISTS check_asset_positive_values;
              ALTER TABLE public.assets ADD CONSTRAINT check_asset_positive_values
              CHECK (quantity >= 0 AND (average_price IS NULL OR average_price >= 0));`
    }
];

async function applyFullOptimizations() {
    console.log('🚀 INICIANDO AUDITORIA COMPLETA DE BANCO DE DADOS (FULL SCAN)\n');

    let applied = 0;
    let errors = 0;

    for (const opt of optimizations) {
        console.log(`⚡ Otimizando: ${opt.name}...`);
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`
                },
                body: JSON.stringify({ query: opt.sql })
            });

            if (response.ok) {
                console.log(`   ✅ Sucesso!`);
                applied++;
            } else {
                console.log(`   ⚠️ Falha na execução RPC.`);
                console.log(`   SQL: ${opt.sql}\n`);
                errors++;
            }
        } catch (e) {
            console.error(`   ❌ Erro: ${e.message}`);
            errors++;
        }
    }

    console.log(`\n🏁 Auditoria Concluída.`);
    console.log(`✅ Otimizações Aplicadas: ${applied}`);
    console.log(`❌ Falhas: ${errors}`);
}

applyFullOptimizations();
