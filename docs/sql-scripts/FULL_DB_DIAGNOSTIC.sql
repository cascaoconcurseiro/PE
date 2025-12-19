-- ============================================================================
-- DIAGNÓSTICO COMPLETO DO BANCO DE DADOS
-- ============================================================================
-- Execute CADA query separadamente e me envie os resultados
-- ============================================================================

-- ============================================================================
-- QUERY 1: TODAS AS TABELAS DO SCHEMA PUBLIC
-- ============================================================================
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
ORDER BY table_name;

-- ============================================================================
-- QUERY 2: TODAS AS FOREIGN KEYS DO BANCO (MAPA COMPLETO)
-- ============================================================================
SELECT 
    tc.constraint_name,
    tc.table_name as tabela_origem,
    kcu.column_name as coluna_origem,
    ccu.table_name AS tabela_destino,
    ccu.column_name AS coluna_destino,
    rc.delete_rule as on_delete,
    rc.update_rule as on_update
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
ORDER BY ccu.table_name, tc.table_name;

-- ============================================================================
-- QUERY 3: FKs QUE BLOQUEIAM DELEÇÃO (RESTRICT ou NO ACTION)
-- ============================================================================
SELECT 
    tc.constraint_name,
    tc.table_name as tabela_origem,
    kcu.column_name as coluna_origem,
    ccu.table_name AS tabela_destino,
    rc.delete_rule as on_delete
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
JOIN information_schema.referential_constraints AS rc
    ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_schema = 'public'
    AND rc.delete_rule IN ('RESTRICT', 'NO ACTION')
ORDER BY ccu.table_name;

-- ============================================================================
-- QUERY 4: CONTAGEM DE REGISTROS POR TABELA (para seu usuário)
-- Substitua o email pelo seu
-- ============================================================================
DO $$
DECLARE
    v_user_id uuid;
    v_count int;
    r record;
BEGIN
    -- Pegar user_id pelo email (SUBSTITUA SEU EMAIL)
    SELECT id INTO v_user_id FROM auth.users WHERE email = 'SEU_EMAIL_AQUI' LIMIT 1;
    
    IF v_user_id IS NULL THEN
        RAISE NOTICE 'Usuário não encontrado!';
        RETURN;
    END IF;
    
    RAISE NOTICE 'User ID: %', v_user_id;
    RAISE NOTICE '----------------------------------------';
    
    -- Verificar cada tabela
    FOR r IN 
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_type = 'BASE TABLE'
        ORDER BY table_name
    LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I WHERE user_id = $1', r.table_name) 
            INTO v_count USING v_user_id;
            IF v_count > 0 THEN
                RAISE NOTICE '%: % registros', r.table_name, v_count;
            END IF;
        EXCEPTION WHEN undefined_column THEN
            -- Tabela não tem user_id, ignorar
            NULL;
        END;
    END LOOP;
END $$;
