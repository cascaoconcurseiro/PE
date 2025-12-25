-- ==============================================================================
-- VALIDAÇÃO DE INTEGRIDADE DOS DADOS FINANCEIROS
-- DATA: 25/12/2024
-- OBJETIVO: Verificar partidas dobradas, consistência e integridade dos dados
-- ==============================================================================

-- ==============================================================================
-- 1. VALIDAÇÃO DE PARTIDAS DOBRADAS
-- ==============================================================================

-- 1.1. Verificar se débitos = créditos por usuário
SELECT 
    user_id,
    SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) as total_debits,
    SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL) as total_credits,
    SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) -
    SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL) as difference,
    CASE 
        WHEN ABS(
            SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) -
            SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL)
        ) < 0.01 THEN '✅ BALANCEADO'
        ELSE '❌ DESBALANCEADO'
    END as status
FROM ledger_entries
WHERE archived = false
GROUP BY user_id
ORDER BY ABS(
    SUM(amount) FILTER (WHERE debit_account_id IS NOT NULL) -
    SUM(amount) FILTER (WHERE credit_account_id IS NOT NULL)
) DESC;

-- 1.2. Verificar transações sem entradas no ledger
SELECT 
    t.id,
    t.user_id,
    t.description,
    t.amount,
    t.type,
    t.date,
    COUNT(l.id) as ledger_entries_count,
    CASE 
        WHEN COUNT(l.id) = 0 THEN '❌ SEM LEDGER'
        WHEN COUNT(l.id) = 1 THEN '✅ OK'
        ELSE '⚠️ MÚLTIPLAS ENTRADAS'
    END as status
FROM transactions t
LEFT JOIN ledger_entries l ON l.transaction_id = t.id
WHERE t.deleted = false
GROUP BY t.id, t.user_id, t.description, t.amount, t.type, t.date
HAVING COUNT(l.id) != 1
ORDER BY t.date DESC
LIMIT 50;

-- 1.3. Verificar se contas de débito e crédito são diferentes
SELECT 
    id,
    transaction_id,
    description,
    amount,
    debit_account_id,
    credit_account_id,
    '❌ DÉBITO = CRÉDITO' as status
FROM ledger_entries
WHERE debit_account_id = credit_account_id
AND archived = false;

-- ==============================================================================
-- 2. VALIDAÇÃO DE SPLITS (DIVISÕES)
-- ==============================================================================

-- 2.1. Verificar se splits não excedem o total da transação
SELECT 
    t.id,
    t.description,
    t.amount as transaction_amount,
    t.date,
    (
        SELECT SUM((split->>'assignedAmount')::numeric)
        FROM jsonb_array_elements(t.shared_with) as split
    ) as splits_total,
    (
        SELECT SUM((split->>'assignedAmount')::numeric)
        FROM jsonb_array_elements(t.shared_with) as split
    ) - t.amount as difference,
    CASE 
        WHEN (
            SELECT SUM((split->>'assignedAmount')::numeric)
            FROM jsonb_array_elements(t.shared_with) as split
        ) > t.amount + 0.01 THEN '❌ SPLITS > TOTAL'
        WHEN (
            SELECT SUM((split->>'assignedAmount')::numeric)
            FROM jsonb_array_elements(t.shared_with) as split
        ) < t.amount - 0.01 THEN '⚠️ SPLITS < TOTAL'
        ELSE '✅ OK'
    END as status
FROM transactions t
WHERE t.is_shared = true
AND t.deleted = false
AND t.shared_with IS NOT NULL
AND jsonb_array_length(t.shared_with) > 0
ORDER BY ABS((
    SELECT SUM((split->>'assignedAmount')::numeric)
    FROM jsonb_array_elements(t.shared_with) as split
) - t.amount) DESC
LIMIT 50;

-- 2.2. Verificar splits com valores negativos ou zero
SELECT 
    t.id,
    t.description,
    t.amount,
    split->>'memberId' as member_id,
    (split->>'assignedAmount')::numeric as assigned_amount,
    '❌ VALOR INVÁLIDO' as status
FROM transactions t,
jsonb_array_elements(t.shared_with) as split
WHERE t.is_shared = true
AND t.deleted = false
AND (split->>'assignedAmount')::numeric <= 0;

-- ==============================================================================
-- 3. VALIDAÇÃO DE TRANSFERÊNCIAS
-- ==============================================================================

