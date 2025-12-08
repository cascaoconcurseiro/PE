
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const envVars = Object.fromEntries(
    envContent.split('\n').filter(l => l.includes('=')).map(l => {
        const [k, v] = l.split('=');
        return [k.trim(), v.trim()];
    })
);

const supabaseUrl = envVars['VITE_SUPABASE_URL'];
const supabaseKey = envVars['VITE_SUPABASE_ANON_KEY'];
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- Diagnostic: Checking for Orphan/Bad Installments ---');

    const { data: txs, error } = await supabase
        .from('transactions')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (error) { console.error(error); return; }

    console.log(`Checking ${txs.length} transactions...`);

    let orphans = 0;

    for (const tx of txs) {
        // Filter for relevant types manually to avoid filter syntax errors
        const isTarget = tx.is_installment === true || tx.category === 'Saldo Inicial / Ajuste' || tx.description.toLowerCase().includes('parcela');

        if (isTarget) {
            if (!tx.account_id) {
                console.log(`[ORPHAN] ID: ${tx.id} | Desc: ${tx.description} | Date: ${tx.date} | AccountId: NULL`);
                orphans++;
            } else {
                console.log(`[VALID?] ID: ${tx.id} | Desc: ${tx.description} | Date: ${tx.date} | AccountId: ${tx.account_id} | Amount: ${tx.amount}`);
            }
        }
    }

    // Check for specific case: Installment exists, Account ID exists, but maybe DATE is misaligned?
    // User says: "Only affects balance".
    // This implies getCommittedBalance sees it. getInvoiceData does not.
    // getInvoiceData filters by DATE RANGE.

    console.log(`Found ${orphans} orphans.`);
}

diagnose();
