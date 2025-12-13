-- ==============================================================================
-- MIGRATION: SHARED ENGINE V5 - TRIP AUTO-PROVISIONING & NOTIFICATIONS
-- DATA: 2025-12-13
-- DESCRIÇÃO: 
-- 1. Cria tabela de notificações REAIS.
-- 2. Atualiza motor de espelhamento para criar viagens automaticamente (Trip Cloning).
-- 3. Corrige BUG da descrição aparecendo como valor.
-- 4. Triggers para notificar usuários.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABELA DE NOTIFICAÇÕES
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('SYSTEM', 'INVITE', 'TRANSACTION', 'ALERT')),
    read_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    metadata JSONB DEFAULT '{}'::JSONB
);

-- Index para performance de busca
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON user_notifications(user_id) WHERE read_at IS NULL;

-- ------------------------------------------------------------------------------
-- 2. FUNÇÃO CORE ATUALIZADA (V5)
-- ------------------------------------------------------------------------------
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
    payer_member_id_in_target UUID;
    
    sanitized_trip_id UUID;
    source_trip_record RECORD;
    new_trip_id UUID;
    
    sanitized_category TEXT;
    final_description TEXT;
    is_duplicate_check BOOLEAN := FALSE;
    shared_with_ids UUID[];
    split_amount NUMERIC;
