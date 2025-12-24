-- ============================================================================
-- SCRIPT FINAL - EXECUTAR NO SUPABASE DASHBOARD
-- ============================================================================
-- COPIE E COLE TODO ESTE ARQUIVO NO SQL EDITOR DO SUPABASE
-- ============================================================================

-- PASSO 1: Mostrar todas as parcelas atuais (ANTES de deletar)
SELECT 
    'ANTES DE DELETAR' as status,
    COUNT(*) as total_parcelas,
    COUNT(DISTINCT series_id) as total_series
FROM transactions 
WHERE is_installment = true;

-- PASSO 2: Deletar TODAS as parcelas antigas
DELETE FROM transactions 
WHERE is_installment = true;

-- PASSO 3: Verificar se deletou (deve retornar 0)
SELECT 
    'DEPOIS DE DELETAR' as status,
    COUNT(*) as total_parcelas
FROM transactions 
WHERE is_installment = true;

-- PASSO 4: Verificar quantas versões da função existem (deve ser 1)
SELECT 
    'VERIFICACAO FUNCAO' as status,
    COUNT(*) as total_funcoes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'create_financial_record';

-- PASSO 5: Se retornou 2 funções acima, execute isto para remover a antiga:
DROP FUNCTION IF EXISTS public.create_financial_record(
    UUID, NUMERIC, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, UUID, UUID, JSONB, UUID, TEXT
);

-- PASSO 6: Verificar novamente (agora deve ser 1)
SELECT 
    'APOS REMOVER FUNCAO ANTIGA' as status,
    COUNT(*) as total_funcoes
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'create_financial_record';

-- ============================================================================
-- RESULTADO ESPERADO:
-- - ANTES DE DELETAR: Mostra quantas parcelas existiam
-- - DEPOIS DE DELETAR: 0 parcelas
-- - VERIFICACAO FUNCAO: 1 ou 2 funções
-- - APOS REMOVER FUNCAO ANTIGA: 1 função
-- ============================================================================

-- PASSO 7: Mostrar a assinatura da função (deve ter 16 parâmetros)
SELECT 
    'ASSINATURA DA FUNCAO' as status,
    pg_get_function_arguments(p.oid) as parametros
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'public' 
  AND p.proname = 'create_financial_record';

-- ============================================================================
-- IMPORTANTE: Depois de executar este script:
-- 1. Recarregue a aplicação (Ctrl+Shift+R)
-- 2. Crie uma nova transação parcelada
-- 3. Verifique se criou corretamente
-- ============================================================================
