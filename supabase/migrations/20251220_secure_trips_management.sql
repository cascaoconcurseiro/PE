-- ==============================================================================
-- SECURE TRIPS MANAGEMENT
-- DATA: 2025-12-20
-- OBJETIVO: 
--   1. Permitir que participantes editem campos colaborativos (itinerary, checklist, etc).
--   2. Bloquear alteração de campos críticos (name, dates, currency, participants) por não-donos.
--   3. Validar acesso via email do participante (auth.jwt() -> email).
-- ==============================================================================

BEGIN;

-- 1. REFORMULAR RPC update_trip PARA COOPERAÇÃO SEGURA
CREATE OR REPLACE FUNCTION public.update_trip(
    p_id UUID,
    p_name TEXT,
    p_description TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_currency TEXT,
    p_status TEXT,
    p_participants JSONB
)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_user_email TEXT := auth.jwt() ->> 'email';
    v_old_trip RECORD;
    v_is_owner BOOLEAN;
    v_is_participant BOOLEAN;
BEGIN
    -- Buscar dados atuais da viagem
    SELECT * INTO v_old_trip FROM public.trips WHERE id = p_id;

    IF v_old_trip IS NULL THEN
        RAISE EXCEPTION 'Viagem não encontrada.';
    END IF;

    -- Verificar permissões
    v_is_owner := (v_old_trip.user_id = v_user_id);
    v_is_participant := (v_old_trip.participants @> jsonb_build_array(jsonb_build_object('email', v_user_email)));

    IF NOT v_is_owner AND NOT v_is_participant THEN
        RAISE EXCEPTION 'Acesso negado. Você não é participante desta viagem.';
    END IF;

    -- 🚨 SEGURANÇA: Se for apenas participante, bloquear campos críticos
    IF NOT v_is_owner THEN
        IF (v_old_trip.name != p_name OR 
            v_old_trip.start_date != p_start_date OR 
            v_old_trip.end_date != p_end_date OR 
            v_old_trip.currency != p_currency OR 
            v_old_trip.participants IS DISTINCT FROM p_participants) THEN
            
            RAISE EXCEPTION 'Permissão negada. Apenas o dono da viagem pode alterar o nome, datas, moeda ou a lista de participantes.';
        END IF;
    END IF;

    -- Atualizar (Dono pode tudo, Participante só campos não-bloqueados acima)
    UPDATE public.trips
    SET
        name = p_name,
        description = p_description,
        start_date = p_start_date,
        end_date = p_end_date,
        currency = p_currency,
        status = p_status,
        participants = p_participants,
        updated_at = NOW()
    WHERE id = p_id;

END;
$$;

-- 2. POLÍTICA PARA DELETE (Garantir que só o dono deleta)
DROP POLICY IF EXISTS "Owners can manage own trips" ON public.trips;
CREATE POLICY "Owners can manage own trips"
ON public.trips
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3. POLÍTICA PARA UPDATE (Ajustar para permitir que a RPC SECURITY DEFINER funcione, mas bloquear via RLS caso tentem direto)
-- Já coberto por "Owners can manage own trips" (ALL using owner_id). 
-- A RPC SECURITY DEFINER ignora RLS, por isso as travas internas que colocamos acima são críticas.

COMMIT;
