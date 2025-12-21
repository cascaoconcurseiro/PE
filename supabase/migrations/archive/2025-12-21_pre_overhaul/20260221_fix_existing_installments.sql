-- ==============================================================================
-- MIGRATION: CORRIGIR PARCELAS EXISTENTES COM USER_ID INCORRETO
-- DATA: 2025-12-21
-- OBJETIVO: Corrigir transações já importadas que têm user_id do importador
--           em vez do user_id do dono da conta
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: IDENTIFICAR E CORRIGIR TRANSAÇÕES COM USER_ID INCORRETO
-- ==============================================================================

-- Esta query corrige transações onde:
-- 1. A transação tem um account_id
-- 2. O user_id da transação é diferente do user_id do dono da conta
-- 3. A transação é uma parcela (is_installment = true) ou foi criada recentemente

UPDATE public.transactions 
SET user_id = accounts.user_id,
    updated_at = NOW()
FROM public.accounts
WHERE transactions.account_id = accounts.id
  AND transactions.user_id != accounts.user_id
  AND accounts.deleted = false
  AND (
    -- Corrigir parcelas
    transactions.is_installment = true
    OR 
    -- Corrigir transações criadas nos últimos 30 dias (possíveis importações)
    transactions.created_at >= NOW() - INTERVAL '30 days'
  );

-- ==============================================================================
-- PARTE 2: RELATÓRIO DE CORREÇÕES APLICADAS
-- ==============================================================================

-- Contar quantas transações foram corrigidas
DO $$
DECLARE
    v_corrected_count INTEGER;
    v_total_installments INTEGER;
    v_recent_transactions INTEGER;
BEGIN
    -- Contar parcelas que foram corrigidas
    SELECT COUNT(*) INTO v_total_installments
    FROM public.transactions t
    JOIN public.accounts a ON t.account_id = a.id
    WHERE t.user_id = a.user_id
      AND t.is_installment = true
      AND t.updated_at >= NOW() - INTERVAL '1 minute';
    
    -- Contar transações recentes que foram corrigidas
    SELECT COUNT(*) INTO v_recent_transactions
    FROM public.transactions t
    JOIN public.accounts a ON t.account_id = a.id
    WHERE t.user_id = a.user_id
      AND t.created_at >= NOW() - INTERVAL '30 days'
      AND t.updated_at >= NOW() - INTERVAL '1 minute';
    
    v_corrected_count := v_total_installments + v_recent_transactions;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'CORREÇÃO DE PARCELAS EXISTENTES';
    RAISE NOTICE '========================================';
    RAISE NOTICE '';
    RAISE NOTICE 'Transações corrigidas: %', v_corrected_count;
    RAISE NOTICE 'Parcelas corrigidas: %', v_total_installments;
    RAISE NOTICE 'Transações recentes corrigidas: %', v_recent_transactions;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Correção aplicada com sucesso!';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMO PASSO:';
    RAISE NOTICE 'Verifique se o usuário B agora vê todas as parcelas';
    RAISE NOTICE '';
END $$;

COMMIT;