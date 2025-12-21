-- ==============================================================================
-- CORREÇÃO ESPECÍFICA: Seguro - Carro
-- DATA: 2025-12-21
-- PROBLEMA: 50 parcelas duplicadas, todas deletadas, sem account_id
-- ==============================================================================

-- PASSO 1: Ver o problema atual
SELECT 
    'ANTES DA CORREÇÃO' as status,
    user_id,
    COUNT(*) as total_parcelas,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY user_id;

-- PASSO 2: Identificar parcelas únicas (sem duplicatas)
-- Vamos manter apenas 1 parcela de cada número para o usuário correto
WITH parcelas_unicas AS (
    SELECT 
        current_installment,
        MIN(id) as id_para_manter,
        COUNT(*) as duplicatas
    FROM public.transactions
    WHERE description LIKE '%Seguro - Carro%'
      AND is_installment = true
      AND user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'  -- Usuário principal
    GROUP BY current_installment
)
SELECT 
    'PARCELAS ÚNICAS IDENTIFICADAS' as status,
    current_installment,
    id_para_manter,
    duplicatas
FROM parcelas_unicas
ORDER BY current_installment;

-- PASSO 3: DELETAR DUPLICATAS (EXECUTE COM CUIDADO!)
-- DESCOMENTE APENAS APÓS CONFIRMAR OS RESULTADOS ACIMA

/*
-- Deletar todas as parcelas do Wesley (são duplicatas)
DELETE FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
  AND user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6';  -- Wesley

-- Deletar duplicatas do usuário principal, mantendo apenas 1 de cada
WITH parcelas_para_deletar AS (
    SELECT id
    FROM (
        SELECT 
            id,
            ROW_NUMBER() OVER (PARTITION BY current_installment ORDER BY created_at) as rn
        FROM public.transactions
        WHERE description LIKE '%Seguro - Carro%'
          AND is_installment = true
          AND user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'
    ) ranked
    WHERE rn > 1  -- Manter apenas a primeira (rn = 1)
)
DELETE FROM public.transactions
WHERE id IN (SELECT id FROM parcelas_para_deletar);
*/

-- PASSO 4: RESTAURAR E CORRIGIR AS PARCELAS RESTANTES
-- DESCOMENTE APÓS EXECUTAR O PASSO 3

/*
-- Restaurar parcelas (deleted = false) e adicionar account_id
UPDATE public.transactions
SET 
    deleted = false,
    account_id = (
        SELECT id 
        FROM public.accounts 
        WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5' 
          AND type = 'CREDIT_CARD' 
          AND deleted = false 
        LIMIT 1
    ),
    updated_at = NOW()
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
  AND user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5';
*/

-- PASSO 5: Verificar resultado final
SELECT 
    'APÓS CORREÇÃO' as status,
    user_id,
    COUNT(*) as total_parcelas,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta,
    MIN(current_installment) as primeira,
    MAX(current_installment) as ultima
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY user_id;