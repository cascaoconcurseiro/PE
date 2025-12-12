import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const optimizations = [
    // 1. PERFORMANCE INDEXES
    {
        name: 'idx_transactions_user_date',
        sql: `CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);`
    },
    {
        name: 'idx_transactions_account_date',
        sql: `CREATE INDEX IF NOT EXISTS idx_transactions_account_date ON public.transactions (account_id, date DESC);`
    },
    {
        name: 'idx_transactions_category',
        sql: `CREATE INDEX IF NOT EXISTS idx_transactions_category ON public.transactions (user_id, category);`
    },

    // 2. INTEGRITY RULES (FOREIGN KEYS & CASCADES)
    // Solves "Orphan Transactions" automatically.
    // If Account is deleted -> Delete its normal transactions automatically.
    {
        name: 'fk_transactions_account_cascade',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_account;
              ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_account
              FOREIGN KEY (account_id) REFERENCES public.accounts(id) ON DELETE CASCADE;`
    },
    // If Destination Account is deleted -> Set destination to NULL (turn transfer into expense)
    // This prevents the "Broken Transfer" issue where it points to nowhere.
    {
        name: 'fk_transactions_dest_account_set_null',
        sql: `ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS fk_transactions_dest_account;
              ALTER TABLE public.transactions ADD CONSTRAINT fk_transactions_dest_account
              FOREIGN KEY (destination_account_id) REFERENCES public.accounts(id) ON DELETE SET NULL;`
    }
];

async function applyOptimizations() {
    console.log('🚀 INICIANDO OTIMIZAÇÃO DE BANCO DE DADOS (SPECIALIST MODE)\n');

    let applied = 0;

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
                console.log(`   ⚠️ Falha na execução RPC (Talvez precise de permissões de Super Admin).`);
                console.log(`   SQL para rodar manual: \n   ${opt.sql}\n`);
            }
        } catch (e) {
            console.error(`   ❌ Erro: ${e.message}`);
        }
    }

    console.log(`\n🏁 Concluído. ${applied} otimizações aplicadas.`);
}

applyOptimizations();
