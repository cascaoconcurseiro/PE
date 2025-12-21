-- ==============================================================================
-- MIGRATION: FIX INSTALLMENT IMPORT USER_ID ISSUE - VERSÃO LIMPA
-- DATA: 2025-12-21
-- OBJETIVO: Corrigir bug onde parcelas importadas aparecem apenas para quem
--           importou (user A) mas não para o dono da conta (user B)
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: LIMPAR FUNÇÕES EXISTENTES (RESOLVER CONFLITOS)
-- ==============================================================================

-- Remover todas as versões da função create_transaction
DROP FUNCTION IF EXISTS public.create_transaction CASCADE;

-- Remover função auxiliar se existir
DROP FUNCTION IF EXISTS public.can_access_account CASCADE;

-- ==============================================================================
-- PARTE 2: CRIAR FUNÇÃO AUXILIAR PARA VERIFICAR PERMISSÃO DE CONTA
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.can_access_account(p_account_id UUID, p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
    v_account_owner UUID;
BEGIN
    -- Buscar o dono da conta
    SELECT user_id INTO v_account_owner
    FROM public.accounts
    WHERE id = p_account_id AND deleted = false;
    
    -- Se conta não existe, retornar false
    IF v_account_owner IS NULL THEN
        RETURN false;
    END IF;
    
    -- Permitir se é o dono da conta
    RETURN v_account_owner = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 3: RECRIAR FUNÇÃO CREATE_TRANSACTION COM FIX DE USER_ID
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id TEXT DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb,
    p_destination_amount NUMERIC DEFAULT NULL,
    p_notes TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_current_user_id UUID := auth.uid();
    v_transaction_user_id UUID;
    v_account_owner_id UUID;
BEGIN
    -- =========================================================================
    -- VALIDAÇÃO 1: Autenticação
    -- =========================================================================
    IF v_current_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- =========================================================================
    -- VALIDAÇÃO 2: Transferência requer conta de destino
    -- =========================================================================
    IF p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL THEN
        RAISE EXCEPTION 'Transferência requer conta de destino.';
    END IF;

    -- =========================================================================
    -- FIX CRÍTICO: Determinar o user_id correto para a transação
    -- =========================================================================
    IF p_account_id IS NOT NULL THEN
        -- Buscar o dono da conta
        SELECT user_id INTO v_account_owner_id
        FROM public.accounts
        WHERE id = p_account_id AND deleted = false;
        
        -- Se conta não existe, erro
        IF v_account_owner_id IS NULL THEN
            RAISE EXCEPTION 'Conta não encontrada ou foi deletada.';
        END IF;
        
        -- Verificar se usuário atual tem permissão para criar transações nesta conta
        IF NOT public.can_access_account(p_account_id, v_current_user_id) THEN
            RAISE EXCEPTION 'Você não tem permissão para criar transações nesta conta.';
        END IF;
        
        -- Usar o user_id do dono da conta (FIX PRINCIPAL)
        v_transaction_user_id := v_account_owner_id;
        
        RAISE NOTICE '[create_transaction] Usuário atual: %, Dono da conta: %, Usando user_id: %', 
            v_current_user_id, v_account_owner_id, v_transaction_user_id;
    ELSE
        -- Se não há account_id, usar o usuário atual
        v_transaction_user_id := v_current_user_id;
    END IF;

    -- =========================================================================
    -- Domain Resolution
    -- =========================================================================
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- =========================================================================
    -- Inserção da transação com user_id correto
    -- =========================================================================
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id,
        destination_amount, notes,
        created_at, updated_at
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_transaction_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with,
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END,
        p_destination_amount, p_notes,
        NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    -- =========================================================================
    -- Sincronização de transações compartilhadas (se função existir)
    -- =========================================================================
    BEGIN
        PERFORM public.sync_shared_transaction(v_new_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[create_transaction] Sync compartilhado falhou para ID %: %', v_new_id, SQLERRM;
    END;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 4: COMENTÁRIOS E DOCUMENTAÇÃO
-- ==============================================================================

COMMENT ON FUNCTION public.create_transaction IS 
'Cria uma nova transação com user_id correto baseado no dono da conta.
FIX: Transações importadas agora aparecem para o dono da conta, não para quem importou.';

COMMENT ON FUNCTION public.can_access_account IS
'Verifica se um usuário tem permissão para acessar/modificar uma conta.';

COMMIT;