-- ==============================================================================
-- BUSCAR PARCELAS: Script Simples para Copiar e Colar
-- ==============================================================================

-- PASSO 1: Ver todas as parcelas dos últimos 7 dias
SELECT 
    description,
    COUNT(*) as quantidade,
    MIN(current_installment) as primeira,
    MAX(current_installment) as ultima,
    MAX(total_installments) as total_esperado
FROM public.transactions
WHERE is_installment = true
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY description
ORDER BY quantidade DESC;