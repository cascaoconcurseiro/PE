-- Bloco anônimo para limpar e recriar as políticas
DO $$
DECLARE
    tables text[] := ARRAY[
        'accounts', 'transactions', 'trips', 'goals', 'budgets', 
        'assets', 'family_members', 'custom_categories', 'snapshots', 'audit_logs'
    ];
    t text;
BEGIN
    FOREACH t IN ARRAY tables
    LOOP
        -- 1. Remover TODAS as políticas conhecidas (limpeza)
        BEGIN
            EXECUTE format('DROP POLICY IF EXISTS "Users can CRUD own %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "Users can manage their own %I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "manage_own_%I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "anon_delete_%I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "anon_insert_%I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "anon_select_%I" ON public.%I', t, t);
            EXECUTE format('DROP POLICY IF EXISTS "anon_update_%I" ON public.%I', t, t);
            -- Tentar remover políticas genéricas comuns
            EXECUTE format('DROP POLICY IF EXISTS "Enable access for authenticated users only" ON public.%I', t);
            EXECUTE format('DROP POLICY IF EXISTS "Enable all for users based on user_id" ON public.%I', t);
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar erros se a política não existir
        END;

        -- 2. Garantir que RLS está ativado
        EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

        -- 3. Criar UMA ÚNICA política unificada e otimizada
        -- Usamos (select auth.uid()) para satisfazer o linter de performance
        BEGIN
            EXECUTE format('
                CREATE POLICY "owner_access_%I" ON public.%I
                FOR ALL
                TO authenticated
                USING (user_id = (select auth.uid()))
                WITH CHECK (user_id = (select auth.uid()))
            ', t, t);
        EXCEPTION WHEN duplicate_object THEN
            -- Se já existir com esse nome exato, ignorar
            RAISE NOTICE 'Policy owner_access_% already exists', t;
        END;
    END LOOP;

    -- 4. Tratamento Especial para user_profiles (que usa 'id' em vez de 'user_id')
    BEGIN
        DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
        DROP POLICY IF EXISTS "manage_own_profile" ON public.user_profiles;
        
        CREATE POLICY "owner_access_profiles" ON public.user_profiles
        FOR ALL
        TO authenticated
        USING (id = (select auth.uid()))
        WITH CHECK (id = (select auth.uid()));
    EXCEPTION WHEN duplicate_object THEN
        NULL;
    END;

END $$;