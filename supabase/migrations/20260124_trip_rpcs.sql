-- ==============================================================================
-- TRIPS RPC LAYER
-- DATE: 2026-01-24
-- PURPOSE: Move Trip operations to RPCs to ensure RLS bypass and strict validation (Backend-Centric).
-- ==============================================================================

BEGIN;

-- 1. CREATE TRIP RPC
CREATE OR REPLACE FUNCTION public.create_trip(
    p_name TEXT,
    p_description TEXT,
    p_start_date DATE,
    p_end_date DATE,
    p_currency TEXT,
    p_status TEXT DEFAULT 'PLANNED',
    p_participants JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_id UUID;
    v_user_id UUID := auth.uid();
BEGIN
    INSERT INTO public.trips (
        user_id,
        name,
        description,
        start_date,
        end_date,
        currency,
        status,
        participants,
        created_at,
        updated_at
    ) VALUES (
        v_user_id,
        p_name,
        p_description,
        p_start_date,
        p_end_date,
        p_currency,
        p_status,
        p_participants,
        NOW(),
        NOW()
    ) RETURNING id INTO v_new_id;

    RETURN v_new_id;
END;
$$;

-- 2. UPDATE TRIP RPC
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
BEGIN
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
    WHERE id = p_id AND user_id = v_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Trip not found or access denied.';
    END IF;
END;
$$;

NOTIFY pgrst, 'reload schema';

COMMIT;
