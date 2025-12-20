-- ==============================================================================
-- AUDITORIA: ERRO "operator does not exist: uuid = text"
-- DATA: 2025-12-19
-- ==============================================================================

-- ============================================================================
-- PARTE 1: VERIFICAR TIPOS DAS COLUNAS RELEVANTES
-- ============================================================================

SELECT 
    column_name, 
    data_type, 
    udt_name,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
  AND column_name IN ('id', 'user_id', 'payer_id', 'account_id', 'trip_id', 'series_id', 'source_transaction_id', 'destination_account_id')
ORDER BY column_name;

-- ============================================================================
-- PARTE 2: VERIFICAR TIPOS EM family_members
-- ============================================================================

SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'family_members'
  AND column_name IN ('id', 'user_id', 'linked_user_id')
ORDER BY column_name;

-- ============================================================================
-- PARTE 3: VERIFICAR TIPOS EM user_notifications
-- ============================================================================

SELECT 
    column_name, 
    data_type, 
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'user_notifications'
ORDER BY column_name;

-- ============================================================================
-- PARTE 4: LISTAR TODOS OS TRIGGERS NA TABELA transactions
-- ============================================================================

SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers
WHERE event_object_schema = 'public'
  AND event_object_table = 'transactions'
ORDER BY trigger_name;

-- ============================================================================
-- PARTE 5: VER CÓDIGO DAS FUNÇÕES DE TRIGGER
-- ============================================================================

-- Função notify_shared_transaction
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'notify_shared_transaction'
  AND routine_schema = 'public';

-- Função sync_shared_transaction  
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'sync_shared_transaction'
  AND routine_schema = 'public';

-- Função create_transaction
SELECT 
    routine_name,
    routine_definition
FROM information_schema.routines 
WHERE routine_name = 'create_transaction'
  AND routine_schema = 'public';

-- ============================================================================
-- PARTE 6: VERIFICAR OUTRAS FUNÇÕES QUE PODEM TER O PROBLEMA
-- ============================================================================

SELECT 
    routine_name,
    routine_type
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND (
    routine_name LIKE '%transaction%' 
    OR routine_name LIKE '%shared%'
    OR routine_name LIKE '%mirror%'
    OR routine_name LIKE '%notify%'
    OR routine_name LIKE '%balance%'
  )
ORDER BY routine_name;

-- ============================================================================
-- PARTE 7: TESTAR INSERÇÃO SIMPLES (SEM TRIGGERS)
-- ============================================================================

-- Desabilitar triggers temporariamente para teste
-- ALTER TABLE public.transactions DISABLE TRIGGER ALL;

-- Teste de inserção básica (não execute, apenas para referência)
-- INSERT INTO public.transactions (description, amount, type, category, date, user_id, is_shared, shared_with)
-- VALUES ('Teste', 100, 'DESPESA', 'Outros', CURRENT_DATE, auth.uid(), true, '[{"memberId": "xxx", "assignedAmount": 50, "percentage": 50}]'::jsonb);

-- Reabilitar triggers
-- ALTER TABLE public.transactions ENABLE TRIGGER ALL;
