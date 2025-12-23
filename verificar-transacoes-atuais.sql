-- Script para verificar as transações atuais do Seguro - Carro

-- 1. Ver TODAS as transações (incluindo deletadas)
SELECT 
    id,
    user_id,
    description,
    amount,
    date,
    payer_id,
    is_shared,
    deleted,
    current_installment,
    total_installments,
    created_at
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
ORDER BY current_installment;

-- 2. Ver apenas as NÃO deletadas
SELECT 
    id,
    description,
    amount,
    date,
    payer_id,
    jsonb_pretty(shared_with) as shared_with,
    current_installment,
    total_installments
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
  AND deleted = false
ORDER BY current_installment;

-- 3. Verificar se o payer_id está correto
SELECT 
    description,
    current_installment,
    payer_id,
    CASE 
        WHEN payer_id = 'me' THEN '✅ EU PAGUEI (correto)'
        WHEN payer_id IS NULL THEN '❌ NULL (erro)'
        ELSE '❌ OUTRO PAGOU (invertido)'
    END as payer_status,
    (shared_with->0->>'memberId') as debtor_member_id,
    (shared_with->0->>'assignedAmount')::numeric as debtor_amount
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
  AND deleted = false
ORDER BY current_installment
LIMIT 3;

-- 4. Ver membros da família para comparar
SELECT 
    id,
    name,
    linked_user_id,
    email
FROM family_members
ORDER BY name;

-- 5. Contar quantas transações existem
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE deleted = false) as ativas,
    COUNT(*) FILTER (WHERE deleted = true) as deletadas
FROM transactions
WHERE description LIKE 'Seguro - Carro%';