-- 3.1. Verificar transferências sem conta de destino
SELECT 
    id,
    description,
    amount,
    date,
    account_id,
    destination_account_id,
    '❌ SEM DESTINO' as status
FROM transactions
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND (destination_account_id IS NULL OR destination_account_id = '');

-- 3.2. Verificar transferências circulares (origem = destino)
SELECT 
    id,
    description,
    amount,
    date,
    account_id,
    destination_account_id,
    '❌ CIRCULAR' as status
FROM transactions
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND account_id = destination_account_id;

-- 3.3. Verificar transferências multi-moeda sem destinationAmount
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.currency as source_currency,
    t.destination_amount,
    acc_src.currency as source_account_currency,
    acc_dst.currency as dest_account_currency,
    '❌ MULTI-MOEDA SEM VALOR DESTINO' as status
FROM transactions t
JOIN accounts acc_src ON acc_src.id = t.account_id
JOIN accounts acc_dst ON acc_dst.id = t.destination_account_id
WHERE t.type = 'TRANSFERÊNCIA'
AND t.deleted = false
AND acc_src.currency != acc_dst.currency
AND (t.destination_amount IS NULL OR t.destination_amount <= 0);

-- ==============================================================================
-- 4. VALIDAÇÃO DE CONTAS ÓRFÃS
-- ==============================================================================

-- 4.1. Verificar transações com conta de origem inválida
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.type,
    t.account_id,
    t.is_shared,
    t.payer_id,
    '❌ CONTA ORIGEM INVÁLIDA' as status
FROM transactions t
LEFT JOIN accounts a ON a.id = t.account_id
WHERE t.deleted = false
AND t.account_id IS NOT NULL
AND t.account_id != ''
AND a.id IS NULL
AND NOT (t.is_shared = true AND t.payer_id IS NOT NULL AND t.payer_id != 'me')
LIMIT 50;

-- 4.2. Verificar transações com conta de destino inválida
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.type,
    t.destination_account_id,
    '❌ CONTA DESTINO INVÁLIDA' as status
FROM transactions t
LEFT JOIN accounts a ON a.id = t.destination_account_id
WHERE t.deleted = false
AND t.type = 'TRANSFERÊNCIA'
AND t.destination_account_id IS NOT NULL
AND t.destination_account_id != ''
AND a.id IS NULL
LIMIT 50;

-- ==============================================================================
-- 5. VALIDAÇÃO DE VALORES
-- ==============================================================================

-- 5.1. Verificar transações com valores inválidos
SELECT 
    id,
    description,
    amount,
    date,
    type,
    CASE 
        WHEN amount IS NULL THEN '❌ VALOR NULL'
        WHEN amount <= 0 THEN '❌ VALOR <= 0'
        WHEN amount > 999999999 THEN '⚠️ VALOR MUITO ALTO'
        ELSE '❓ OUTRO'
    END as status
FROM transactions
WHERE deleted = false
AND (amount IS NULL OR amount <= 0 OR amount > 999999999)
LIMIT 50;

-- 5.2. Verificar contas com saldos inconsistentes
WITH calculated_balances AS (
    SELECT 
        a.id,
        a.name,
        a.initial_balance,
        a.balance as stored_balance,
        a.initial_balance + COALESCE(
            (
                SELECT SUM(
                    CASE 
                        WHEN t.type = 'RECEITA' THEN 
                            CASE WHEN t.is_refund THEN -t.amount ELSE t.amount END
                        WHEN t.type = 'DESPESA' THEN 
                            CASE WHEN t.is_refund THEN t.amount ELSE -t.amount END
                        WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = a.id THEN -t.amount
                        WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = a.id THEN 
                            COALESCE(t.destination_amount, t.amount)
                        ELSE 0
                    END
                )
                FROM transactions t
                WHERE (t.account_id = a.id OR t.destination_account_id = a.id)
                AND t.deleted = false
                AND NOT (t.is_shared = true AND t.payer_id IS NOT NULL AND t.payer_id != 'me')
            ), 0
        ) as calculated_balance
    FROM accounts a
    WHERE a.deleted = false
)
SELECT 
    id,
    name,
    initial_balance,
    stored_balance,
    calculated_balance,
    stored_balance - calculated_balance as difference,
    CASE 
        WHEN ABS(stored_balance - calculated_balance) < 0.01 THEN '✅ OK'
        WHEN ABS(stored_balance - calculated_balance) < 1 THEN '⚠️ PEQUENA DIFERENÇA'
        ELSE '❌ DIFERENÇA SIGNIFICATIVA'
    END as status
