-- ==============================================================================
-- AUDITORIA E LIMPEZA DE TRIGGERS
-- DATA: 2025-12-19
-- ==============================================================================

-- ============================================================================
-- PARTE 1: LISTAR TODOS OS TRIGGERS POR TABELA
-- ============================================================================

SELECT 
    event_object_table as tabela,
    trigger_name,
    event_manipulation as evento,
    action_timing as quando,
    action_statement as funcao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name, event_manipulation;

-- ============================================================================
-- PARTE 2: IDENTIFICAR TRIGGERS DUPLICADOS (mesmo nome, múltiplos eventos)
-- ============================================================================

SELECT 
    event_object_table as tabela,
    trigger_name,
    STRING_AGG(event_manipulation, ', ' ORDER BY event_manipulation) as eventos,
    action_statement as funcao
FROM information_schema.triggers
WHERE trigger_schema = 'public'
GROUP BY event_object_table, trigger_name, action_statement
ORDER BY event_object_table, trigger_name;

-- ============================================================================
-- PARTE 3: LISTAR FUNÇÕES DE TRIGGER EXISTENTES
-- ============================================================================

SELECT 
    routine_name as funcao,
    routine_type as tipo
FROM information_schema.routines 
WHERE routine_schema = 'public'
  AND routine_type = 'FUNCTION'
  AND (
    routine_name LIKE 'fn_%'
    OR routine_name LIKE 'handle_%'
    OR routine_name LIKE 'notify_%'
    OR routine_name LIKE 'sync_%'
    OR routine_name LIKE 'validate_%'
    OR routine_name LIKE 'audit_%'
    OR routine_name LIKE 'update_%'
    OR routine_name LIKE 'process_%'
    OR routine_name LIKE 'log_%'
  )
ORDER BY routine_name;
