-- ==============================================================================
-- MIGRATION: DDD FINANCIAL REPORTING (VIEWS)
-- DATA: 2026-02-02
-- DESCRIÇÃO: Criação de Views Contábeis baseadas no Ledger DDD.
--            1. view_balance_sheet (Balanço Patrimonial: Ativo vs Passivo)
--            2. view_income_statement (DRE: Receitas vs Despesas)
-- ==============================================================================

-- 1. VIEW: BALANÇO PATRIMONIAL (BALANCE SHEET)
-- Mostra a posição financeira em tempo real (Accumulated Balance)
CREATE OR REPLACE VIEW public.view_balance_sheet AS
SELECT 
    ca.user_id,
    ca.type AS account_type, -- ASSET, LIABILITY, EQUITY
    ca.name AS account_name,
    ca.code,
    -- Saldo: Debits - Credits (Para Ativos) ou Credits - Debits (Para Passivos/PL)
    -- Mas para simplicidade visual, vamos manter:
    -- Normatização: Positive = Asset Value / Liability Value.
    SUM(
        CASE 
            WHEN le.debit_account_id = ca.id THEN le.amount 
            ELSE 0 
        END
    ) - 
    SUM(
        CASE 
            WHEN le.credit_account_id = ca.id THEN le.amount 
            ELSE 0 
        END
    ) AS raw_balance,
    
    -- Saldo Normalizado (Display)
    CASE 
        WHEN ca.type IN ('ASSET', 'EXPENSE') THEN 
            (SUM(CASE WHEN le.debit_account_id = ca.id THEN le.amount ELSE 0 END) - SUM(CASE WHEN le.credit_account_id = ca.id THEN le.amount ELSE 0 END))
        ELSE 
            (SUM(CASE WHEN le.credit_account_id = ca.id THEN le.amount ELSE 0 END) - SUM(CASE WHEN le.debit_account_id = ca.id THEN le.amount ELSE 0 END))
    END AS display_balance

FROM public.chart_of_accounts ca
LEFT JOIN public.ledger_entries le ON (ca.id = le.debit_account_id OR ca.id = le.credit_account_id)
WHERE ca.deleted = FALSE AND ca.type IN ('ASSET', 'LIABILITY', 'EQUITY')
GROUP BY ca.user_id, ca.type, ca.name, ca.code;


-- 2. VIEW: DEMONSTRATIVO DE RESULTADO (INCOME STATEMENT - DRE)
-- Mostra o fluxo (Receita - Despesa) por Período
CREATE OR REPLACE VIEW public.view_income_statement AS
SELECT 
    ca.user_id,
    ca.type AS account_type, -- REVENUE, EXPENSE
    ca.name AS account_name,
    TO_CHAR(le.occurred_at, 'YYYY-MM') AS month_year,
    
    -- DRE sempre olha MOVIMENTO (Crédito = Receita, Débito = Despesa)
    CASE 
        WHEN ca.type = 'REVENUE' THEN 
            SUM(CASE WHEN le.credit_account_id = ca.id THEN le.amount ELSE -le.amount END)
        ELSE 
            SUM(CASE WHEN le.debit_account_id = ca.id THEN le.amount ELSE -le.amount END)
    END AS period_amount

FROM public.chart_of_accounts ca
JOIN public.ledger_entries le ON (ca.id = le.debit_account_id OR ca.id = le.credit_account_id)
WHERE ca.deleted = FALSE AND ca.type IN ('REVENUE', 'EXPENSE')
GROUP BY ca.user_id, ca.type, ca.name, TO_CHAR(le.occurred_at, 'YYYY-MM');
