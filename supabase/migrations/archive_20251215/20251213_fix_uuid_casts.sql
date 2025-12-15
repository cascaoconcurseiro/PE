CREATE OR REPLACE FUNCTION handle_transaction_mirroring_v4()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    shared_member_record JSONB;
    target_member_id UUID;
    target_user_id UUID;
    source_user_id UUID;
    payer_member_id_in_target UUID; -- Quem eu sou na lista dele?
    sanitized_trip_id UUID;
    sanitized_category TEXT;
    is_duplicate_check BOOLEAN := FALSE;
    shared_with_ids UUID[]; -- Array para rastrear quem ainda está compartilhado (Un-sharing logic)
    split_amount NUMERIC;
BEGIN
    -- GUARD CLAUSE 1: Prevenção de Loop Infinito (Esterilidade)
    IF NEW.mirror_transaction_id IS NOT NULL THEN
        -- WRITE GUARD: Se for um UPDATE vindo do client tentando alterar valores financeiros
        IF (TG_OP = 'UPDATE') AND (NEW.amount <> OLD.amount OR NEW.date <> OLD.date) THEN
             -- IGNORE SILENTLY (Mantém valores antigos pois o usuário destino não pode editar)
             NEW.amount := OLD.amount;
             NEW.date := OLD.date;
             NEW.currency := OLD.currency;
             RETURN NEW;
        END IF;
        RETURN NEW;
    END IF;

    -- GUARD CLAUSE 2: Apenas transações compartilhadas
    IF NEW.is_shared IS NOT TRUE OR NEW.shared_with IS NULL OR jsonb_array_length(NEW.shared_with) = 0 THEN
        -- SE O USUÁRIO DESMARCOU 'is_shared' no UPDATE
        IF (TG_OP = 'UPDATE') AND OLD.is_shared IS TRUE THEN
            -- Un-sharing Master: Apaga todas as sombras
            DELETE FROM transactions WHERE mirror_transaction_id = OLD.id;
        END IF;
        RETURN NEW;
    END IF;

    source_user_id := NEW.user_id;

    -- LOOP: Para cada membro compartilhado
    FOR shared_member_record IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
    LOOP
        target_member_id := (shared_member_record->>'memberId')::UUID;
        split_amount := COALESCE((shared_member_record->>'assignedAmount')::NUMERIC, NEW.amount);

        -- Descobrir linked_user_id
        -- [FIX] Tipagem defensiva em 'linked_user_id' e 'target_member_id'
        SELECT linked_user_id INTO target_user_id
        FROM family_members
        WHERE id = target_member_id::UUID; -- Explicit Cast

        -- Só prossegue se for usuário real conectado
        IF target_user_id IS NOT NULL THEN
            
            -- CHECK BLOQUEIO (Offboarding)
            -- [FIX] Ensure casting if database columns are inconsistent
            IF EXISTS (SELECT 1 FROM family_members WHERE user_id = target_user_id AND linked_user_id::UUID = source_user_id AND connection_status = 'BLOCKED') THEN
                RAISE EXCEPTION 'Falha ao compartilhar: O usuário de destino bloqueou novos compartilhamentos.';
            END IF;

            -- RESOLUÇÃO DE IDENTIDADE
            SELECT id INTO payer_member_id_in_target
            FROM family_members
            WHERE user_id = target_user_id AND linked_user_id::UUID = source_user_id
            LIMIT 1;

            IF payer_member_id_in_target IS NULL THEN
                 -- Tenta achar pelo Email (Smart Match)
                 SELECT id INTO payer_member_id_in_target
                 FROM family_members
                 WHERE user_id = target_user_id 
                   AND email = (SELECT email FROM auth.users WHERE id = source_user_id)
                 LIMIT 1;
                 
                 IF payer_member_id_in_target IS NOT NULL THEN
                    UPDATE family_members SET linked_user_id = source_user_id WHERE id = payer_member_id_in_target;
                 ELSIF payer_member_id_in_target IS NULL THEN
                    -- AUTO-PROVISÃO
                    INSERT INTO family_members (user_id, name, email, linked_user_id, role, connection_status)
                    SELECT 
                        target_user_id, 
                        (SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = source_user_id),
                        (SELECT email FROM auth.users WHERE id = source_user_id),
                        source_user_id,
                        'PARCEIRO(A)',
                        'ACTIVE'
                    RETURNING id INTO payer_member_id_in_target;
                 END IF;
            END IF;

            -- SANITIZAÇÃO DE TRIP
            sanitized_trip_id := NULL;
            IF NEW.trip_id IS NOT NULL THEN
                -- [FIX] Explicit Cast para evitar erro 'operator does not exist: uuid = text'
                -- Se 'transactions.trip_id' for TEXT por algum motivo legado, ou se 'NEW.trip_id' vier com formato incompativel.
                SELECT id INTO sanitized_trip_id
                FROM trips
                WHERE user_id = target_user_id 
                AND name = (SELECT name FROM trips WHERE id = NEW.trip_id::UUID) -- CRITICAL CAST
                LIMIT 1;
            END IF;

            sanitized_category := NEW.category; 

            -- CRUD OPERATION
            IF (TG_OP = 'INSERT') THEN
                -- SOFT DUPLICATE CHECK (Implementação Real)
                SELECT TRUE INTO is_duplicate_check
                FROM transactions t
                WHERE t.user_id = target_user_id
                  AND t.mirror_transaction_id IS NULL -- Só manuais
                  AND t.date = NEW.date
                  AND t.amount BETWEEN (split_amount * 0.99) AND (split_amount * 1.01) 
                LIMIT 1;

                INSERT INTO transactions (
                    user_id,
                    description,
                    amount,
                    type,
                    date,
                    category,
                    account_id,
                    payer_id,
                    is_shared,
                    is_settled,
                    trip_id,
                    mirror_transaction_id,
                    currency
                ) VALUES (
                    target_user_id,
                    CASE WHEN is_duplicate_check THEN NEW.description || ' (Compartilhado) [DUPLICIDADE?]' ELSE NEW.description || ' (Compartilhado)' END,
                    split_amount, 
                    NEW.type,
                    NEW.date,
                    sanitized_category,
                    NULL, 
                    payer_member_id_in_target,
                    FALSE, 
                    FALSE, 
                    sanitized_trip_id,
                    NEW.id,
                    NEW.currency
                );
            
            ELSIF (TG_OP = 'UPDATE') THEN
                UPDATE transactions
                SET 
                    amount = split_amount, 
                    date = NEW.date,
                    description = NEW.description || ' (Compartilhado)',
                    category = sanitized_category,
                    trip_id = sanitized_trip_id,
                    currency = NEW.currency
                WHERE mirror_transaction_id = NEW.id 
                  AND user_id = target_user_id;
                  
                -- Acumula IDs de usuários válidos para checagem de un-sharing
                shared_with_ids := array_append(shared_with_ids, target_user_id);
            END IF;

        END IF;
    END LOOP;

    -- ==================================================================================
    -- TRATAMENTO DE UN-SHARING E DELETE
    -- ==================================================================================
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM transactions WHERE mirror_transaction_id = OLD.id;
    END IF;

    -- UN-SHARING NO UPDATE
    -- Deleta sombras cujos donos NÃO estão mais na lista de shared_with_ids coletada acima
    IF (TG_OP = 'UPDATE') AND shared_with_ids IS NOT NULL THEN
        DELETE FROM transactions 
        WHERE mirror_transaction_id = NEW.id 
          AND user_id != ALL(shared_with_ids); -- Remove quem saiu da lista
    END IF;

    RETURN NEW;
END;
$$;
