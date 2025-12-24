-- ==============================================================================
-- MIGRATION: CREATE TRIP FUNCTION
-- DATA: 2026-02-23
-- DESCRIÇÃO: Implementa função create_trip que estava faltando
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- FUNÇÃO: create_trip
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_trip(
    p_name TEXT,
    p_start_date DATE DEFAULT NULL,
    p_end_date DATE DEFAULT NULL,
    p_description TEXT DEFAULT NULL,
    p_budget NUMERIC DEFAULT 0,
    p_currency TEXT DEFAULT 'BRL'
)
RETURNS UUID AS $$
DECLARE
    v_user_id UUID := auth.uid();
    v_trip_id UUID;
BEGIN
    -- Validações
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado';
    END IF;
    
    IF p_name IS NULL OR TRIM(p_name) = '' THEN
        RAISE EXCEPTION 'Nome da viagem é obrigatório';
    END IF;
    
    IF p_start_date IS NOT NULL AND p_end_date IS NOT NULL AND p_end_date < p_start_date THEN
        RAISE EXCEPTION 'Data de término não pode ser anterior à data de início';
    END IF;
    
    IF p_budget < 0 THEN
        RAISE EXCEPTION 'Orçamento não pode ser negativo';
    END IF;
    
    -- Criar viagem
    INSERT INTO public.trips (
        user_id,
        name,
        start_date,
        end_date,
        description,
        budget,
        currency,
        status,
        participants,
        itinerary,
        checklist,
        shopping_list,
        exchange_entries,
        created_at,
        updated_at,
        deleted,
        sync_status
    ) VALUES (
        v_user_id,
        TRIM(p_name),
        p_start_date,
        p_end_date,
        p_description,
        COALESCE(p_budget, 0),
        COALESCE(p_currency, 'BRL'),
        'PLANNED',
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        '[]'::jsonb,
        NOW(),
        NOW(),
        false,
        'SYNCED'
    ) RETURNING id INTO v_trip_id;
    
    -- Log da operação
    INSERT INTO public.audit_logs (
        user_id,
        entity,
        entity_id,
        action,
        changes,
        created_at
    ) VALUES (
        v_user_id,
        'trips',
        v_trip_id::text,
        'CREATE',
        jsonb_build_object(
            'name', p_name,
            'start_date', p_start_date,
            'end_date', p_end_date,
            'budget', p_budget,
            'currency', p_currency
        ),
        NOW()
    );
    
    RETURN v_trip_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- COMENTÁRIOS E PERMISSÕES
-- ==============================================================================

COMMENT ON FUNCTION public.create_trip(TEXT, DATE, DATE, TEXT, NUMERIC, TEXT) IS 
'Cria uma nova viagem para o usuário autenticado. Retorna o ID da viagem criada.';

-- Conceder permissões
GRANT EXECUTE ON FUNCTION public.create_trip(TEXT, DATE, DATE, TEXT, NUMERIC, TEXT) TO authenticated;

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
FUNÇÃO IMPLEMENTADA:

create_trip(
    p_name TEXT,                    -- Nome da viagem (obrigatório)
    p_start_date DATE DEFAULT NULL, -- Data de início (opcional)
    p_end_date DATE DEFAULT NULL,   -- Data de término (opcional)
    p_description TEXT DEFAULT NULL,-- Descrição (opcional)
    p_budget NUMERIC DEFAULT 0,     -- Orçamento (opcional, padrão 0)
    p_currency TEXT DEFAULT 'BRL'   -- Moeda (opcional, padrão BRL)
) RETURNS UUID

VALIDAÇÕES:
- Usuário deve estar autenticado
- Nome é obrigatório e não pode ser vazio
- Data de término não pode ser anterior à data de início
- Orçamento não pode ser negativo

COMPORTAMENTO:
- Cria viagem com status 'PLANNED'
- Inicializa arrays vazios para participants, itinerary, checklist, shopping_list, exchange_entries
- Registra operação em audit_logs
- Retorna UUID da viagem criada

EXEMPLO DE USO:
SELECT create_trip(
    'Viagem para Paris',
    '2024-06-01'::DATE,
    '2024-06-15'::DATE,
    'Férias de verão',
    5000.00,
    'EUR'
);
*/
