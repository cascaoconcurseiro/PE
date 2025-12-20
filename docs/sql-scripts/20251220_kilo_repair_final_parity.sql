-- ==============================================================================
-- KILO REPAIR: SURGICAL JANUARY PARITY (10 vs 10)
-- DATA: 2025-12-20
-- OBJETIVO: 
--   1. Resolver colisão de valores (120 e 125) que bloqueou o espelhamento automático.
--   2. Inserir manualmente Geladeira (1/19) e Carro - ar (1/3) para Fran.
--   3. Garantir paridade total em Janeiro.
-- ==============================================================================

BEGIN;

-- IDs das transações originais do Wesley que estão sem espelho para a Fran
-- Geladeira (1/19): 9b076aa5-eb2f-41c3-9f66-bede6ba14ebd
-- Carro - ar (1/3): 6a6029d7-21b3-471d-b89d-444825474921

-- 1. LIMPEZA PREVENTIVA
-- Remove qualquer rastro de tentativa falha que possa existir (embora o count mostre que não há)
DELETE FROM public.transactions 
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' 
  AND source_transaction_id IN ('9b076aa5-eb2f-41c3-9f66-bede6ba14ebd', '6a6029d7-21b3-471d-b89d-444825474921');

-- 2. INSERÇÃO CIRÚRGICA DE "CARRO - AR (1/3)"
INSERT INTO public.transactions (
    user_id, amount, date, description, category, type, domain,
    is_shared, payer_id, source_transaction_id, currency,
    is_installment, current_installment, total_installments, series_id,
    created_at, updated_at
) 
SELECT 
    '291732a3-1f5a-4cf9-9d17-55beeefc40f6', -- Fran
    (split.value->>'assignedAmount')::NUMERIC,
    t.date,
    t.description || ' (Wesley)',
    t.category,
    'DESPESA',
    'SHARED',
    true,
    'd7f294f7-8651-47f1-844b-9e04fbca0ea5', -- Wesley é o pagador
    t.id,
    t.currency,
    t.is_installment, t.current_installment, t.total_installments, t.series_id,
    NOW(), NOW()
FROM public.transactions t, jsonb_array_elements(t.shared_with) split
WHERE t.id = '6a6029d7-21b3-471d-b89d-444825474921'
  AND (split.value->>'memberId')::UUID = 'fa06c3b4-debf-4911-b14f-b559c434092e';

-- 3. INSERÇÃO CIRÚRGICA DE "GELADEIRA (1/19)"
INSERT INTO public.transactions (
    user_id, amount, date, description, category, type, domain,
    is_shared, payer_id, source_transaction_id, currency,
    is_installment, current_installment, total_installments, series_id,
    created_at, updated_at
) 
SELECT 
    '291732a3-1f5a-4cf9-9d17-55beeefc40f6', -- Fran
    (split.value->>'assignedAmount')::NUMERIC,
    t.date,
    t.description || ' (Wesley)',
    t.category,
    'DESPESA',
    'SHARED',
    true,
    'd7f294f7-8651-47f1-844b-9e04fbca0ea5', -- Wesley é o pagador
    t.id,
    t.currency,
    t.is_installment, t.current_installment, t.total_installments, t.series_id,
    NOW(), NOW()
FROM public.transactions t, jsonb_array_elements(t.shared_with) split
WHERE t.id = '9b076aa5-eb2f-41c3-9f66-bede6ba14ebd'
  AND (split.value->>'memberId')::UUID = 'fa06c3b4-debf-4911-b14f-b559c434092e';

COMMIT;

-- VERIFICAÇÃO FINAL DE JANEIRO 2026
SELECT 
    'Usuário A (Wesley)' as usuario,
    count(*) as total_jan
FROM public.transactions 
WHERE user_id = 'd7f294f7-8651-47f1-844b-9e04fbca0ea5' 
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false
UNION ALL
SELECT 
    'Usuário B (Fran)' as usuario,
    count(*) as total_jan
FROM public.transactions 
WHERE user_id = '291732a3-1f5a-4cf9-9d17-55beeefc40f6' 
  AND date >= '2026-01-01' AND date <= '2026-01-31'
  AND deleted = false;
