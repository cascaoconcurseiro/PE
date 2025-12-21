-- ==============================================================================
-- INVESTIGAÇÃO COMPLETA: Seguro - Carro
-- DATA: 2025-12-21
-- OBJETIVO: Entender a estrutura dos dados e identificar o problema
-- ==============================================================================

-- PASSO 1: Ver todas as parcelas de "Seguro - Carro" com detalhes
SELECT 
    'PASSO 1: TODAS AS PARCELAS' as investigacao,
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
    'PASSO 2: CONTAGEM POR USUÁRIO' as investigacao,
    user_id,
    COUNT(*) as total_parcelas,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas,
    COUNT(CASE WHEN deleted = true THEN 1 END) as parcelas_deletadas,
    MIN(current_installment) as primeira_parcela,
    MAX(current_installment) as ultima_parcela,
    STRING_AGG(DISTINCT current_installment::TEXT, ', ' ORDER BY current_installment::TEXT) as parcelas_existentes
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY user_id
ORDER BY total_parcelas DESC;

-- PASSO 3: Ver contas relacionadas
SELECT 
    'PASSO 3: CONTAS RELACIONADAS' as investigacao,
    t.account_id,
    a.user_id as dono_da_conta,
    a.name as nome_conta,
    a.type as tipo_conta,
    a.deleted as conta_deletada,
    COUNT(t.id) as parcelas_nesta_conta,
    COUNT(CASE WHEN t.deleted = false THEN 1 END) as parcelas_ativas_conta,
    COUNT(CASE WHEN t.deleted = true THEN 1 END) as parcelas_deletadas_conta
FROM public.transactions t
LEFT JOIN public.accounts a ON t.account_id = a.id
WHERE t.description LIKE '%Seguro - Carro%'
  AND t.is_installment = true
GROUP BY t.account_id, a.user_id, a.name, a.type, a.deleted
ORDER BY parcelas_nesta_conta DESC;

-- PASSO 4: Análise detalhada por parcela
SELECT 
    'PASSO 4: ANÁLISE DETALHADA' as investigacao,
    current_installment,
    COUNT(*) as quantidade_registros,
    COUNT(DISTINCT user_id) as usuarios_diferentes,
    COUNT(DISTINCT account_id) as contas_diferentes,
    COUNT(CASE WHEN deleted = false THEN 1 END) as registros_ativos,
    COUNT(CASE WHEN deleted = true THEN 1 END) as registros_deletados,
    STRING_AGG(DISTINCT user_id::TEXT, ', ') as user_ids,
    STRING_AGG(DISTINCT account_id::TEXT, ', ') as account_ids
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY current_installment
ORDER BY current_installment;

-- PASSO 5: Identificar qual usuário deveria ser o dono
SELECT 
    'PASSO 5: IDENTIFICAR DONO CORRETO' as investigacao,
    a.user_id as possivel_dono,
    a.name as nome_conta,
    a.type as tipo_conta,
    COUNT(t.id) as total_parcelas_na_conta,
    COUNT(CASE WHEN t.deleted = false THEN 1 END) as parcelas_ativas,
    COUNT(CASE WHEN t.user_id = a.user_id THEN 1 END) as parcelas_com_user_id_correto,
    COUNT(CASE WHEN t.user_id != a.user_id THEN 1 END) as parcelas_com_user_id_incorreto
FROM public.accounts a
JOIN public.transactions t ON t.account_id = a.id
WHERE t.description LIKE '%Seguro - Carro%'
  AND t.is_installment = true
  AND a.deleted = false
GROUP BY a.user_id, a.name, a.type
ORDER BY total_parcelas_na_conta DESC;

-- PASSO 6: Verificar se há duplicatas exatas
SELECT 
    'PASSO 6: VERIFICAR DUPLICATAS' as investigacao,
    description,
    current_installment,
    total_installments,
    amount,
    date,
    COUNT(*) as quantidade_duplicatas,
    STRING_AGG(DISTINCT user_id::TEXT, ', ') as user_ids_diferentes,
    STRING_AGG(DISTINCT account_id::TEXT, ', ') as account_ids_diferentes,
    STRING_AGG(DISTINCT deleted::TEXT, ', ') as status_deleted_diferentes
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY description, current_installment, total_installments, amount, date
HAVING COUNT(*) > 1
ORDER BY current_installment;