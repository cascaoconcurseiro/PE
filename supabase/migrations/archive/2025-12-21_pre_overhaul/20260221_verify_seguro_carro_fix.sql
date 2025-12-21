-- ==============================================================================
-- VERIFICAÇÃO: Seguro - Carro Fix
-- ==============================================================================

-- Verificar estado final das parcelas
SELECT 
    'ESTADO FINAL' as status,
    user_id,
    COUNT(*) as total_parcelas,
    COUNT(CASE WHEN deleted = false THEN 1 END) as parcelas_ativas,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta,
    MIN(current_installment) as primeira_parcela,
    MAX(current_installment) as ultima_parcela,
    STRING_AGG(current_installment::text, ',' ORDER BY current_installment) as parcelas_numeradas
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY user_id
ORDER BY total_parcelas DESC;

-- Verificar se todas as 10 parcelas estão presentes e ativas
SELECT 
    'VERIFICAÇÃO PARCELAS 1-10' as status,
    current_installment,
    COUNT(*) as quantidade,
    COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
    COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta
FROM public.transactions
WHERE description LIKE '%Seguro - Carro%'
  AND is_installment = true
GROUP BY current_installment
ORDER BY current_installment;