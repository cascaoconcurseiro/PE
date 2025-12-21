-- ==============================================================================
-- CORREÇÃO ESPECÍFICA: Seguro - Carro - PASSO 1 (DIAGNÓSTICO)
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