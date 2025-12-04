-- ========================================
-- CONSTRAINTS DE VALIDAÇÃO ADICIONAIS
-- ========================================
-- Execute no Supabase SQL Editor
-- ========================================

BEGIN;

-- 1. CONSTRAINT: Transferências não podem ser circulares (origem = destino)
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF NOT EXISTS check_transfer_not_circular;
ALTER TABLE public.transactions ADD CONSTRAINT check_transfer_not_circular
CHECK (
    type != 'TRANSFERÊNCIA' OR 
    account_id IS DISTINCT FROM destination_account_id
);

-- 2. CONSTRAINT: Valor sempre positivo
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_amount_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_amount_positive
CHECK (amount > 0);

-- 3. CONSTRAINT: Destination amount positivo (se existir)
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_destination_amount_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_destination_amount_positive
CHECK (destination_amount IS NULL OR destination_amount > 0);

-- 4. CONSTRAINT: Exchange rate positivo (se existir)
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_exchange_rate_positive;
ALTER TABLE public.transactions ADD CONSTRAINT check_exchange_rate_positive
CHECK (exchange_rate IS NULL OR exchange_rate > 0);

-- 5. CONSTRAINT: Transferências devem ter conta de destino
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_transfer_has_destination;
ALTER TABLE public.transactions ADD CONSTRAINT check_transfer_has_destination
CHECK (
    type != 'TRANSFERÊNCIA' OR 
    (destination_account_id IS NOT NULL AND destination_account_id != '')
);

-- 6. CONSTRAINT: Despesas devem ter conta (exceto se outra pessoa pagou)
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_expense_has_account;
ALTER TABLE public.transactions ADD CONSTRAINT check_expense_has_account
CHECK (
    type != 'DESPESA' OR 
    (payer_id IS NOT NULL AND payer_id != 'me') OR
    (account_id IS NOT NULL AND account_id != '' AND account_id != 'EXTERNAL')
);

-- 7. CONSTRAINT: Receitas devem ter conta
-- ========================================
ALTER TABLE public.transactions DROP CONSTRAINT IF EXISTS check_income_has_account;
ALTER TABLE public.transactions ADD CONSTRAINT check_income_has_account
CHECK (
    type != 'RECEITA' OR 
    (account_id IS NOT NULL AND account_id != '' AND account_id != 'EXTERNAL')
);

COMMIT;

-- ========================================
-- VERIFICAR CONSTRAINTS CRIADAS
-- ========================================
SELECT 
    conname as constraint_name,
    contype as constraint_type,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.transactions'::regclass
  AND conname LIKE 'check_%'
ORDER BY conname;

-- ========================================
-- MENSAGEM FINAL
-- ========================================
DO $$
BEGIN
    RAISE NOTICE '✅ CONSTRAINTS DE VALIDAÇÃO APLICADAS!';
    RAISE NOTICE '';
    RAISE NOTICE 'Constraints criadas:';
    RAISE NOTICE '1. check_transfer_not_circular - Bloqueia transferências circulares';
    RAISE NOTICE '2. check_amount_positive - Valor sempre > 0';
    RAISE NOTICE '3. check_destination_amount_positive - Destination amount > 0';
    RAISE NOTICE '4. check_exchange_rate_positive - Exchange rate > 0';
    RAISE NOTICE '5. check_transfer_has_destination - Transferências têm destino';
    RAISE NOTICE '6. check_expense_has_account - Despesas têm conta';
    RAISE NOTICE '7. check_income_has_account - Receitas têm conta';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ Agora o banco bloqueia dados inválidos!';
END $$;
