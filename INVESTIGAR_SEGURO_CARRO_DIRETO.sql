-- ==============================================================================
-- INVESTIGAÇÃO DIRETA: Seguro - Carro
-- ==============================================================================

-- PASSO 1: Ver todas as parcelas de "Seguro - Carro" com detalhes
SELECT 
    id,
    description,
    current_installment,
    total_installments,
    user_id,
    account_id,
    deleted,
    amount,
    date,
    created_at
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
ORDER BY current_installment, user_id;

-- PASSO 2: Contar por usuário
SELECT 
    user_id,
    COUNT(*) as total_parcelas,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas,
    MIN(current_installment) as primeira_parcela,
    MAX(current_installment) as ultima_parcela
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY user_id
ORDER BY total_parcelas DESC;

-- PASSO 3: Ver contas relacionadas
SELECT DISTINCT
    t.account_id,
    a.user_id as dono_da_conta,
    a.name as nome_conta,
    a.type as tipo_conta,
    a.deleted as conta_deletada,
    COUNT(t.id) as parcelas_nesta_conta
FROM public.transactions t
LEFT JOIN public.accounts a ON t.account_id = a.id
WHERE t.description LIKE '%Seguro - Carro%'
  AND t.is_installment = true
GROUP BY t.account_id, a.user_id, a.name, a.type, a.deleted
ORDER BY parcelas_nesta_conta DESC;