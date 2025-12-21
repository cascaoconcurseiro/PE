-- ==============================================================================
-- CHECK REPORTING VIEWS
-- DESCRIÇÃO: Consulta simples para visualizar o Balanço e DRE gerados.
-- ==============================================================================

SELECT '=== BALANÇO PATRIMONIAL (ATIVO vs PASSIVO) ===' as Report_Section;

SELECT 
    account_type, 
    account_name, 
    display_balance 
FROM public.view_balance_sheet
WHERE display_balance != 0
ORDER BY account_type, account_name;

SELECT '=== DRE (RESULTADO DO EXERCÍCIO) ===' as Report_Section;

SELECT 
    month_year,
    account_type, 
    SUM(period_amount) as total
FROM public.view_income_statement
GROUP BY month_year, account_type
ORDER BY month_year DESC, account_type;
