-- ==============================================================================
-- MIGRATION: SHARED REFACTOR & SPLITS (ETAPA 3)
-- DATA: 2026-01-19
-- DESCRIÇÃO: Refatora o modelo de compartilhamento para eliminar duplicação financeira.
--            1. Promove 'transaction_splits' a entidade central de dívidas.
--            2. Remove permanentemente triggers de espelhamento (Mirroring).
--            3. Desacopla JSON da lógica de persistência (Splits são soberanos).
-- ==============================================================================

BEGIN;

-- 1. CLEANUP: REMOVER TRIGGERS VINCULADOS AO MODELO ANTIGO
-- ------------------------------------------------------------------------------
-- Não precisamos mais espelhar transactions. O Ledger cuida do dinheiro (Payer), 
-- e o Split cuida da dívida (Debtor).

DROP TRIGGER IF EXISTS trg_mirror_shared_transaction ON public.transactions;
DROP FUNCTION IF EXISTS public.handle_mirror_shared_transaction();

DROP TRIGGER IF EXISTS trg_lock_shared_mirrors ON public.transactions;
DROP FUNCTION IF EXISTS public.enforce_shared_mirror_lock();

DROP TRIGGER IF EXISTS trg_validate_shared_integrity ON public.transactions;

DROP TRIGGER IF EXISTS trg_sync_json_splits ON public.transactions;
DROP FUNCTION IF EXISTS public.sync_shared_json_to_table();

-- Remove triggers de notificação antigos (serão substituídos por notificação baseada em Split)
DROP TRIGGER IF EXISTS trg_shared_notification ON public.transactions;
DROP TRIGGER IF EXISTS trg_unified_shared_notification ON public.transactions;
DROP TRIGGER IF EXISTS trig_notify_shared_tx ON public.transactions;


-- 2. EVOLUÇÃO DA TABELA: transaction_splits
-- ------------------------------------------------------------------------------
-- Adicionar colunas para suportar o novo modelo de "Dívida Formal"

-- Status: OPEN (Aberto), SETTLED (Pago/Resolvido), PENDING (Aguardando Aceite?)
-- Vamos simplificar: OPEN | SETTLED.
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_splits' AND column_name = 'status') THEN
        ALTER TABLE public.transaction_splits ADD COLUMN status TEXT CHECK (status IN ('OPEN', 'SETTLED', 'CANCELLED')) DEFAULT 'OPEN';
    END IF;

    -- Renomear/Mapear user_id para debtor_id para clareza (quem deve)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transaction_splits' AND column_name = 'debtor_id') THEN
        ALTER TABLE public.transaction_splits ADD COLUMN debtor_id UUID REFERENCES auth.users(id);
    END IF;
END $$;

-- Migração de Dados Existentes
-- Se is_settled = true -> status = SETTLED
UPDATE public.transaction_splits 
SET status = 'SETTLED' 
WHERE is_settled = TRUE AND status = 'OPEN';

-- Popula debtor_id com o user_id existente
UPDATE public.transaction_splits 
SET debtor_id = user_id 
WHERE debtor_id IS NULL;


-- 3. NOTIFICAÇÃO BASEADA EM SPLITS (NOVA LÓGICA)
-- ------------------------------------------------------------------------------
-- Quando um Split é criado onde debtor_id != payer (da transaction), notifica.

CREATE OR REPLACE FUNCTION public.notify_new_split_debt()
RETURNS TRIGGER AS $$
DECLARE
    v_payer_id UUID;
    v_payer_name TEXT;
    v_description TEXT;
    v_amount NUMERIC;
BEGIN
    -- Busca dados da transação original (join rápido)
    SELECT user_id, description, amount 
    INTO v_payer_id, v_description, v_amount
    FROM public.transactions 
    WHERE id = NEW.transaction_id;

    -- Se Payer for diferente do Debtor (Eu cobrando alguém)
    IF (v_payer_id IS NOT NULL AND v_payer_id != NEW.debtor_id) THEN
        
        -- Busca nome do pagador
        SELECT raw_user_meta_data->>'name' INTO v_payer_name 
        FROM auth.users WHERE id = v_payer_id;

        INSERT INTO public.user_notifications (
            user_id, 
            type, 
            title, 
            message, 
            metadata, -- Novo padrão 
            is_read
        ) VALUES (
            NEW.debtor_id,
            'TRANSACTION_SPLIT',
            'Nova Despesa Dividida',
            COALESCE(v_payer_name, 'Alguém') || ' dividiu uma despesa com você: ' || v_description,
            jsonb_build_object(
                'splitId', NEW.id, 
                'transactionId', NEW.transaction_id, 
                'amount', NEW.assigned_amount
            ),
            FALSE
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_notify_new_split ON public.transaction_splits;
CREATE TRIGGER trg_notify_new_split
    AFTER INSERT ON public.transaction_splits
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_new_split_debt();


-- 4. VALIDAÇÃO DE INTEGRIDADE (OPCIONAL MAS RECOMENDADO)
-- ------------------------------------------------------------------------------
-- Garante que splits não sejam negativos
ALTER TABLE public.transaction_splits DROP CONSTRAINT IF EXISTS check_amount_positive;
ALTER TABLE public.transaction_splits ADD CONSTRAINT check_amount_positive CHECK (assigned_amount > 0);


-- 5. DEPRECATION MARKERS
-- ------------------------------------------------------------------------------
COMMENT ON COLUMN public.transactions.mirror_transaction_id IS 'DEPRECATED: Etapa 3 - Sistema de Splits Soberano';
COMMENT ON COLUMN public.transactions.source_transaction_id IS 'DEPRECATED: Etapa 3 - Sistema de Splits Soberano';

COMMIT;
