-- ==============================================================================
-- CORREÇÃO: Parcelas do Seguro do Carro
-- Execute APENAS após verificar o status com o script anterior
-- ==============================================================================

-- IMPORTANTE: Execute o script de verificação primeiro!
-- Este script deve ser executado APENAS se as parcelas não estiverem aparecendo

-- 1. RESTAURAR PARCELAS DELETADAS (se necessário)
-- DESCOMENTE apenas se as parcelas estiverem marcadas como deleted = true

/*
UPDATE public.transactions
SET 
    deleted = false,
    updated_at = NOW()
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
   AND deleted = true
   AND amount = 95.00;
*/

-- 2. CORRIGIR ACCOUNT_ID (se necessário)
-- DESCOMENTE apenas se as parcelas não tiverem account_id

/*
UPDATE public.transactions
SET 
    account_id = (
        SELECT id 
        FROM public.accounts 
        WHERE user_id = transactions.user_id
          AND deleted = false 
        ORDER BY 
            CASE 
                WHEN type = 'CREDIT_CARD' THEN 1
                WHEN type = 'CHECKING' THEN 2
                ELSE 3
            END
        LIMIT 1
    ),
    updated_at = NOW()
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
   AND account_id IS NULL
   AND deleted = false;
*/

-- 3. MARCAR COMO COMPARTILHADAS (se necessário)
-- DESCOMENTE apenas se as parcelas deveriam ser compartilhadas mas não estão

/*
UPDATE public.transactions
SET 
    is_shared = true,
    domain = 'SHARED',
    updated_at = NOW()
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%'
   AND amount = 95.00
   AND deleted = false
   AND is_shared = false;
*/

-- 4. CRIAR PARCELAS FALTANTES (se necessário)
-- DESCOMENTE apenas se algumas parcelas estiverem faltando

/*
-- Primeiro, identifique o user_id correto
-- Substitua 'SEU_USER_ID_AQUI' pelo user_id correto

WITH missing_installments AS (
    SELECT generate_series(1, 10) as installment_number
    EXCEPT
    SELECT current_installment
    FROM public.transactions
    WHERE LOWER(description) LIKE '%seguro%' 
       AND LOWER(description) LIKE '%carro%'
       AND deleted = false
       AND user_id = 'SEU_USER_ID_AQUI'
),
base_date AS (
    SELECT 
        MIN(date) as start_date,
        series_id
    FROM public.transactions
    WHERE LOWER(description) LIKE '%seguro%' 
       AND LOWER(description) LIKE '%carro%'
       AND deleted = false
       AND user_id = 'SEU_USER_ID_AQUI'
    GROUP BY series_id
    LIMIT 1
)
INSERT INTO public.transactions (
    user_id,
    description,
    amount,
    type,
    category,
    date,
    account_id,
    is_installment,
    current_installment,
    total_installments,
    series_id,
    is_shared,
    domain,
    currency,
    created_at,
    updated_at
)
SELECT 
    'SEU_USER_ID_AQUI',
    'Seguro - Carro (' || mi.installment_number || '/10)',
    95.00,
    'DESPESA',
    'OTHER',
    bd.start_date + INTERVAL '1 month' * (mi.installment_number - 1),
    (SELECT id FROM public.accounts WHERE user_id = 'SEU_USER_ID_AQUI' AND deleted = false LIMIT 1),
    true,
    mi.installment_number,
    10,
    bd.series_id,
    true,
    'SHARED',
    'BRL',
    NOW(),
    NOW()
FROM missing_installments mi
CROSS JOIN base_date bd;
*/

-- 5. VERIFICAÇÃO FINAL
-- Execute sempre após qualquer correção
SELECT 
    'VERIFICAÇÃO PÓS-CORREÇÃO' as status,
    COUNT(*) as total,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    COUNT(CASE WHEN is_shared = true THEN 1 END) as compartilhadas,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta,
    MIN(current_installment) as primeira,
    MAX(current_installment) as ultima,
    SUM(CASE WHEN deleted = false THEN amount ELSE 0 END) as valor_total
FROM public.transactions
WHERE LOWER(description) LIKE '%seguro%' 
   AND LOWER(description) LIKE '%carro%';

-- INSTRUÇÕES:
-- 1. Execute primeiro o script de verificação
-- 2. Analise os resultados
-- 3. Descomente apenas as seções necessárias acima
-- 4. Execute uma seção por vez
-- 5. Verifique os resultados após cada execução