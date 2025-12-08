
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    console.log('--- Checking DB State ---');

    // 1. Are there still orphans?
    const { count: orphanCount, error } = await supabase
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .is('account_id', null)
        .eq('deleted', false);

    console.log(`Orphans Remaining: ${orphanCount} (Should be 0)`);
    if (error) console.error(error);

    // 2. Check recent "Imported" invoices or "Installments"
    const { data: recents } = await supabase
        .from('transactions')
        .select('id, description, date, account_id, category, is_installment')
        .or('category.eq.Saldo Inicial / Ajuste,is_installment.eq.true')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\nRecent Imports/Installments:');
    recents?.forEach(t => console.log(t));

}

check();
