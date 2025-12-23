-- Execute este SQL no Supabase SQL Editor AGORA

-- 1. Contar transações do Seguro - Carro
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE deleted = false) as ativas,
    COUNT(*) FILTER (WHERE deleted = true) as deletadas
FROM transactions
WHERE description LIKE 'Seguro - Carro%';

-- 2. Ver as 3 primeiras transações
SELECT 
    id,
    description,
    amount,
    date,
    payer_id,
    is_shared,
    jsonb_pretty(shared_with) as shared_with,
    current_installment,
    total_installments,
    deleted
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
ORDER BY current_installment
LIMIT 3;

-- 3. Verificar se payer_id está correto
SELECT 
    current_installment,
    payer_id,
    CASE 
        WHEN payer_id = 'me' THEN '✅ CORRETO'
        WHEN payer_id IS NULL THEN '❌ NULL'
        ELSE '❌ ERRADO: ' || payer_id
    END as status,
    (shared_with->0->>'memberId') as debtor_id,
    (shared_with->0->>'assignedAmount')::numeric as amount
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
  AND deleted = false
ORDER BY current_installment
LIMIT 3;