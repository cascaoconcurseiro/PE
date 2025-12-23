-- ==============================================================================
-- RESTRICT SHARED TRANSACTION MANAGEMENT
-- DATA: 2025-12-20
-- OBJETIVO: 
--   1. Impedir que participantes editem campos críticos de transações espelhadas.
--   2. Impedir que participantes excluam transações espelhadas.
--   3. Garantir que apenas o criador (payer) tenha controle total.
-- ==============================================================================

BEGIN;

-- 1. ATUALIZAR RPC update_transaction PARA VALIDAR MIRRORS
CREATE OR REPLACE FUNCTION public.update_transaction(
    p_id UUID,
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
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT FALSE,
    p_shared_with JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
    v_old_tx RECORD;
BEGIN
    -- Validação de autenticação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Buscar transação atual
    SELECT * INTO v_old_tx FROM public.transactions WHERE id = p_id;

    -- Verificar existência e propriedade básica
    IF v_old_tx IS NULL OR v_old_tx.user_id != v_user_id THEN
        RAISE EXCEPTION 'Transação não encontrada ou acesso negado.';
    END IF;

    -- 🚨 SEGURANÇA: Validar se é um Mirror (payer_id != me/null E payer_id != user_id)
    -- Se for mirror, o usuário só pode marcar como SETTLED ou mudar a CATEGORIA (opcional).
    -- Ele NÃO pode mudar: montante, data, descrição, compartilhamento, viagem, parcelamento.
    IF v_old_tx.payer_id IS NOT NULL 
       AND v_old_tx.payer_id != 'me' 
       AND v_old_tx.payer_id != v_user_id::text THEN
       
       -- Verificar se houve alteração em campos bloqueados
       IF (v_old_tx.amount != p_amount OR
           v_old_tx.date != p_date OR
           v_old_tx.description != p_description OR
           v_old_tx.type != p_type OR
           COALESCE(v_old_tx.trip_id, '00000000-0000-0000-0000-000000000000'::uuid) != COALESCE(p_trip_id, '00000000-0000-0000-0000-000000000000'::uuid) OR
           v_old_tx.is_shared != p_is_shared) THEN
           
           RAISE EXCEPTION 'Você não tem permissão para editar os valores desta transação compartilhada. Apenas o criador pode alterá-la.';
       END IF;
    END IF;

    -- Domain Resolution
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- Atualização
    UPDATE public.transactions SET
        description = p_description,
        amount = p_amount,
        type = p_type,
        category = p_category,
        date = p_date,
        account_id = p_account_id,
        destination_account_id = p_destination_account_id,
        trip_id = p_trip_id,
        is_shared = p_is_shared,
        domain = v_final_domain,
        is_installment = p_is_installment,
        current_installment = p_current_installment,
        total_installments = p_total_installments,
        series_id = p_series_id,
        is_recurring = p_is_recurring,
        frequency = p_frequency,
        is_settled = p_is_settled,
        shared_with = COALESCE(p_shared_with, shared_with),
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. TRIGGER PARA BLOQUEAR DELEÇÃO DE MIRRORS
CREATE OR REPLACE FUNCTION public.block_mirror_deletion()
RETURNS TRIGGER AS $$
BEGIN
    -- Se estiver tentando marcar como excluído (soft-delete)
    IF (OLD.deleted = false AND NEW.deleted = true) THEN
        -- Verificar se é um mirror
        IF OLD.payer_id IS NOT NULL 
           AND OLD.payer_id != 'me' 
           AND OLD.payer_id != OLD.user_id::text THEN
           
           RAISE EXCEPTION 'Não é permitido excluir uma transação compartilhada por terceiros diretamente. Peça ao criador para removê-la.';
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_block_mirror_deletion ON public.transactions;
CREATE TRIGGER trg_block_mirror_deletion
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    WHEN (OLD.deleted IS DISTINCT FROM NEW.deleted)
    EXECUTE FUNCTION public.block_mirror_deletion();

COMMIT;
