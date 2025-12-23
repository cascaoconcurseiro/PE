-- Verificar transações do seguro do carro
-- Buscar por "seguro" e "carro" na descrição

-- 1. Buscar todas as transações relacionadas a seguro de carro
SELECT 
    id,
    description,
    amount,
    date,
    is_shared,
    shared_with,
    current_installment,
    total_installments,
    series_id,
    domain,
    deleted,
    created_at
FROM transactions 
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
ORDER BY created_at DESC, current_installment ASC;

-- 2. Verificar se há parcelas de R$ 95,00
SELECT 
    id,
    description,
    amount,
    date,
    is_shared,
    current_installment,
    total_installments,
    series_id,
    deleted
FROM transactions 
WHERE amount = 95.00
   AND (LOWER(description) LIKE '%seguro%' OR LOWER(description) LIKE '%carro%')
ORDER BY date DESC, current_installment ASC;

-- 3. Verificar séries de 10 parcelas
SELECT 
    series_id,
    COUNT(*) as total_parcelas,
    MIN(current_installment) as primeira_parcela,
    MAX(current_installment) as ultima_parcela,
    SUM(amount) as valor_total,
    MIN(date) as data_inicio,
    MAX(date) as data_fim,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas
FROM transactions 
WHERE total_installments = 10
   AND (LOWER(description) LIKE '%seguro%' OR LOWER(description) LIKE '%carro%')
GROUP BY series_id
ORDER BY data_inicio DESC;

-- 4. Verificar transações compartilhadas relacionadas
SELECT 
    id,
    description,
    amount,
    date,
    is_shared,
    shared_with,
    payer_id,
    domain,
    deleted
FROM transactions 
WHERE is_shared = true
   AND (LOWER(description) LIKE '%seguro%' OR LOWER(description) LIKE '%carro%')
ORDER BY created_at DESC;

-- 5. Verificar solicitações de compartilhamento pendentes
SELECT 
    str.id,
    str.transaction_id,
    str.invited_email,
    str.assigned_amount,
    str.status,
    str.created_at,
    t.description,
    t.amount
FROM shared_transaction_requests str
JOIN transactions t ON t.id = str.transaction_id
WHERE LOWER(t.description) LIKE '%seguro%' 
   AND LOWER(t.description) LIKE '%carro%'
ORDER BY str.created_at DESC;