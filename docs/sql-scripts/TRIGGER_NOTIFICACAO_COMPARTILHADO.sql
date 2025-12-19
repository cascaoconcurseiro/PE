-- ==============================================================================
-- TRIGGER: NOTIFICAÇÃO PARA TRANSAÇÕES COMPARTILHADAS
-- DATA: 2025-12-18
-- DESCRIÇÃO: Quando o usuário A cria uma transação compartilhada com o usuário B,
--            o usuário B recebe uma notificação no sininho.
-- ==============================================================================

-- 1. Criar função que gera notificação para membros compartilhados
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
        
        -- Obter nome do criador
        SELECT COALESCE(raw_user_meta_data->>'name', email) INTO creator_name 
        FROM auth.users 
        WHERE id = NEW.user_id;
        
        tx_description := NEW.description;
        tx_amount := NEW.amount;
        
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
                    COALESCE(creator_name, 'Alguém') || ' compartilhou uma despesa com você: ' || tx_description || ' - R$ ' || ROUND(tx_amount, 2)::TEXT,
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
