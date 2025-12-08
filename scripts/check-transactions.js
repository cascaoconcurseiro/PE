
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
const envPath = path.resolve(__dirname, '../.env.local');
const envConfig = require('dotenv').parse(fs.readFileSync(envPath));

const supabaseUrl = envConfig.VITE_SUPABASE_URL;
const supabaseKey = envConfig.VITE_SUPABASE_ANON_KEY;
const userEmail = envConfig.VITE_TEST_USER_EMAIL; // Might not be available, we'll try to find any user or just query if RLS allows anonymously with service key (usually not anon key).

// ACTUALLY: We need to sign in as the user to bypass RLS if it's enabled properly.
// Or use SERVICE_ROLE_KEY if available in .env (usually not in frontend .env).
// Let's assume we can sign in with the hardcoded test user credential if it exists, or just try to LIST everything if RLS is off (dangerous but possible dev state).

// Strategy: Since I can't easily get the user's password here, I'll rely on reading transactions for *any* user if I can, OR ideally, the user has a session. Wait, I can't access browser session.
// IF I can't auth, I can't see data protected by RLS.

// ALTERNATIVE: Use `select * from transactions` directly via a SQL tool if I had one. I don't.
// I have `reset-database.js` which likely uses a SERVICE ROLE key if it exists. Let's check `process.env`.

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || envConfig.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
    console.log("❌ Service Role Key not found. Cannot query database directly without RLS bypass.");
    // Try to read .env.local for SERVICE_KEY?
}

const supabase = createClient(supabaseUrl, serviceRoleKey || supabaseKey);

async function checkTransactions() {
    console.log("🔍 Checking transactions in DB...");

    // If no service key, this might fail or return empty if RLS is on and we are anon.
    // Unless RLS is off? The user applied policies.

    const { data: accounts, error: accError } = await supabase.from('accounts').select('id, name, type');

    if (accError) {
        console.error("Error fetching accounts:", accError);
        return;
    }

    console.log(`✅ Found ${accounts.length} accounts.`);
    accounts.forEach(a => console.log(`   - ${a.name} (${a.type}) ID: ${a.id}`));

    // Fetch transactions for Credit Cards
    const ccAccounts = accounts.filter(a => a.type === 'CARTÃO DE CRÉDITO' || a.type === 'CREDIT_CARD');

    for (const cc of ccAccounts) {
        console.log(`\n💳 Check transactions for ${cc.name} (${cc.id})...`);

        const { data: txs, error: txError } = await supabase
            .from('transactions')
            .select('id, date, description, amount, category, is_installment, current_installment, total_installments, deleted')
            .eq('account_id', cc.id)
            .eq('deleted', false) // Check active only first
            .order('date', { ascending: false })
            .limit(20);

        if (txError) {
            console.error("Error fetching txs:", txError);
            continue;
        }

        console.log(`   Found ${txs.length} recent transactions (Active):`);
        txs.forEach(t => {
            console.log(`   [${t.date}] ${t.description} | ${t.amount} | Inst: ${t.is_installment ? `${t.current_installment}/${t.total_installments}` : 'No'}`);
        });

        // Check Future
        const today = new Date().toISOString().split('T')[0];
        const { data: futureTxs, error: fError } = await supabase
            .from('transactions')
            .select('id, date, description, amount')
            .eq('account_id', cc.id)
            .gte('date', today)
            .order('date', { ascending: true });

        if (futureTxs && futureTxs.length > 0) {
            console.log(`   🔮 Found ${futureTxs.length} FUTURE transactions:`);
            futureTxs.forEach(t => console.log(`      [${t.date}] ${t.description} | ${t.amount}`));
        } else {
            console.log(`   ⚠️ No future transactions found.`);
        }
    }
}

checkTransactions();
