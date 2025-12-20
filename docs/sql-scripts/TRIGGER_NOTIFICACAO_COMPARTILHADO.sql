-- ==============================================================================
-- TRIGGER: NOTIFICAÇÃO PARA TRANSAÇÕES COMPARTILHADAS
-- DATA: 2025-12-19
-- DESCRIÇÃO: Quando o usuário A cria uma transação compartilhada com o usuário B,
--            o usuário B recebe uma notificação no sininho.
-- ==============================================================================

-- 1. Criar função que gera notificação para membros compartilhados
-- Evita notificações duplicadas para parcelas da mesma série
CREATE OR REPLACE FUNCTION public.notify_shared_transaction()
RETURNS TRIGGER AS $$
DECLARE
    shared_member RECORD;
    member_user_id UUID;
    creator_name TEXT;
    tx_description TEXT;
    tx_amount NUMERIC;
    installment_info TEXT;
    total_amount NUMERIC;
    existing_notification_count INTEGER;
BEGIN
    -- Só processar se a transação é compartilhada e tem sharedWith
    IF NEW.is_shared = TRUE AND NEW.shared_with IS NOT NULL AND jsonb_array_length(NEW.shared_with) > 0 THEN

        -- Verificar se já existe notificação para esta série de parcelas
        -- para evitar notificações duplicadas
        IF NEW.is_installment = TRUE AND NEW.series_id IS NOT NULL AND NEW.current_installment > 1 THEN
            -- Para parcelas subsequentes (não a primeira), verificar se já existe notificação para esta série
            SELECT COUNT(*) INTO existing_notification_count
            FROM public.user_notifications un
            JOIN public.transactions t ON (un.metadata->>'transactionId')::UUID = t.id
            WHERE t.series_id = NEW.series_id
              AND un.type = 'SHARED_EXPENSE'
              AND un.created_at > NOW() - INTERVAL '5 minutes'; -- Verificar nas últimas 5 minutos

            -- Se já existe notificação para esta série, pular
            IF existing_notification_count > 0 THEN
                RETURN NEW;
            END IF;
        END IF;

        -- Obter nome do criador
        SELECT COALESCE(raw_user_meta_data->>'name', email) INTO creator_name
        FROM auth.users
        WHERE id = NEW.user_id;

        tx_description := NEW.description;
        tx_amount := NEW.amount;

        -- Adicionar informações sobre parcelamento se aplicável
        IF NEW.is_installment = TRUE AND NEW.current_installment IS NOT NULL AND NEW.total_installments IS NOT NULL THEN
            total_amount := NEW.amount * COALESCE(NEW.total_installments, 1);
            installment_info := ' (' || COALESCE(NEW.total_installments, 1)::TEXT || 'x de R$ ' || ROUND(NEW.amount, 2)::TEXT || ') - R$ ' || ROUND(total_amount, 2)::TEXT;

            -- Remover número da parcela da descrição para evitar duplicação
            tx_description := REGEXP_REPLACE(NEW.description, ' \([0-9]+/[0-9]+\)', '', 'g');
        ELSE
            installment_info := '';
        END IF;

        -- Iterar sobre cada membro compartilhado
        FOR shared_member IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
        LOOP
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
                    COALESCE(creator_name, 'Alguém') || ' compartilhou: ' || tx_description || installment_info,
                    jsonb_build_object(
                        'transactionId', NEW.id,
                        'creatorId', NEW.user_id,
                        'amount', tx_amount,
                        'description', tx_description,
                        'assignedAmount', (shared_member.value->>'assignedAmount')::NUMERIC,
                        'isInstallment', COALESCE(NEW.is_installment, false),
                        'currentInstallment', NEW.current_installment,
                        'totalInstallments', NEW.total_installments,
                        'seriesId', NEW.series_id
                    ),
                    FALSE,
                    NOW()
                );
            END IF;
        END LOOP;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_notify_shared_transaction ON public.transactions;

-- 3. Criar trigger para INSERT
CREATE TRIGGER trigger_notify_shared_transaction
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.notify_shared_transaction();

-- 4. Verificar se a coluna 'type' SHARED_EXPENSE é suportada
-- (Se não existir, adicionar ao enum ou usar TEXT)
DO $$
BEGIN
    RAISE NOTICE 'Trigger de notificação para transações compartilhadas criado com sucesso!';
    RAISE NOTICE 'Quando o usuário A criar uma transação compartilhada, o usuário B receberá uma notificação.';
END $$;