BEGIN
    -- GUARD CLAUSE 1: Prevenção de Loop Infinito
    IF NEW.mirror_transaction_id IS NOT NULL THEN
        -- Impedir edição financeira pelo receptor
        IF (TG_OP = 'UPDATE') AND (NEW.amount <> OLD.amount OR NEW.date <> OLD.date) THEN
             NEW.amount := OLD.amount;
             NEW.date := OLD.date;
             NEW.currency := OLD.currency;
             RETURN NEW;
        END IF;
        RETURN NEW;
    END IF;

    -- GUARD CLAUSE 2: Apenas transações compartilhadas
    IF NEW.is_shared IS NOT TRUE OR NEW.shared_with IS NULL OR jsonb_array_length(NEW.shared_with) = 0 THEN
        IF (TG_OP = 'UPDATE') AND OLD.is_shared IS TRUE THEN
            DELETE FROM transactions WHERE mirror_transaction_id = OLD.id;
        END IF;
        RETURN NEW;
    END IF;

    source_user_id := NEW.user_id;

    -- LOOP: Para cada membro compartilhado
    FOR shared_member_record IN SELECT * FROM jsonb_array_elements(NEW.shared_with)
    LOOP
        target_member_id := (shared_member_record->>'memberId')::UUID;
        
        -- Valor correto da divisão (fallback seguro para NEW.amount)
        split_amount := COALESCE((shared_member_record->>'assignedAmount')::NUMERIC, NEW.amount);

        SELECT linked_user_id INTO target_user_id
        FROM family_members
        WHERE id = target_member_id;

        IF target_user_id IS NOT NULL THEN
            
            -- CHECK BLOCK
            IF EXISTS (SELECT 1 FROM family_members WHERE user_id = target_user_id AND linked_user_id::UUID = source_user_id AND connection_status = 'BLOCKED') THEN
                RAISE EXCEPTION 'O usuário de destino bloqueou compartilhamentos.';
            END IF;

            -- RESOLUÇÃO DE QUEM PAGOU (Source na visão do Target)
            SELECT id INTO payer_member_id_in_target
            FROM family_members
            WHERE user_id = target_user_id AND linked_user_id::UUID = source_user_id
            LIMIT 1;

            -- Fallback: Se não existe relação, cria automaticamente (Conexão Auto)
            IF payer_member_id_in_target IS NULL THEN
                 INSERT INTO family_members (user_id, name, email, linked_user_id, role, connection_status)
                 SELECT 
                    target_user_id, 
                    COALESCE((SELECT raw_user_meta_data->>'name' FROM auth.users WHERE id = source_user_id), 'Parceiro'),
                    (SELECT email FROM auth.users WHERE id = source_user_id),
                    source_user_id,
                    'PARCEIRO(A)',
                    'ACTIVE'
                 RETURNING id INTO payer_member_id_in_target;
            END IF;

            -- =================================================================================
            -- TRIP LOGIC V2: AUTO-PROVISIONING (CLONAGEM DE VIAGEM)
            -- =================================================================================
            sanitized_trip_id := NULL;
            IF NEW.trip_id IS NOT NULL THEN
                -- Busca dados da viagem original com CAST seguro
                SELECT * INTO source_trip_record FROM trips WHERE id = NEW.trip_id::UUID;
                
                IF source_trip_record IS NOT NULL THEN
                    -- 1. Tenta achar viagem com MESMO NOME no destino
                    SELECT id INTO sanitized_trip_id
                    FROM trips
                    WHERE user_id = target_user_id 
                    AND name = source_trip_record.name
                    LIMIT 1;

                    -- 2. Se não achou, CRIA A VIAGEM para o destino (Espelho da Viagem)
                    IF sanitized_trip_id IS NULL THEN
                        INSERT INTO trips (
                            user_id, 
                            name, 
                            description, 
                            start_date, 
                            end_date, 
                            status, 
                            budget
                        ) VALUES (
                            target_user_id,
                            source_trip_record.name,
                            source_trip_record.description || ' (Compartilhada)',
                            source_trip_record.start_date,
                            source_trip_record.end_date,
                            'PLANNED', -- Status padrão
                            0 -- Orçamento zero inicial
                        ) RETURNING id INTO sanitized_trip_id;
                    END IF;
                END IF;
            END IF;

            sanitized_category := NEW.category; 
            
            -- FIX DESCRIÇÃO: Garante que texto é usado. Se vazio, usa categoria.
            final_description := COALESCE(NULLIF(NEW.description, ''), sanitized_category, 'Despesa Compartilhada');

            -- CRUD OPERATION
            IF (TG_OP = 'INSERT') THEN
                -- Soft Duplicate Check
                SELECT TRUE INTO is_duplicate_check
                FROM transactions t
                WHERE t.user_id = target_user_id
                  AND t.mirror_transaction_id IS NULL
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
                    payer_id,
                    is_shared,
                    is_settled,
                    trip_id, -- <--- AGORA PREENCHIDO COM AUTO-PROVISIONAMENTO
                    mirror_transaction_id,
                    currency
                ) VALUES (
                    target_user_id,
                    CASE WHEN is_duplicate_check THEN final_description || ' (Revise: Duplicado?)' ELSE final_description END,
                    split_amount, 
                    NEW.type,
                    NEW.date,
                    sanitized_category,
                    payer_member_id_in_target,
                    FALSE, 
                    FALSE, 
                    sanitized_trip_id,
                    NEW.id,
                    NEW.currency
                );

                -- NOTIFICATION TRIGGER (Insert Manual na tabela nova)
                INSERT INTO user_notifications (user_id, title, message, type, metadata)
                VALUES (
                    target_user_id,
                    'Nova Despesa Compartilhada',
                    format('%s compartilhou "%s": %s', (SELECT name FROM family_members WHERE id = payer_member_id_in_target), final_description, split_amount),
                    'TRANSACTION',
                    jsonb_build_object('transaction_id', NEW.id, 'amount', split_amount)
                );
            
            ELSIF (TG_OP = 'UPDATE') THEN
                UPDATE transactions
                SET 
                    amount = split_amount, 
                    date = NEW.date,
                    description = final_description,
                    category = sanitized_category,
                    trip_id = sanitized_trip_id,
                    currency = NEW.currency
                WHERE mirror_transaction_id = NEW.id 
                  AND user_id = target_user_id;
                  
                shared_with_ids := array_append(shared_with_ids, target_user_id);
            END IF;

        END IF;
    END LOOP;

    -- UN-SHARING E DELETE
    IF (TG_OP = 'DELETE') THEN
        DELETE FROM transactions WHERE mirror_transaction_id = OLD.id;
    END IF;

    IF (TG_OP = 'UPDATE') AND shared_with_ids IS NOT NULL THEN
        DELETE FROM transactions 
        WHERE mirror_transaction_id = NEW.id 
          AND user_id != ALL(shared_with_ids);
    END IF;

    RETURN NEW;
END;
$$;

-- ------------------------------------------------------------------------------
-- 3. FUNÇÃO RETROFIT (Cura de Dados Antigos)
-- ------------------------------------------------------------------------------
-- Esta função deve ser chamada manualmente uma vez
CREATE OR REPLACE FUNCTION fix_orphan_shared_trips()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
    rec RECORD;
    count_fixed INT := 0;
BEGIN
    FOR rec IN 
        SELECT id, description FROM transactions WHERE is_shared = TRUE AND trip_id IS NOT NULL AND mirror_transaction_id IS NULL
    LOOP
        -- Ao fazer update na descrição (mesmo valor), gatilha a trigger 'handle_transaction_mirroring_v4'
        -- A trigger V4 agora tem a lógica de Auto-Provisioning de Trip.
        -- Isso vai corrigir automaticamente as sombras orfãs de viagem.
        UPDATE transactions SET description = description WHERE id = rec.id;
        count_fixed := count_fixed + 1;
    END LOOP;
    RETURN format('Fixed %s shared transactions trips.', count_fixed);
END;
$$;