FROM calculated_balances
WHERE ABS(stored_balance - calculated_balance) >= 0.01
ORDER BY ABS(stored_balance - calculated_balance) DESC;

-- ==============================================================================
-- 6. VALIDAÇÃO DE PARCELAS
-- ==============================================================================

-- 6.1. Verificar parcelas duplicadas
SELECT 
    series_id,
    current_installment,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as transaction_ids,
    '❌ PARCELAS DUPLICADAS' as status
FROM transactions
WHERE is_installment = true
AND deleted = false
AND series_id IS NOT NULL
GROUP BY series_id, current_installment
HAVING COUNT(*) > 1;

-- 6.2. Verificar parcelas com valores inconsistentes
WITH installment_series AS (
    SELECT 
        series_id,
        COUNT(*) as actual_count,
        MAX(total_installments) as expected_count,
        SUM(amount) as total_amount,
        MAX(original_amount) as expected_total
    FROM transactions
    WHERE is_installment = true
    AND deleted = false
    AND series_id IS NOT NULL
    GROUP BY series_id
)
SELECT 
    series_id,
    actual_count,
    expected_count,
    total_amount,
    expected_total,
    ABS(total_amount - expected_total) as difference,
    CASE 
        WHEN actual_count != expected_count THEN '❌ CONTAGEM INCORRETA'
        WHEN ABS(total_amount - expected_total) > 0.02 THEN '❌ VALOR TOTAL INCORRETO'
        ELSE '✅ OK'
    END as status
FROM installment_series
WHERE actual_count != expected_count
OR ABS(total_amount - expected_total) > 0.02;

-- ==============================================================================
-- 7. VALIDAÇÃO DE SINCRONIZAÇÃO DE ESPELHOS
-- ==============================================================================

-- 7.1. Verificar espelhos não sincronizados
SELECT 
    m.id,
    m.original_transaction_id,
    m.mirror_transaction_id,
    m.mirror_user_id,
    m.sync_status,
    m.last_sync_at,
    m.sync_error,
    CASE 
        WHEN m.sync_status = 'SYNCED' THEN '✅ SINCRONIZADO'
        WHEN m.sync_status = 'PENDING' THEN '⚠️ PENDENTE'
        WHEN m.sync_status = 'ERROR' THEN '❌ ERRO'
        ELSE '❓ DESCONHECIDO'
    END as status
FROM shared_transaction_mirrors m
WHERE m.sync_status != 'SYNCED'
ORDER BY m.last_sync_at DESC
LIMIT 50;

-- 7.2. Verificar transações compartilhadas sem espelhos
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.is_shared,
    jsonb_array_length(t.shared_with) as members_count,
    COUNT(m.id) as mirrors_count,
    CASE 
        WHEN COUNT(m.id) = 0 THEN '❌ SEM ESPELHOS'
        WHEN COUNT(m.id) < jsonb_array_length(t.shared_with) THEN '⚠️ ESPELHOS INCOMPLETOS'
        ELSE '✅ OK'
    END as status
FROM transactions t
LEFT JOIN shared_transaction_mirrors m ON m.original_transaction_id = t.id
WHERE t.is_shared = true
AND t.deleted = false
AND t.shared_with IS NOT NULL
AND jsonb_array_length(t.shared_with) > 0
GROUP BY t.id, t.description, t.amount, t.date, t.is_shared, t.shared_with
HAVING COUNT(m.id) < jsonb_array_length(t.shared_with)
LIMIT 50;

-- 7.3. Verificar espelhos órfãos (sem transação original)
SELECT 
    m.id,
    m.original_transaction_id,
    m.mirror_transaction_id,
    m.mirror_user_id,
    '❌ ESPELHO ÓRFÃO' as status
FROM shared_transaction_mirrors m
LEFT JOIN transactions t ON t.id = m.original_transaction_id
WHERE t.id IS NULL;

-- ==============================================================================
-- 8. VALIDAÇÃO DE SOLICITAÇÕES DE COMPARTILHAMENTO
-- ==============================================================================

-- 8.1. Verificar solicitações expiradas não marcadas
SELECT 
    id,
    transaction_id,
    requester_id,
    invited_user_id,
    status,
    expires_at,
    created_at,
    '⚠️ EXPIRADA MAS NÃO MARCADA' as issue
