-- ==============================================================================
-- CORREÇÃO: Seguro - Carro
-- DATA: 2025-12-21
-- OBJETIVO: Aplicar correção para as parcelas de "Seguro - Carro"
-- ==============================================================================

-- PASSO 1: Diagnóstico inicial com o padrão correto
SELECT 'DIAGNÓSTICO INICIAL - SEGURO CARRO' as etapa, * FROM (
    SELECT 
        phase,
        status,
        message,
        details->>'user_a_visible_count' as user_a_count,
        details->>'user_b_visible_count' as user_b_count,
        details->>'total_problems' as problemas
    FROM public.diagnose_missing_installments('%Seguro - Carro%')
    WHERE phase IN ('COUNT_ANALYSIS', 'SUMMARY')
) sub;

-- PASSO 2: Simulação da correção (DRY-RUN)
SELECT 'SIMULAÇÃO DE CORREÇÃO - SEGURO CARRO' as etapa, * FROM (
    SELECT 
        action,
        message,
        success,
        old_user_id,
        new_user_id,
        old_deleted,
        new_deleted
    FROM public.fix_missing_installments('%Seguro - Carro%', true)
) sub;

-- PASSO 3: Aplicar correção real (DESCOMENTE PARA EXECUTAR)
-- SELECT 'CORREÇÃO APLICADA - SEGURO CARRO' as etapa, * FROM (
--     SELECT 
--         action,
--         message,
--         success,
--         old_user_id,
--         new_user_id,
--         old_deleted,
--         new_deleted
--     FROM public.fix_missing_installments('%Seguro - Carro%', false)
-- ) sub;

-- PASSO 4: Diagnóstico final (DESCOMENTE APÓS APLICAR CORREÇÃO)
-- SELECT 'DIAGNÓSTICO FINAL - SEGURO CARRO' as etapa, * FROM (
--     SELECT 
--         phase,
--         status,
--         message,
--         details->>'user_b_visible_count' as parcelas_visiveis_agora
--     FROM public.diagnose_missing_installments('%Seguro - Carro%')
--     WHERE phase = 'SUMMARY'
-- ) sub;