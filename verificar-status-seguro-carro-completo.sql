-- ==============================================================================
-- VERIFICAÇÃO COMPLETA: Status das Parcelas do Seguro do Carro
-- Execute este SQL no Supabase para verificar o estado atual
-- ==============================================================================

-- 1. DIAGNÓSTICO GERAL
SELECT 
    '=== DIAGNÓSTICO GERAL ===' as secao,
    COUNT(*) as total_transacoes,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    COUNT(CASE WHEN deleted = true THEN 1 END) as deletadas,
    COUNT(CASE WHEN is_shared = true THEN 1 END) as compartilhadas,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta,
    COUNT(CASE WHEN amount = 95.00 THEN 1 END) as valor_95_reais
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%';

-- 2. DETALHAMENTO POR USUÁRIO
SELECT 
    '=== POR USUÁRIO ===' as secao,
    user_id,
    COUNT(*) as total,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    COUNT(CASE WHEN is_shared = true THEN 1 END) as compartilhadas,
    MIN(current_installment) as primeira_parcela,
    MAX(current_installment) as ultima_parcela,
    MAX(total_installments) as total_esperado,
    MIN(date) as data_inicio,
    MAX(date) as data_fim
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
GROUP BY user_id
ORDER BY total DESC;

-- 3. SÉRIES DE PARCELAS
SELECT 
    '=== SÉRIES DE PARCELAS ===' as secao,
    series_id,
    COUNT(*) as parcelas_na_serie,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    MIN(current_installment) as primeira,
    MAX(current_installment) as ultima,
    MAX(total_installments) as total_esperado,
    SUM(amount) as valor_total,
    MIN(date) as inicio,
    MAX(date) as fim
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
   AND series_id IS NOT NULL
GROUP BY series_id
ORDER BY inicio DESC;

-- 4. PARCELAS ATIVAS DETALHADAS
SELECT 
    '=== PARCELAS ATIVAS ===' as secao,
    id,
    description,
    amount,
    date,
    current_installment,
    total_installments,
    is_shared,
    shared_with,
    account_id,
    domain,
    created_at
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
   AND deleted = false
ORDER BY date ASC, current_installment ASC;

-- 5. TRANSAÇÕES COMPARTILHADAS
SELECT 
    '=== COMPARTILHADAS ===' as secao,
    id,
    description,
    amount,
    date,
    is_shared,
    shared_with,
    payer_id,
    domain,
    current_installment,
    total_installments
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
   AND is_shared = true
   AND deleted = false
ORDER BY date ASC;

-- 6. SOLICITAÇÕES DE COMPARTILHAMENTO
SELECT 
    '=== SOLICITAÇÕES PENDENTES ===' as secao,
    str.id,
    str.transaction_id,
    str.invited_email,
    str.assigned_amount,
    str.status,
    str.created_at,
    t.description,
    t.amount,
    t.date
FROM public.shared_transaction_requests str
JOIN public.transactions t ON t.id = str.transaction_id
WHERE LOWER(t.description) LIKE '%seguro%' 
   AND LOWER(t.description) LIKE '%carro%'
ORDER BY str.created_at DESC;

-- 7. VERIFICAR PARCELAS FALTANTES (se deveria ter 10 parcelas)
WITH expected_installments AS (
    SELECT generate_series(1, 10) as installment_number
),
existing_installments AS (
    SELECT DISTINCT current_installment
    FROM public.transactions
    WHERE LOWER(description) LIKE '%seguro%' 
       AND LOWER(description) LIKE '%carro%'
       AND deleted = false
       AND current_installment IS NOT NULL
)
SELECT 
    '=== PARCELAS FALTANTES ===' as secao,
    ei.installment_number as parcela_faltante
FROM expected_installments ei
LEFT JOIN existing_installments ex ON ei.installment_number = ex.current_installment
WHERE ex.current_installment IS NULL
ORDER BY ei.installment_number;

-- 8. RESUMO FINAL
SELECT 
    '=== RESUMO FINAL ===' as secao,
    CASE 
        WHEN COUNT(CASE WHEN deleted = false THEN 1 END) = 0 THEN 'NENHUMA PARCELA ATIVA'
        WHEN COUNT(CASE WHEN deleted = false THEN 1 END) < 10 THEN 'PARCELAS INCOMPLETAS'
        WHEN COUNT(CASE WHEN deleted = false THEN 1 END) = 10 THEN 'SÉRIE COMPLETA'
        ELSE 'PARCELAS DUPLICADAS'
    END as status,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas,
    COUNT(CASE WHEN is_shared = true AND deleted = false THEN 1 END) as compartilhadas_ativas,
    SUM(CASE WHEN deleted = false THEN amount ELSE 0 END) as valor_total_ativo
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%';