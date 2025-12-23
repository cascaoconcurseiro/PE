-- ==============================================================================
-- MIGRATION: CORREÇÃO DE TIPOS DE CONTA
-- DATA: 2026-02-18
-- OBJETIVO: Padronizar tipos de conta entre frontend e banco de dados
-- ==============================================================================

-- PROBLEMA IDENTIFICADO:
-- Frontend usa: 'CARTÃO DE CRÉDITO', 'CONTA CORRENTE', 'POUPANÇA', etc.
-- Banco tinha constraint: 'CREDIT_CARD', 'CHECKING', 'SAVINGS', etc.
-- Isso causava falha na identificação de cartões e cálculo de fatura

BEGIN;

-- ==============================================================================
-- PARTE 1: REMOVER CONSTRAINT ANTIGA (SE EXISTIR)
-- ==============================================================================

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS check_account_type;

-- ==============================================================================
-- PARTE 2: ATUALIZAR VALORES EXISTENTES PARA PORTUGUÊS
-- ==============================================================================

-- Converter valores em inglês para português (se houver)
UPDATE accounts SET type = 'CONTA CORRENTE' WHERE type = 'CHECKING';
UPDATE accounts SET type = 'POUPANÇA' WHERE type = 'SAVINGS';
UPDATE accounts SET type = 'CARTÃO DE CRÉDITO' WHERE type = 'CREDIT_CARD';
UPDATE accounts SET type = 'DINHEIRO' WHERE type = 'CASH';
UPDATE accounts SET type = 'INVESTIMENTOS' WHERE type = 'INVESTMENT';
UPDATE accounts SET type = 'EMPRÉSTIMO' WHERE type = 'LOAN';
UPDATE accounts SET type = 'OUTROS' WHERE type = 'OTHER';

-- ==============================================================================
-- PARTE 3: ADICIONAR NOVA CONSTRAINT COM VALORES EM PORTUGUÊS
-- ==============================================================================

ALTER TABLE accounts
ADD CONSTRAINT check_account_type
CHECK (type IN (
    'CONTA CORRENTE',
    'POUPANÇA', 
    'CARTÃO DE CRÉDITO',
    'DINHEIRO',
    'INVESTIMENTOS',
    'EMPRÉSTIMO',
    'OUTROS'
));

-- ==============================================================================
-- PARTE 4: VERIFICAR RESULTADO
-- ==============================================================================

DO $$
DECLARE
    v_count INTEGER;
BEGIN
    SELECT COUNT(DISTINCT type) INTO v_count FROM accounts WHERE deleted = false;
    RAISE NOTICE 'Tipos de conta distintos após migração: %', v_count;
    
    -- Listar tipos
    FOR r IN SELECT DISTINCT type, COUNT(*) as cnt FROM accounts WHERE deleted = false GROUP BY type LOOP
        RAISE NOTICE 'Tipo: % - Quantidade: %', r.type, r.cnt;
    END LOOP;
END $$;

COMMIT;

-- ==============================================================================
-- NOTAS:
-- ==============================================================================
-- 1. Esta migração padroniza os tipos de conta para português
-- 2. O frontend já usa os valores em português (AccountType enum)
-- 3. Após esta migração, o cálculo de fatura do cartão deve funcionar
-- ==============================================================================
