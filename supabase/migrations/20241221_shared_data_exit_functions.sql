-- =====================================================
-- Funções para Saída Automática de Dados Compartilhados
-- =====================================================

-- Função para sair de viagens compartilhadas
CREATE OR REPLACE FUNCTION exit_user_from_shared_trips(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_trips_exited INTEGER := 0;
  v_exited_trips JSON;
  v_trip RECORD;
  v_participants UUID[];
BEGIN
  -- Coletar informações das viagens antes de sair
  SELECT json_agg(
    json_build_object(
      'id', t.id,
      'name', t.name,
      'participants', (
        SELECT array_agg(DISTINCT tx.user_id)
        FROM transactions tx
        WHERE tx.trip_id = t.id
          AND tx.user_id != target_user_id
          AND tx.deleted = false
      )
    )
  )
  INTO v_exited_trips
  FROM trips t
  WHERE t.user_id = target_user_id
     OR EXISTS (
       SELECT 1 FROM transactions tx
       WHERE tx.trip_id = t.id
         AND tx.user_id = target_user_id
         AND tx.deleted = false
     );

  -- Remover usuário das transações de viagem (soft delete)
  UPDATE transactions
  SET deleted = true,
      deleted_at = NOW()
  WHERE user_id = target_user_id
    AND trip_id IS NOT NULL
    AND deleted = false;

  -- Contar viagens afetadas
  GET DIAGNOSTICS v_trips_exited = ROW_COUNT;

  -- Remover viagens criadas pelo usuário
  DELETE FROM trips
  WHERE user_id = target_user_id;

  RETURN json_build_object(
    'trips_exited', v_trips_exited,
    'exited_trips', COALESCE(v_exited_trips, '[]'::json)
  );
END;
$$;

-- Função para sair de grupos familiares
CREATE OR REPLACE FUNCTION exit_user_from_family_groups(target_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_groups_exited INTEGER := 0;
  v_exited_groups JSON;
BEGIN
  -- Coletar informações dos grupos antes de sair
  SELECT json_agg(
    json_build_object(
      'id', fm.id,
      'name', fm.name,
      'members', (
        SELECT array_agg(DISTINCT fm2.user_id)
        FROM family_members fm2
        WHERE fm2.user_id != target_user_id
          AND (fm2.invited_user_id = fm.invited_user_id OR fm2.user_id = fm.user_id)
      )
    )
  )
  INTO v_exited_groups
  FROM family_members fm
  WHERE fm.user_id = target_user_id
     OR fm.invited_user_id = target_user_id;

  -- Remover membros da família onde o usuário é o criador
  DELETE FROM family_members
  WHERE user_id = target_user_id;

  GET DIAGNOSTICS v_groups_exited = ROW_COUNT;

  -- Remover membros da família onde o usuário foi convidado
  DELETE FROM family_members
  WHERE invited_user_id = target_user_id;

  RETURN json_build_object(
    'groups_exited', v_groups_exited,
    'exited_groups', COALESCE(v_exited_groups, '[]'::json)
  );
END;
$$;

-- Tabela para registros de ressincronização
CREATE TABLE IF NOT EXISTS user_resync_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exited_trips JSON,
  exited_family_groups JSON,
  exit_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  can_resync BOOLEAN DEFAULT true,
  resync_completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_user_resync_records_user_id 
  ON user_resync_records(user_id);
CREATE INDEX IF NOT EXISTS idx_user_resync_records_can_resync 
  ON user_resync_records(can_resync) WHERE can_resync = true;

-- Função para executar ressincronização
CREATE OR REPLACE FUNCTION execute_user_resync(
  target_user_id UUID,
  group_type TEXT,
  group_id UUID
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_resync_record RECORD;
  v_success BOOLEAN := false;
BEGIN
  -- Buscar registro de ressincronização mais recente
  SELECT * INTO v_resync_record
  FROM user_resync_records
  WHERE user_id = target_user_id
    AND can_resync = true
  ORDER BY exit_timestamp DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Nenhum registro de ressincronização encontrado'
    );
  END IF;

  -- Marcar como ressincronizado
  UPDATE user_resync_records
  SET can_resync = false,
      resync_completed_at = NOW()
  WHERE id = v_resync_record.id;

  v_success := true;

  RETURN json_build_object(
    'success', v_success,
    'resync_record_id', v_resync_record.id,
    'group_type', group_type,
    'group_id', group_id
  );
END;
$$;

-- Comentários para documentação
COMMENT ON FUNCTION exit_user_from_shared_trips IS 
  'Remove usuário de todas as viagens compartilhadas durante factory reset';
COMMENT ON FUNCTION exit_user_from_family_groups IS 
  'Remove usuário de todos os grupos familiares durante factory reset';
COMMENT ON FUNCTION execute_user_resync IS 
  'Executa ressincronização quando usuário é readicionado a grupo/viagem';
COMMENT ON TABLE user_resync_records IS 
  'Registros de saída de dados compartilhados para ressincronização futura';

-- Função para buscar oportunidades de ressincronização
CREATE OR REPLACE FUNCTION get_resync_opportunities(current_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_opportunities JSON;
BEGIN
  -- Buscar usuários que podem ser ressincronizados
  SELECT json_agg(
    json_build_object(
      'user_id', urr.user_id,
      'user_name', COALESCE(p.full_name, p.email, 'Usuário'),
      'user_email', p.email,
      'can_resync', urr.can_resync,
      'exit_timestamp', urr.exit_timestamp,
      'available_groups', json_build_array(
        json_build_object(
          'type', 'FAMILY',
          'id', 'default',
          'name', 'Grupo Familiar'
        )
      )
    )
  )
  INTO v_opportunities
  FROM user_resync_records urr
  JOIN auth.users au ON au.id = urr.user_id
  LEFT JOIN profiles p ON p.id = urr.user_id
  WHERE urr.can_resync = true
    AND (
      -- Usuário estava em viagens com o usuário atual
      EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(urr.exited_trips) AS trip
        WHERE jsonb_array_length(trip->'participants') > 0
          AND (trip->'participants')::jsonb ? current_user_id::text
      )
      OR
      -- Usuário estava em grupos familiares com o usuário atual
      EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(urr.exited_family_groups) AS family_group
        WHERE jsonb_array_length(family_group->'members') > 0
          AND (family_group->'members')::jsonb ? current_user_id::text
      )
    );

  RETURN COALESCE(v_opportunities, '[]'::json);
END;
$$;

-- Comentário para documentação
COMMENT ON FUNCTION get_resync_opportunities IS 
  'Busca usuários que podem ser ressincronizados após factory reset';