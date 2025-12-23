-- Script para deletar as parcelas do Seguro - Carro com lógica invertida
-- Execute este script no Supabase SQL Editor antes de importar novamente

-- 1. Verificar as transações que serão deletadas
SELECT 
    id,
    description,
    amount,
    date,
    payer_id,
    shared_with,
    current_installment,
    total_installments,
    created_at
FROM transactions
WHERE description LIKE 'Seguro - Carro%'
  AND deleted = false
ORDER BY current_installment;

-- 2. Fazer soft delete (marcar como deletadas)
-- DESCOMENTE a linha abaixo para executar:
-- UPDATE transactions SET deleted = true, updated_at = NOW() WHERE description LIKE 'Seguro - Carro%' AND deleted = false;

-- 3. OU fazer hard delete (remover permanentemente)
-- DESCOMENTE a linha abaixo para executar:
-- DELETE FROM transactions WHERE description LIKE 'Seguro - Carro%' AND deleted = false;

-- INSTRUÇÕES:
-- 1. Execute primeiro o SELECT para ver as transações
-- 2. Verifique se são as corretas
-- 3. Descomente uma das opções (UPDATE para soft delete OU DELETE para hard delete)
-- 4. Execute novamente
-- 5. Volte para o app e importe as parcelas novamente