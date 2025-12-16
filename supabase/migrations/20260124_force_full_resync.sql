-- ==============================================================================
-- FORCE FULL RESYNC & REPAIR
-- DATA: 2026-01-24
-- OBJ: Forçar a sincronização de TODO o histórico para corrigir falhas passadas.
--      1. Espelhar Viagens Antigas.
--      2. Corrigir Descrições de Transações Compartilhadas Antigas.
--      3. Sincronizar 'Status' do JSON com 'transaction_splits' (Correção do "Desfazer").
-- ==============================================================================

BEGIN;

-- 1. GARANTIR FUNÇÕES DE SYNC ESTÃO ATUALIZADAS (Idempotente)
-- ------------------------------------------------------------------------------
-- (Igual ao fix_trip_mirroring, mas vital para garantir que o loop abaixo funcione)

CREATE OR REPLACE FUNCTION public.sync_shared_trip(p_trip_id UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_trip_rec RECORD;
    v_participant JSONB;
    v_target_member_id UUID;
    v_target_user_id UUID;
    v_inviter_name TEXT;
BEGIN
    SELECT * INTO v_trip_rec FROM public.trips WHERE id = p_trip_id;
    IF v_trip_rec.participants IS NOT NULL AND jsonb_array_length(v_trip_rec.participants) > 0 THEN
        SELECT raw_user_meta_data->>'name' INTO v_inviter_name FROM auth.users WHERE id = v_trip_rec.user_id;
        FOR v_participant IN SELECT * FROM jsonb_array_elements(v_trip_rec.participants)
        LOOP
            IF (jsonb_typeof(v_participant) = 'string') THEN
                 v_target_member_id := (v_participant#>>'{}')::UUID;
            ELSE
                 v_target_member_id := (v_participant->>'id')::UUID;
            END IF;
            SELECT linked_user_id INTO v_target_user_id FROM public.family_members WHERE id = v_target_member_id;
            
            IF v_target_user_id IS NOT NULL AND v_target_user_id != v_trip_rec.user_id THEN
                -- Insere Cópia Espelho se não existir
                IF NOT EXISTS (SELECT 1 FROM public.trips WHERE source_trip_id = v_trip_rec.id AND user_id = v_target_user_id) THEN
                    INSERT INTO public.trips (
                        user_id, name, description, start_date, end_date, budget, currency, 
                        source_trip_id, status, created_at, updated_at
                    ) VALUES (
                        v_target_user_id,
                        v_trip_rec.name || ' (Convite)', 
                        v_trip_rec.description,
                        v_trip_rec.start_date,
                        v_trip_rec.end_date,
                        v_trip_rec.budget,
                        v_trip_rec.currency,
                        v_trip_rec.id, 
                        v_trip_rec.status,
                        NOW(), NOW()
                    );
                END IF;
            END IF;
        END LOOP;
    END IF;
END;
$$;


-- 2. LOOP DE REPARO: VIAGENS
-- ------------------------------------------------------------------------------
-- Reaplica lógica de espelhamento para TODAS as viagens existentes.
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.trips WHERE participants IS NOT NULL AND jsonb_array_length(participants) > 0 LOOP
        PERFORM public.sync_shared_trip(r.id);
    END LOOP;
END $$;


-- 3. LOOP DE REPARO: TRANSAÇÕES (DESCRIÇÃO + MIRRORING)
-- ------------------------------------------------------------------------------
-- Reaplica sync_shared_transaction para corrigir descrições (ex: "nome (Wesley)")
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT id FROM public.transactions WHERE is_shared = true AND shared_with IS NOT NULL AND jsonb_array_length(shared_with) > 0 LOOP
        -- Força re-sync (vai tentar inserir mirror se faltar, e atualizar descrição se estiver errada? 
        -- Nota: sync_shared_transaction original tem 'IF NOT EXISTS' e 'Description formatting'.
        -- Para corrigir descrição de itens JÁ CRIADOS, precisamos de UPDATE explícito aqui.
        NULL; -- sync_shared_transaction apenas INSERE novos. Não atualiza existentes.
        
        -- Vamos forçar o UPDATE da descrição dos mirrors existentes:
    END LOOP;
    
    -- Update em massa das descrições mal formatadas nos Mirrors
    UPDATE public.transactions t
    SET description = (
        SELECT origin.description || ' (' || COALESCE(NULLIF(u.raw_user_meta_data->>'name', ''), 'Alguém') || ')'
        FROM public.transactions origin
        JOIN auth.users u ON u.id = origin.user_id
        WHERE origin.user_id::text = t.payer_id -- Link via payer_id
        AND origin.date = t.date
        AND origin.amount = t.amount -- Heurística
        LIMIT 1
    )
    WHERE t.is_shared = true 
    AND t.payer_id IS NOT NULL 
    AND t.payer_id != 'me' 
    AND t.description NOT LIKE '%(%'; -- Só os que não têm sufixo ainda
    
    
    -- Executar Sync para criar mirrors que faltam
    FOR r IN SELECT id FROM public.transactions WHERE is_shared = true LOOP
        PERFORM public.sync_shared_transaction(r.id);
    END LOOP;
END $$;


-- 4. LOOP DE REPARO: SPLIT STATUS (UNDO FIX)
-- ------------------------------------------------------------------------------
-- Sincroniza tabela 'transaction_splits' com o JSON 'shared_with' das transações.
-- Corrige casos onde o JSON diz "Unpaid" mas o Split está "SETTLED".
DO $$
DECLARE
    t RECORD;
    v_split_json JSONB;
    v_member_id UUID;
    v_linked_user_id UUID;
    v_is_settled BOOLEAN;
BEGIN
    FOR t IN SELECT id, shared_with FROM public.transactions WHERE is_shared = true AND shared_with IS NOT NULL LOOP
        FOR v_split_json IN SELECT * FROM jsonb_array_elements(t.shared_with)
        LOOP
            v_member_id := (v_split_json->>'memberId')::UUID;
            v_is_settled := COALESCE((v_split_json->>'isSettled')::BOOLEAN, FALSE);
            
            -- Busca o usuário linkado (debtor)
            SELECT linked_user_id INTO v_linked_user_id FROM public.family_members WHERE id = v_member_id;

            IF v_linked_user_id IS NOT NULL THEN
                -- Se JSON diz isSettled=FALSE, força OPEN no banco
                IF v_is_settled = FALSE THEN
                    UPDATE public.transaction_splits
                    SET status = 'OPEN', payment_transaction_id = NULL
                    WHERE transaction_id = t.id 
                    AND debtor_id = v_linked_user_id
                    AND status = 'SETTLED'; -- Corrige apenas discrepância
                END IF;
                
                -- Se JSON diz isSettled=TRUE, força SETTLED (Se estiver open)
                -- (Opcional, mas bom para consistência)
                IF v_is_settled = TRUE THEN
                     UPDATE public.transaction_splits
                     SET status = 'SETTLED'
                     WHERE transaction_id = t.id
                     AND debtor_id = v_linked_user_id
                     AND status = 'OPEN';
                END IF;
            END IF;
        END LOOP;
    END LOOP;
END $$;

COMMIT;
