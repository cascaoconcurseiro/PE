-- ==============================================================================
-- MIGRATION: BACKEND CENTRIC DESIGN (ETAPA 7)
-- DATA: 2026-01-23
-- DESCRIÇÃO: Implementa RPCs (Stored Functions) para encapsular regras de negócio.
--            Substitui a lógica de "Client faz INSERT direto" por "Client chama Função".
-- ==============================================================================

BEGIN;

-- 1. RPC: CREATE TRANSACTION (Core Creation Logic)
-- ------------------------------------------------------------------------------
-- Centraliza validações de domínio e regras básicas.
CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT, -- RECEITA, DESPESA, TRANSFERÊNCIA
    p_category TEXT,
    p_date DATE,
    p_account_id UUID,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
BEGIN
    -- 1. Validação de Domínio
    IF (p_trip_id IS NOT NULL) THEN
        v_final_domain := 'TRAVEL';
    ELSE
        -- Se não veio especificado, assume PERSONAL ou SHARED se marcado
        v_final_domain := COALESCE(p_domain, 'PERSONAL');
    END IF;

    -- Validação Cruzada
    IF (p_trip_id IS NOT NULL AND v_final_domain != 'TRAVEL') THEN
        RAISE EXCEPTION 'Business Rule Breach: Trip transactions must be TRAVEL domain.';
    END IF;

    -- 2. Validação de Tipo
    IF (p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL) THEN
        RAISE EXCEPTION 'Business Rule Breach: Transfer requires destination account.';
    END IF;

    -- 3. Inserção (O trigger Bridge vai rodar depois para atualizar Ledger)
    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, destination_account_id, trip_id, 
        is_shared, domain, user_id
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id::text, p_destination_account_id::text, p_trip_id::text,
        p_is_shared, v_final_domain, auth.uid()
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 2. RPC: SETTLE SPLIT (Pagamento de Dívida)
-- ------------------------------------------------------------------------------
-- Resolve o fluxo de pagar uma dívida pendente. Gera transação real e baixa no split.
CREATE OR REPLACE FUNCTION public.settle_split(
    p_split_id UUID,
    p_payment_account_id UUID
)
RETURNS UUID AS $$
DECLARE
    v_split RECORD;
    v_transaction_id UUID;
    v_description TEXT;
BEGIN
    -- Busca e Bloqueia Split
    SELECT s.*, t.description as original_desc, t.user_id as payer_user_id 
    INTO v_split
    FROM public.transaction_splits s
    JOIN public.transactions t ON t.id = s.transaction_id
    WHERE s.id = p_split_id
    FOR UPDATE OF s;

    -- Validações
    IF (v_split IS NULL) THEN
        RAISE EXCEPTION 'Split not found.';
    END IF;

    IF (v_split.status != 'OPEN') THEN
        RAISE EXCEPTION 'Split is already settled or cancelled.';
    END IF;

    IF (v_split.debtor_id != auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: You can only settle your own debts.';
    END IF;

    -- Cria Transação de Transferência (Pagamento)
    -- Eu (Debtor) pago para o Payer original.
    -- Como não sabemos a conta de destino do payer, deixamos NULL (saída do dinheiro apenas)
    -- OU melhor, isso é um "Reembolso". 
    -- Vamos criar como TRANSFERÊNCIA para indicar fluxo de caixa neutro se fosse entre contas minhas,
    -- mas aqui é SAÍDA REAL para outra pessoa. Então é DESPESA do tipo "Acerto de Contas"?
    -- O prompt pede TRANSFERÊNCIA explícita.
    
    v_description := 'Pgto Dívida: ' || v_split.original_desc;

    INSERT INTO public.transactions (
        description, amount, type, category, date, 
        account_id, domain, user_id
    ) VALUES (
        v_description, v_split.assigned_amount, 'TRANSFERÊNCIA', 'Ajuste', CURRENT_DATE,
        p_payment_account_id::text, 'SHARED', auth.uid()
    ) RETURNING id INTO v_transaction_id;

    -- Atualiza Split
    UPDATE public.transaction_splits 
    SET status = 'SETTLED' 
    WHERE id = p_split_id;

    RETURN v_transaction_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- 3. RPC: SHARE TRANSACTION (Cria Dívida Manualmente)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.share_transaction(
    p_transaction_id UUID,
    p_debtor_id UUID,
    p_amount NUMERIC
)
RETURNS UUID AS $$
DECLARE
    v_split_id UUID;
    v_tx_owner UUID;
BEGIN
    -- Verificar se sou o dono da transaction
    SELECT user_id INTO v_tx_owner FROM public.transactions WHERE id = p_transaction_id;
    
    IF (v_tx_owner != auth.uid()) THEN
        RAISE EXCEPTION 'Access Denied: You can only share your own transactions.';
    END IF;

    IF (p_amount <= 0) THEN
         RAISE EXCEPTION 'Amount must be positive.';
    END IF;

    -- Insere Split
    INSERT INTO public.transaction_splits (
        transaction_id, debtor_id, assigned_amount, status, created_at
    ) VALUES (
        p_transaction_id, p_debtor_id, p_amount, 'OPEN', NOW()
    ) RETURNING id INTO v_split_id;

    -- Atualiza flag is_shared para UX (Opcional, mas bom manter sincrono)
    UPDATE public.transactions SET is_shared = TRUE WHERE id = p_transaction_id;

    RETURN v_split_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


COMMIT;