FROM shared_transaction_requests
WHERE status = 'PENDING'
AND expires_at < NOW()
LIMIT 50;

-- 8.2. Verificar solicitações sem transação
SELECT 
    r.id,
    r.transaction_id,
    r.status,
    r.created_at,
    '❌ TRANSAÇÃO NÃO ENCONTRADA' as issue
FROM shared_transaction_requests r
LEFT JOIN transactions t ON t.id = r.transaction_id
WHERE t.id IS NULL;

-- ==============================================================================
-- 9. RESUMO GERAL DE INTEGRIDADE
-- ==============================================================================

-- 9.1. Contagem de problemas por tipo
SELECT 
    'Transações sem ledger' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions t
LEFT JOIN ledger_entries l ON l.transaction_id = t.id
WHERE t.deleted = false
AND l.id IS NULL

UNION ALL

SELECT 
    'Splits maiores que total' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions t
WHERE t.is_shared = true
AND t.deleted = false
AND t.shared_with IS NOT NULL
AND (
    SELECT SUM((split->>'assignedAmount')::numeric)
    FROM jsonb_array_elements(t.shared_with) as split
) > t.amount + 0.01

UNION ALL

SELECT 
    'Transferências sem destino' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND (destination_account_id IS NULL OR destination_account_id = '')

UNION ALL

SELECT 
    'Transferências circulares' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND account_id = destination_account_id

UNION ALL

SELECT 
    'Contas órfãs' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions t
LEFT JOIN accounts a ON a.id = t.account_id
WHERE t.deleted = false
AND t.account_id IS NOT NULL
AND a.id IS NULL

UNION ALL

SELECT 
    'Valores inválidos' as tipo_problema,
    COUNT(*) as quantidade
FROM transactions
WHERE deleted = false
AND (amount IS NULL OR amount <= 0)

UNION ALL

SELECT 
    'Parcelas duplicadas' as tipo_problema,
    COUNT(*) as quantidade
FROM (
    SELECT series_id, current_installment
    FROM transactions
    WHERE is_installment = true
    AND deleted = false
    AND series_id IS NOT NULL
    GROUP BY series_id, current_installment
    HAVING COUNT(*) > 1
) sub

UNION ALL

SELECT 
    'Espelhos não sincronizados' as tipo_problema,
    COUNT(*) as quantidade
FROM shared_transaction_mirrors
WHERE sync_status != 'SYNCED'

UNION ALL

SELECT 
    'Solicitações expiradas' as tipo_problema,
    COUNT(*) as quantidade
FROM shared_transaction_requests
WHERE status = 'PENDING'
AND expires_at < NOW();

-- 9.2. Score de integridade geral
WITH problem_counts AS (
    SELECT 
        (SELECT COUNT(*) FROM transactions WHERE deleted = false) as total_transactions,
        (SELECT COUNT(*) FROM transactions t LEFT JOIN ledger_entries l ON l.transaction_id = t.id WHERE t.deleted = false AND l.id IS NULL) as no_ledger,
        (SELECT COUNT(*) FROM transactions t WHERE t.is_shared = true AND t.deleted = false AND t.shared_with IS NOT NULL AND (SELECT SUM((split->>'assignedAmount')::numeric) FROM jsonb_array_elements(t.shared_with) as split) > t.amount + 0.01) as bad_splits,
        (SELECT COUNT(*) FROM transactions WHERE type = 'TRANSFERÊNCIA' AND deleted = false AND (destination_account_id IS NULL OR destination_account_id = '')) as no_destination,
        (SELECT COUNT(*) FROM transactions WHERE deleted = false AND (amount IS NULL OR amount <= 0)) as invalid_amounts
)
SELECT 
    total_transactions,
    no_ledger + bad_splits + no_destination + invalid_amounts as total_problems,
    ROUND(
        (1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100,
        2
    ) as integrity_score_percent,
    CASE 
        WHEN ROUND((1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100, 2) >= 99 THEN '✅ EXCELENTE'
        WHEN ROUND((1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100, 2) >= 95 THEN '✅ BOM'
        WHEN ROUND((1 - (no_ledger + bad_splits + no_destination + invalid_amounts)::numeric / NULLIF(total_transactions, 0)) * 100, 2) >= 90 THEN '⚠️ ACEITÁVEL'
        ELSE '❌ CRÍTICO'
    END as status
FROM problem_counts;
