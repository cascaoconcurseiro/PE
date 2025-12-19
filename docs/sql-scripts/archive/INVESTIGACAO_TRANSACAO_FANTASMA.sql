-- ========================================
-- SCRIPT DE INVESTIGAÇÃO - TRANSAÇÃO FANTASMA
-- ========================================
-- Execute no Supabase Dashboard > SQL Editor
-- Para investigar a transação de R$ 100,00
-- ========================================

-- 1. BUSCAR TRANSAÇÕES DE R$ 100,00
-- ========================================
SELECT 
    id,
    description,
    amount,
    date,
    type,
    account_id,
    destination_account_id,
    deleted,
    created_at,
    updated_at
FROM public.transactions
WHERE amount = 100.00
ORDER BY created_at DESC;

-- 2. BUSCAR TRANSAÇÕES DELETADAS DE R$ 100,00
-- ========================================
SELECT 
    id,
    description,
    amount,
    date,
    type,
    account_id,
    destination_account_id,
    deleted,
    created_at,
    updated_at
FROM public.transactions
WHERE amount = 100.00
  AND deleted = true
ORDER BY updated_at DESC;

-- 3. BUSCAR TRANSAÇÕES ÓRFÃS (SEM CONTA)
-- ========================================
SELECT 
    t.id,
    t.description,
    t.amount,
    t.date,
    t.type,
    t.account_id,
    t.destination_account_id,
    t.deleted,
    a.name as account_name
FROM public.transactions t
LEFT JOIN public.accounts a ON t.account_id = a.id
WHERE t.deleted = false
  AND a.id IS NULL
ORDER BY t.created_at DESC;

-- 4. BUSCAR DUPLICATAS
-- ========================================
SELECT 
    description,
    amount,
    date,
    type,
    COUNT(*) as count,
    STRING_AGG(id::text, ', ') as transaction_ids
FROM public.transactions
WHERE deleted = false
GROUP BY description, amount, date, type
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- 5. BUSCAR TRANSFERÊNCIAS CIRCULARES
-- ========================================
SELECT 
    t1.id as tx1_id,
    t1.description as tx1_desc,
    t1.amount as tx1_amount,
    t1.account_id as tx1_from,
    t1.destination_account_id as tx1_to,
    t2.id as tx2_id,
    t2.description as tx2_desc,
    t2.amount as tx2_amount,
    t2.account_id as tx2_from,
    t2.destination_account_id as tx2_to
FROM public.transactions t1
JOIN public.transactions t2 
    ON t1.account_id = t2.destination_account_id 
    AND t1.destination_account_id = t2.account_id
WHERE t1.deleted = false 
  AND t2.deleted = false
  AND t1.type = 'TRANSFER'
  AND t2.type = 'TRANSFER'
  AND t1.id < t2.id;

-- 6. BUSCAR TRANSAÇÕES SEM CONTA DESTINO (TRANSFERÊNCIAS)
-- ========================================
SELECT 
    id,
    description,
    amount,
    date,
    account_id,
    destination_account_id,
    deleted
FROM public.transactions
WHERE type = 'TRANSFER'
  AND deleted = false
  AND (destination_account_id IS NULL OR destination_account_id = '');

-- 7. VERIFICAR CONTAS DELETADAS COM TRANSAÇÕES ATIVAS
-- ========================================
SELECT 
    a.id as account_id,
    a.name as account_name,
    a.deleted as account_deleted,
    COUNT(t.id) as active_transactions
FROM public.accounts a
LEFT JOIN public.transactions t ON (t.account_id = a.id OR t.destination_account_id = a.id)
WHERE a.deleted = true
  AND t.deleted = false
GROUP BY a.id, a.name, a.deleted
HAVING COUNT(t.id) > 0;

-- 8. VERIFICAR SALDO TOTAL DO SISTEMA
-- ========================================
SELECT 
    SUM(CASE 
        WHEN type = 'INCOME' THEN amount
        WHEN type = 'EXPENSE' THEN -amount
        WHEN type = 'TRANSFER' THEN 0
        ELSE 0
    END) as saldo_calculado,
    COUNT(*) as total_transacoes,
    COUNT(CASE WHEN deleted = true THEN 1 END) as transacoes_deletadas,
    COUNT(CASE WHEN deleted = false THEN 1 END) as transacoes_ativas
FROM public.transactions;

-- 9. VERIFICAR TRANSAÇÕES POR TIPO
-- ========================================
SELECT 
    type,
    COUNT(*) as count,
    SUM(amount) as total_amount,
    COUNT(CASE WHEN deleted = true THEN 1 END) as deleted_count,
    COUNT(CASE WHEN deleted = false THEN 1 END) as active_count
FROM public.transactions
GROUP BY type
ORDER BY type;

-- 10. BUSCAR TRANSAÇÕES RECENTES (ÚLTIMAS 50)
-- ========================================
SELECT 
    id,
    description,
    amount,
    date,
    type,
    account_id,
    destination_account_id,
    deleted,
    created_at,
    updated_at
FROM public.transactions
ORDER BY created_at DESC
LIMIT 50;

-- ========================================
-- MENSAGEM FINAL
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '✅ INVESTIGAÇÃO COMPLETA!';
    RAISE NOTICE '';
    RAISE NOTICE 'Analise os resultados acima para identificar:';
    RAISE NOTICE '1. Transações de R$ 100,00';
    RAISE NOTICE '2. Transações deletadas que ainda aparecem';
    RAISE NOTICE '3. Transações órfãs (sem conta)';
    RAISE NOTICE '4. Duplicatas';
    RAISE NOTICE '5. Transferências circulares';
    RAISE NOTICE '6. Transferências sem destino';
    RAISE NOTICE '7. Contas deletadas com transações ativas';
    RAISE NOTICE '8. Saldo total do sistema';
END $$;
