-- Script de debug para verificar as transações compartilhadas

-- 1. Ver todas as transações do Seguro - Carro
SELECT 
    id,
    user_id,
    description,
    amount,
    date,
    payer_id,
    shared_with::text as shared_with_json,
    is_shared,
    current_installment,
    total_installments,
    domain,
    deleted,
    created_at
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
ORDER BY current_installment;

-- 2. Ver estrutura do shared_with em formato legível
SELECT 
    description,
    current_installment,
    payer_id,
    jsonb_pretty(shared_with) as shared_with_formatted
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
  AND deleted = false
ORDER BY current_installment
LIMIT 3;

-- 3. Verificar se o user_id está no shared_with
SELECT 
    description,
    current_installment,
    user_id,
    payer_id,
    (shared_with->0->>'memberId') as member_id_in_split,
    (shared_with->0->>'assignedAmount')::numeric as assigned_amount,
    CASE 
        WHEN user_id::text = (shared_with->0->>'memberId') THEN 'MATCH ✅'
        ELSE 'NO MATCH ❌'
    END as user_match
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
  AND deleted = false
ORDER BY current_installment
LIMIT 3;

-- 4. Ver membros da família para comparar IDs
SELECT 
    id as member_id,
    name,
    linked_user_id,
    email
FROM family_members
ORDER BY name;