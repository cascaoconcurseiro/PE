-- ==============================================================================
-- CORREÇÕES DE OWNERSHIP E SEGURANÇA
-- DATA: 2025-12-18
-- DESCRIÇÃO: Corrige problemas de ownership em transações e viagens
-- ==============================================================================

-- 1. ATUALIZAR RPC create_transaction PARA ACEITAR user_id
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.create_transaction(
    p_user_id UUID DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_date DATE DEFAULT NULL,
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
    p_shared_with JSONB DEFAULT '[]'::JSONB,
    p_payer_id UUID DEFAULT NULL,
    p_currency TEXT DEFAULT 'BRL'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_new_id UUID;
    v_user_id UUID;
BEGIN
    -- Usar user_id passado ou auth.uid()
    v_user_id := COALESCE(p_user_id, auth.uid());
    
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;

    -- Validações básicas
    IF p_amount IS NULL OR p_amount <= 0 THEN
        RAISE EXCEPTION 'Valor da transação inválido';
    END IF;
    
    IF p_description IS NULL OR TRIM(p_description) = '' THEN
        RAISE EXCEPTION 'Descrição obrigatória';
    END IF;

    -- Validar conta existe e pertence ao usuário (se não for compartilhada externa)
    IF p_account_id IS NOT NULL THEN
        IF NOT EXISTS (SELECT 1 FROM accounts WHERE id = p_account_id AND user_id = v_user_id) THEN
            RAISE EXCEPTION 'Conta não encontrada ou não pertence ao usuário';
        END IF;
    END IF;

    -- Gerar novo ID
    v_new_id := gen_random_uuid();

    -- Inserir transação
    INSERT INTO transactions (
        id,
        user_id,
        description,
        amount,
        type,
        category,
        date,
        account_id,
        destination_account_id,
        trip_id,
        is_shared,
        domain,
        is_installment,
        current_installment,
        total_installments,
        series_id,
        is_recurring,
        frequency,
        shared_with,
        payer_id,
        currency,
        created_at,
        updated_at
    ) VALUES (
        v_new_id,
        v_user_id,
        p_description,
        p_amount,
        p_type,
        p_category,
        p_date,
        p_account_id,
        p_destination_account_id,
        p_trip_id,
        p_is_shared,
        p_domain,
        p_is_installment,
        p_current_installment,
        p_total_installments,
        p_series_id,
        p_is_recurring,
        p_frequency,
        p_shared_with,
        p_payer_id,
        p_currency,
        NOW(),
        NOW()
    );

    RETURN v_new_id;
END;
$$;

-- 2. CRIAR RPC PARA UPDATE COM VALIDAÇÃO DE OWNERSHIP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.update_transaction_safe(
    p_id UUID,
    p_description TEXT DEFAULT NULL,
    p_amount NUMERIC DEFAULT NULL,
    p_type TEXT DEFAULT NULL,
    p_category TEXT DEFAULT NULL,
    p_date DATE DEFAULT NULL,
    p_account_id UUID DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT NULL,
    p_settled_at TIMESTAMPTZ DEFAULT NULL,
    p_shared_with JSONB DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    -- Verificar ownership
    SELECT user_id INTO v_owner_id FROM transactions WHERE id = p_id;
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Transação não encontrada';
    END IF;
    
    IF v_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Você não tem permissão para editar esta transação';
    END IF;

    -- Atualizar apenas campos não-nulos
    UPDATE transactions SET
        description = COALESCE(p_description, description),
        amount = COALESCE(p_amount, amount),
        type = COALESCE(p_type, type),
        category = COALESCE(p_category, category),
        date = COALESCE(p_date, date),
        account_id = COALESCE(p_account_id, account_id),
        is_settled = COALESCE(p_is_settled, is_settled),
        settled_at = COALESCE(p_settled_at, settled_at),
        shared_with = COALESCE(p_shared_with, shared_with),
        updated_at = NOW()
    WHERE id = p_id;

    RETURN TRUE;
END;
$$;

-- 3. CRIAR RPC PARA DELETE COM VALIDAÇÃO DE OWNERSHIP
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.delete_transaction_safe(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_owner_id UUID;
BEGIN
    -- Verificar ownership
    SELECT user_id INTO v_owner_id FROM transactions WHERE id = p_id;
    
    IF v_owner_id IS NULL THEN
        RAISE EXCEPTION 'Transação não encontrada';
    END IF;
    
    IF v_owner_id != auth.uid() THEN
        RAISE EXCEPTION 'Você não tem permissão para excluir esta transação';
    END IF;

    -- Soft delete
    UPDATE transactions SET 
        deleted = TRUE,
        updated_at = NOW()
    WHERE id = p_id;

    RETURN TRUE;
END;
$$;

-- 4. ATUALIZAR TRANSAÇÕES EXISTENTES SEM user_id
-- ==============================================================================
-- Isso atribui transações órfãs ao usuário que possui a conta
UPDATE transactions t
SET user_id = a.user_id
FROM accounts a
WHERE t.account_id = a.id
  AND t.user_id IS NULL;

-- 5. CRIAR TABELA PARA ORÇAMENTO PESSOAL POR PARTICIPANTE DE VIAGEM
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.trip_participant_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    budget NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(trip_id, user_id)
);

-- RLS para trip_participant_budgets
ALTER TABLE public.trip_participant_budgets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own trip budgets"
    ON public.trip_participant_budgets FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own trip budgets"
    ON public.trip_participant_budgets FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own trip budgets"
    ON public.trip_participant_budgets FOR UPDATE
    USING (user_id = auth.uid());

-- 6. RPC PARA SALVAR ORÇAMENTO PESSOAL DE VIAGEM
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_trip_budget(
    p_trip_id UUID,
    p_budget NUMERIC
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO trip_participant_budgets (trip_id, user_id, budget)
    VALUES (p_trip_id, auth.uid(), p_budget)
    ON CONFLICT (trip_id, user_id) 
    DO UPDATE SET budget = p_budget, updated_at = NOW();
    
    RETURN TRUE;
END;
$$;

-- 7. RPC PARA OBTER ORÇAMENTO PESSOAL DE VIAGEM
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.get_my_trip_budget(p_trip_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_budget NUMERIC;
BEGIN
    SELECT budget INTO v_budget
    FROM trip_participant_budgets
    WHERE trip_id = p_trip_id AND user_id = auth.uid();
    
    RETURN COALESCE(v_budget, 0);
END;
$$;

-- 8. MELHORAR TRIGGER DE NOTIFICAÇÃO (com tratamento de erro)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.notify_shared_transaction()
RETURNS TRIGGER AS $$
DECLARE
    shared_member RECORD;
    member_user_id UUID;
    creator_name TEXT;
    tx_description TEXT;
    tx_amount NUMERIC;
BEGIN
    -- Só processar se a transação é compartilhada e tem sharedWith
    IF NEW.is_shared = TRUE AND NEW.shared_with IS NOT NULL AND jsonb_array_length(NEW.shared_with) > 0 THEN
        
        -- Obter nome do criador (com fallback)
        SELECT COALESCE(raw_user_meta_data->>'name', split_part(email, '@', 1), 'Alguém') 
        INTO creator_name 
        FROM auth.users 
        WHERE id = NEW.user_id;
        
        creator_name := COALESCE(creator_name, 'Alguém');
        tx_description := COALESCE(NEW.description, 'Despesa compartilhada');
        tx_amount := COALESCE(NEW.amount, 0);
        
        -- Iterar sobre cada membro compartilhado
        FOR shared_member IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
            BEGIN
                -- Buscar o user_id vinculado ao membro familiar
                SELECT linked_user_id INTO member_user_id
                FROM public.family_members
                WHERE id = (shared_member.value->>'memberId')::UUID
                  AND linked_user_id IS NOT NULL;
                
                -- Se o membro tem um usuário vinculado e não é o próprio criador
                IF member_user_id IS NOT NULL AND member_user_id != NEW.user_id THEN
                    -- Inserir notificação
                    INSERT INTO public.user_notifications (
                        user_id,
                        type,
                        title,
                        message,
                        metadata,
                        is_read,
                        created_at
                    ) VALUES (
                        member_user_id,
                        'SHARED_EXPENSE',
                        'Nova Despesa Compartilhada',
                        creator_name || ' compartilhou: ' || tx_description || ' - R$ ' || ROUND(tx_amount, 2)::TEXT,
                        jsonb_build_object(
                            'transactionId', NEW.id,
                            'creatorId', NEW.user_id,
                            'amount', tx_amount,
                            'description', tx_description,
                            'assignedAmount', (shared_member.value->>'assignedAmount')::NUMERIC
                        ),
                        FALSE,
                        NOW()
                    );
                END IF;
            EXCEPTION WHEN OTHERS THEN
                -- Log error but don't fail the transaction
                RAISE WARNING 'Erro ao notificar membro %: %', shared_member.value->>'memberId', SQLERRM;
            END;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_notify_shared_transaction ON public.transactions;
CREATE TRIGGER trigger_notify_shared_transaction
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_shared_transaction();

-- 9. ÍNDICES PARA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_transactions_is_shared ON transactions(is_shared) WHERE is_shared = TRUE;
CREATE INDEX IF NOT EXISTS idx_trip_budgets_trip_user ON trip_participant_budgets(trip_id, user_id);

-- 10. VERIFICAÇÃO FINAL
-- ==============================================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Correções de ownership aplicadas com sucesso!';
    RAISE NOTICE '- RPC create_transaction atualizado com p_user_id';
    RAISE NOTICE '- RPC update_transaction_safe criado com validação';
    RAISE NOTICE '- RPC delete_transaction_safe criado com validação';
    RAISE NOTICE '- Tabela trip_participant_budgets criada';
    RAISE NOTICE '- Trigger de notificação melhorado';
END $$;
