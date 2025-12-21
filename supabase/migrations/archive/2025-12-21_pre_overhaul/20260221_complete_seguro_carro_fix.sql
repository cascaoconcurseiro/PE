-- ==============================================================================
-- CORREÇÃO COMPLETA: Seguro - Carro
-- DATA: 2025-12-21
-- PROBLEMA: 50 parcelas duplicadas, todas deletadas, sem account_id
-- SOLUÇÃO: Remover duplicatas, restaurar 10 parcelas únicas, associar à conta
-- ==============================================================================

-- DIAGNÓSTICO INICIAL
DO $$
DECLARE
    total_before INTEGER;
    duplicates_count INTEGER;
    user_main UUID := 'd7f294f7-8651-47f1-844b-9e04fbca0ea5';
    user_wesley UUID := '291732a3-1f5a-4cf9-9d17-55beeefc40f6';
    target_account_id UUID;
BEGIN
    -- Contar parcelas antes da correção
    SELECT COUNT(*) INTO total_before
    FROM public.transactions
    WHERE description LIKE '%Seguro - Carro%'
      AND is_installment = true;
    
    RAISE NOTICE 'DIAGNÓSTICO INICIAL:';
    RAISE NOTICE 'Total de parcelas Seguro - Carro: %', total_before;
    
    -- Mostrar distribuição por usuário
    FOR rec IN (
        SELECT 
            user_id,
            COUNT(*) as total,
            COUNT(CASE WHEN deleted = false THEN 1 END) as ativas
        FROM public.transactions
        WHERE description LIKE '%Seguro - Carro%'
          AND is_installment = true
        GROUP BY user_id
    ) LOOP
        RAISE NOTICE 'Usuário %: % parcelas (% ativas)', rec.user_id, rec.total, rec.ativas;
    END LOOP;
    
    -- PASSO 1: Deletar todas as parcelas do Wesley (são duplicatas)
    DELETE FROM public.transactions
    WHERE description LIKE '%Seguro - Carro%'
      AND is_installment = true
      AND user_id = user_wesley;
    
    GET DIAGNOSTICS duplicates_count = ROW_COUNT;
    RAISE NOTICE 'Removidas % parcelas duplicadas do usuário Wesley', duplicates_count;
    
    -- PASSO 2: Deletar duplicatas do usuário principal, mantendo apenas 1 de cada
    WITH parcelas_para_deletar AS (
        SELECT id
        FROM (
            SELECT 
                id,
                ROW_NUMBER() OVER (PARTITION BY current_installment ORDER BY created_at) as rn
            FROM public.transactions
            WHERE description LIKE '%Seguro - Carro%'
              AND is_installment = true
              AND user_id = user_main
        ) ranked
        WHERE rn > 1  -- Manter apenas a primeira (rn = 1)
    )
    DELETE FROM public.transactions
    WHERE id IN (SELECT id FROM parcelas_para_deletar);
    
    GET DIAGNOSTICS duplicates_count = ROW_COUNT;
    RAISE NOTICE 'Removidas % parcelas duplicadas do usuário principal', duplicates_count;
    
    -- PASSO 3: Encontrar conta do usuário principal
    SELECT id INTO target_account_id
    FROM public.accounts 
    WHERE user_id = user_main 
      AND type = 'CREDIT_CARD' 
      AND deleted = false 
    LIMIT 1;
    
    IF target_account_id IS NULL THEN
        -- Se não houver conta de cartão, usar qualquer conta ativa
        SELECT id INTO target_account_id
        FROM public.accounts 
        WHERE user_id = user_main 
          AND deleted = false 
        LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Conta alvo identificada: %', target_account_id;
    
    -- PASSO 4: Restaurar e corrigir as parcelas restantes
    UPDATE public.transactions
    SET 
        deleted = false,
        account_id = target_account_id,
        updated_at = NOW()
    WHERE description LIKE '%Seguro - Carro%'
      AND is_installment = true
      AND user_id = user_main;
    
    GET DIAGNOSTICS duplicates_count = ROW_COUNT;
    RAISE NOTICE 'Restauradas % parcelas para o usuário principal', duplicates_count;
    
    -- DIAGNÓSTICO FINAL
    RAISE NOTICE 'DIAGNÓSTICO FINAL:';
    FOR rec IN (
        SELECT 
            user_id,
            COUNT(*) as total,
            COUNT(CASE WHEN deleted = false THEN 1 END) as ativas,
            COUNT(CASE WHEN account_id IS NOT NULL THEN 1 END) as com_conta,
            MIN(current_installment) as primeira,
            MAX(current_installment) as ultima
        FROM public.transactions
        WHERE description LIKE '%Seguro - Carro%'
          AND is_installment = true
        GROUP BY user_id
    ) LOOP
        RAISE NOTICE 'Usuário %: % parcelas (% ativas, % com conta) - Parcelas % a %', 
                     rec.user_id, rec.total, rec.ativas, rec.com_conta, rec.primeira, rec.ultima;
    END LOOP;
    
END $$;