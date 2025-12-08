
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixOrphans() {
    console.log('--- Scanning for Orphan Transactions (NULL account_id) ---');

    // 1. Get Accounts to find a default one (preferably Credit Card)
    const { data: accounts } = await supabase.from('accounts').select('id, name, type');
    if (!accounts || accounts.length === 0) {
        console.error('No accounts found! Cannot assign orphans.');
        return;
    }

    // Prefer Credit Card, then Checking
    let defaultAccount = accounts.find(a => a.type === 'CARTÃO DE CRÉDITO' || a.type === 'CREDIT_CARD');
    if (!defaultAccount) defaultAccount = accounts[0];

    console.log(`Default Account for fixing: ${defaultAccount.name} (${defaultAccount.type}) - ${defaultAccount.id}`);

    // 2. Find Orphans
    // Transactions that are EXPENSE (or Installment/Shared) and account_id is NULL
    const { data: orphans, error } = await supabase
        .from('transactions')
        .select('*')
        .is('account_id', null)
        .neq('type', 'TRANSFERÊNCIA'); // ignore transfers for now as they might be incomplete

    if (error) { console.error(error); return; }

    console.log(`Found ${orphans.length} orphan transactions.`);

    if (orphans.length > 0) {
        console.log('Sample Orphan:', orphans[0]);

        // 3. Fix them
        console.log(`Assigning ${orphans.length} transactions to account ${defaultAccount.name}...`);

        const updates = orphans.map(t => ({
            ...t,
            account_id: defaultAccount.id,
            updated_at: new Date().toISOString()
        }));

        // Update each (Supabase bulk update via upsert or separate calls)
        // Safer to do one by one or small batches to avoid issues
        for (const t of updates) {
            const { error: updateError } = await supabase
                .from('transactions')
                .update({ account_id: defaultAccount.id })
                .eq('id', t.id);

            if (updateError) console.error(`Failed to update ${t.id}:`, updateError);
            else console.log(`Fixed: ${t.description}`);
        }

        console.log('Done fixing orphans.');
    } else {
        console.log('No orphans found. Database seems clean of NULL account_ids.');
    }

    // 4. Check for logic mismatch
    // Fetch recent installments and check their date vs closing date
    console.log('\n--- Checking Recent Installments Dates vs Account Closing ---');
    const { data: recents } = await supabase
        .from('transactions')
        .select(`*, accounts(closing_day)`)
        .eq('is_installment', true)
        .order('created_at', { ascending: false })
        .limit(5);

    recents?.forEach(t => {
        console.log(`Tx: ${t.description} | Date: ${t.date} | Account Closing: ${t.accounts?.closing_day}`);
    });

}

fixOrphans();
