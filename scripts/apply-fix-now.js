
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrphans() {
    console.log('🚀 Fixing Orphans...');

    // 1. Find Credit Card Account ID
    const { data: accounts } = await supabase
        .from('accounts')
        .select('id')
        .in('type', ['CARTÃO DE CRÉDITO', 'CREDIT_CARD'])
        .limit(1);

    if (!accounts || accounts.length === 0) {
        console.error('❌ No credit card account found.');
        return;
    }
    const creditCardId = accounts[0].id;
    console.log(`💳 Using Credit Card ID: ${creditCardId}`);

    // 2. Fetch Orphans (Client-side fallback since RPC exec might fail)
    // 2a. Installments
    const { data: installments } = await supabase
        .from('transactions')
        .select('id, description')
        .is('account_id', null)
        .or('is_installment.eq.true,description.ilike.%parcela%');

    // 2b. Opening Balances (Imports)
    const { data: imports } = await supabase
        .from('transactions')
        .select('id, description')
        .is('account_id', null)
        .eq('category', 'Saldo Inicial / Ajuste');

    const allOrphans = [...(installments || []), ...(imports || [])];
    console.log(`⚠️ Found ${allOrphans.length} orphans to fix.`);

    if (allOrphans.length === 0) {
        console.log('✅ No orphans found.');
        return;
    }

    // 3. Update them
    let successCount = 0;
    for (const tx of allOrphans) {
        const { error } = await supabase
            .from('transactions')
            .update({ account_id: creditCardId })
            .eq('id', tx.id);

        if (error) console.error(`Failed to update ${tx.id}:`, error);
        else {
            console.log(`✅ Fixed: ${tx.description}`);
            successCount++;
        }
    }

    console.log(`\n🎉 process complete. Fixed ${successCount}/${allOrphans.length} items.`);
}

fixOrphans();
