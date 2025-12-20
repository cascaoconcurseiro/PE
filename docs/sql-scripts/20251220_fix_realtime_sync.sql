-- ==============================================================================
-- FIX REALTIME SYNC AND RLS PARTICIPANTS
-- DATA: 2025-12-20
-- OBJETIVO: Habilitar Supabase Realtime para tabelas críticas e permitir que 
--           participantes de viagens recebam atualizações via RLS.
-- ==============================================================================

-- 1. HABILITAR REALTIME PARA TABELAS CRÍTICAS
-- Adiciona as tabelas à publicação 'supabase_realtime' para que eventos de mudança sejam transmitidos.
DO $$
BEGIN
  -- Adicionar tabelas à publicação supabase_realtime de forma idempotente
  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'transactions') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'accounts') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.accounts;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'trips') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'family_members') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.family_members;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'user_notifications') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.user_notifications;
  END IF;
END $$;


-- 2. AJUSTAR RLS PARA VIAGENS (PERMITIR PARTICIPANTES)
DROP POLICY IF EXISTS "Users can CRUD own trips" ON public.trips;
DROP POLICY IF EXISTS "Users can view trips they own or participate in" ON public.trips;
DROP POLICY IF EXISTS "Owners can update own trips" ON public.trips;
DROP POLICY IF EXISTS "Owners can delete own trips" ON public.trips;
DROP POLICY IF EXISTS "Owners can insert trips" ON public.trips;

-- Política permissiva: Donos podem fazer tudo
CREATE POLICY "Owners can manage own trips"
ON public.trips
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política de visualização para participantes
CREATE POLICY "Participants can view trips"
ON public.trips
FOR SELECT
USING (
  participants @> jsonb_build_array(jsonb_build_object('email', auth.jwt() ->> 'email'))
);

-- 3. AJUSTAR RLS PARA TRANSAÇÕES (PERMITIR VISUALIZAÇÃO DE VIAGENS COMPARTILHADAS)
DROP POLICY IF EXISTS "Users can CRUD own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users can view transactions they own or associated trips" ON public.transactions;
DROP POLICY IF EXISTS "Users can manage own transactions" ON public.transactions;

-- Política permissiva: Donos podem fazer tudo
CREATE POLICY "Owners can manage own transactions"
ON public.transactions
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Política de visualização para participantes da viagem vinculada
CREATE POLICY "Participants can view trip transactions"
ON public.transactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.trips 
    WHERE public.trips.id = public.transactions.trip_id
    AND public.trips.participants @> jsonb_build_array(jsonb_build_object('email', auth.jwt() ->> 'email'))
  )
);

DO $$
BEGIN
    RAISE NOTICE '✅ Realtime configurado e políticas de RLS corrigidas (sem subquery auth.users)!';
END $$;


