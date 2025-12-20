-- ==============================================================================
-- VERIFICAÇÃO: CORREÇÕES DE COMPARTILHAMENTO
-- DATA: 2025-12-19
-- ==============================================================================

-- 1. Verificar se tabela user_notifications existe
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'user_notifications'
) as notifications_table_exists;

-- 2. Verificar transações compartilhadas
SELECT 'Transações compartilhadas' as tipo, COUNT(*) as total
FROM public.transactions
WHERE is_shared = true AND deleted = false;

-- 3. Verificar mirrors criados (transações com source_transaction_id)
SELECT 'Mirrors (source_transaction_id)' as tipo, COUNT(*) as total
FROM public.transactions
WHERE source_transaction_id IS NOT NULL AND deleted = false;

-- 4. Verificar mirrors criados (transações com payer_id de outro usuário)
SELECT 'Mirrors (payer_id != me)' as tipo, COUNT(*) as total
FROM public.transactions
WHERE payer_id IS NOT NULL 
  AND payer_id != 'me'
  AND deleted = false;

-- 5. Verificar transações do Seguro - carro especificamente
SELECT 
    id,
    description,
    amount,
    date,
    user_id,
    payer_id,
    source_transaction_id,
    is_shared
FROM public.transactions
WHERE description LIKE '%Seguro - carro%'
  AND deleted = false
ORDER BY date, user_id;

-- 6. Verificar se a função sync_shared_transaction existe e está correta
SELECT routine_name, routine_type
FROM information_schema.routines 
WHERE routine_name = 'sync_shared_transaction'
  AND routine_schema = 'public';

-- 7. Testar sync manualmente em uma transação
DO $$
DECLARE
    v_tx_id UUID;
BEGIN
    -- Pegar uma transação compartilhada
    SELECT id INTO v_tx_id
    FROM public.transactions
    WHERE is_shared = true
      AND deleted = false
      AND shared_with IS NOT NULL
      AND jsonb_array_length(shared_with) > 0
    LIMIT 1;
    
    IF v_tx_id IS NOT NULL THEN
        RAISE NOTICE 'Testando sync para transação: %', v_tx_id;
        PERFORM public.sync_shared_transaction(v_tx_id);
        RAISE NOTICE 'Sync executado com sucesso!';
    ELSE
        RAISE NOTICE 'Nenhuma transação compartilhada encontrada para teste';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERRO no sync: %', SQLERRM;
END $$;
