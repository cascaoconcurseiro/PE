
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mlqzeihukezlozooqhko.supabase.co';
const supabaseServiceKey = 'sb_secret_MdMVxu-OTJAvbpxsoh44Xg_-lcY_v1U';

async function executeSQL(sql, description) {
    console.log(`\n🔧 ${description}...`);
    try {
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
            console.log(`⚠️  ${description} - Failed: Status ${response.status} ${response.statusText}`);
            const text = await response.text();
            console.log('Response:', text);
            return false;
        }
    } catch (error) {
        console.log(`⚠️  ${description} - ${error.message}`);
        return false;
    }
}

async function fix() {
    console.log('--- Applying Orphan Fix via RPC ---');

    const sql = `
    DO $$
    DECLARE
        target_account_id UUID;
        affected_rows INTEGER;
    BEGIN
        -- Find a default credit card account
        SELECT id INTO target_account_id FROM accounts WHERE type IN ('CARTÃO DE CRÉDITO', 'CREDIT_CARD') LIMIT 1;
        
        -- If not found, find any account
        IF target_account_id IS NULL THEN
            SELECT id INTO target_account_id FROM accounts LIMIT 1;
        END IF;

        IF target_account_id IS NOT NULL THEN
            UPDATE transactions
            SET account_id = target_account_id
            WHERE account_id IS NULL 
              AND (is_installment = true OR category = 'Saldo Inicial / Ajuste' OR description ILIKE '%parcela%');
            
            GET DIAGNOSTICS affected_rows = ROW_COUNT;
            RAISE NOTICE 'Fixed % orphan transactions assigned to account %', affected_rows, target_account_id;
        ELSE
            RAISE NOTICE 'No account found to assign transactions to.';
        END IF;
    END $$;
    `;

    await executeSQL(sql, 'Fix Orphan Transactions');
}

fix();
