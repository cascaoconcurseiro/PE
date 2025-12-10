-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║                    PEMEIA - VERIFICAÇÃO DE CONSISTÊNCIA                      ║
-- ║                    Execute este script no Supabase SQL Editor                 ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- ═══════════════════════════════════════════════════════════════════════════════
-- 1. VERIFICAR SALDOS DE CONTAS
-- ═══════════════════════════════════════════════════════════════════════════════

-- Compara saldo atual com saldo calculado a partir das transações
WITH calculated_balances AS (
    SELECT 
        a.id,
        a.name,
        a.balance as current_balance,
        a.initial_balance,
        COALESCE(a.initial_balance, 0) + 
        COALESCE(SUM(CASE 
            WHEN t.type = 'RECEITA' THEN t.amount
            WHEN t.type = 'DESPESA' THEN -t.amount
            WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id::text = a.id::text THEN -t.amount
            ELSE 0
        END), 0) +
        COALESCE((
            SELECT SUM(COALESCE(t2.destination_amount, t2.amount))
            FROM transactions t2 
            WHERE t2.destination_account_id::text = a.id::text 
            AND t2.type = 'TRANSFERÊNCIA'
            AND t2.deleted = false
        ), 0) as calculated_balance
    FROM accounts a
    LEFT JOIN transactions t ON t.account_id::text = a.id::text AND t.deleted = false
    WHERE a.deleted = false
    GROUP BY a.id, a.name, a.balance, a.initial_balance
)
SELECT 
    '🔍 AUDITORIA DE SALDOS' as verificacao,
    name as conta,
    current_balance as saldo_atual,
    calculated_balance as saldo_calculado,
    CASE 
        WHEN ABS(current_balance - calculated_balance) < 0.01 THEN '✅ OK'
        ELSE '❌ DIFERENÇA: ' || (current_balance - calculated_balance)::text
    END as status
FROM calculated_balances
ORDER BY name;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 2. TRANSAÇÕES ÓRFÃS (sem conta válida)
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
    '🔍 TRANSAÇÕES ÓRFÃS' as verificacao,
    t.id,
    t.description,
    t.amount,
    t.date,
    t.account_id,
    CASE 
        WHEN t.account_id IS NULL THEN '⚠️ SEM CONTA'
        WHEN t.account_id = 'EXTERNAL' THEN '✅ EXTERNA'
        WHEN NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id::text = t.account_id::text) THEN '❌ CONTA NÃO EXISTE'
        ELSE '✅ OK'
    END as status
FROM transactions t
WHERE t.deleted = false
AND (
    t.account_id IS NULL 
    OR (t.account_id != 'EXTERNAL' AND NOT EXISTS (SELECT 1 FROM accounts a WHERE a.id::text = t.account_id::text))
)
ORDER BY t.date DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 3. PARCELAS INCONSISTENTES
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
    '🔍 PARCELAS INCONSISTENTES' as verificacao,
    series_id,
    description,
    COUNT(*) as parcelas_encontradas,
    MAX(total_installments) as total_esperado,
    CASE 
        WHEN COUNT(*) = MAX(total_installments) THEN '✅ OK'
        WHEN COUNT(*) < MAX(total_installments) THEN '⚠️ FALTAM ' || (MAX(total_installments) - COUNT(*))::text || ' PARCELAS'
        ELSE '❌ PARCELAS EXTRAS: ' || (COUNT(*) - MAX(total_installments))::text
    END as status
FROM transactions
WHERE is_installment = true 
AND series_id IS NOT NULL
AND deleted = false
GROUP BY series_id, description
HAVING COUNT(*) != MAX(total_installments)
ORDER BY description;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 4. TRANSAÇÕES COMPARTILHADAS SEM MEMBRO
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT 
    '🔍 COMPARTILHADAS SEM SPLIT' as verificacao,
    t.id,
    t.description,
    t.amount,
    t.is_shared,
    jsonb_array_length(COALESCE(t.shared_with, '[]'::jsonb)) as num_splits,
    CASE 
        WHEN t.is_shared = true AND jsonb_array_length(COALESCE(t.shared_with, '[]'::jsonb)) = 0 THEN '⚠️ SHARED SEM SPLITS'
        ELSE '✅ OK'
    END as status
FROM transactions t
WHERE t.deleted = false
AND t.is_shared = true
AND jsonb_array_length(COALESCE(t.shared_with, '[]'::jsonb)) = 0
ORDER BY t.date DESC
LIMIT 20;

-- ═══════════════════════════════════════════════════════════════════════════════
-- 5. RESUMO GERAL
-- ═══════════════════════════════════════════════════════════════════════════════

SELECT '📊 RESUMO DO BANCO' as item, '' as valor
UNION ALL
SELECT 'Total de Contas', (SELECT COUNT(*)::text FROM accounts WHERE deleted = false)
UNION ALL
SELECT 'Total de Transações', (SELECT COUNT(*)::text FROM transactions WHERE deleted = false)
UNION ALL
SELECT 'Transações Deletadas (soft)', (SELECT COUNT(*)::text FROM transactions WHERE deleted = true)
UNION ALL
SELECT 'Total de Metas', (SELECT COUNT(*)::text FROM goals WHERE deleted = false)
UNION ALL
SELECT 'Total de Orçamentos', (SELECT COUNT(*)::text FROM budgets WHERE deleted = false)
UNION ALL
SELECT 'Total de Viagens', (SELECT COUNT(*)::text FROM trips WHERE deleted = false)
UNION ALL
SELECT 'Total de Membros Família', (SELECT COUNT(*)::text FROM family_members WHERE deleted = false)
UNION ALL
SELECT 'Total de Ativos', (SELECT COUNT(*)::text FROM assets WHERE deleted = false);

-- ═══════════════════════════════════════════════════════════════════════════════
-- 6. RECALCULAR TODOS OS SALDOS (USE COM CUIDADO!)
-- ═══════════════════════════════════════════════════════════════════════════════

-- Descomente o bloco abaixo para recalcular todos os saldos
/*
DO $$
DECLARE
    r record;
BEGIN
    -- Reset para saldo inicial
    UPDATE accounts SET balance = COALESCE(initial_balance, 0);
    
    -- Recalcular baseado em todas as transações
    FOR r IN SELECT * FROM transactions WHERE deleted = false ORDER BY date ASC, created_at ASC LOOP
        IF r.type = 'RECEITA' THEN
            UPDATE accounts SET balance = balance + r.amount WHERE id::text = r.account_id::text;
        ELSIF r.type = 'DESPESA' THEN
            UPDATE accounts SET balance = balance - r.amount WHERE id::text = r.account_id::text;
        ELSIF r.type = 'TRANSFERÊNCIA' THEN
            UPDATE accounts SET balance = balance - r.amount WHERE id::text = r.account_id::text;
            IF r.destination_account_id IS NOT NULL THEN
                UPDATE accounts SET balance = balance + COALESCE(r.destination_amount, r.amount) WHERE id::text = r.destination_account_id::text;
            END IF;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ Saldos recalculados com sucesso!';
END;
$$;
*/
