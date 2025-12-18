-- ==============================================================================
-- SCRIPT DE CORREÇÃO FINAL - SISTEMA 10/10
-- DATA: 2025-12-18
-- OBJETIVO: Corrigir todos os problemas identificados na análise global
-- ==============================================================================
-- 
-- INSTRUÇÕES:
-- 1. Acesse o Supabase Dashboard
-- 2. Vá em SQL Editor
-- 3. Cole este script COMPLETO
-- 4. Execute (Ctrl+Enter ou botão Run)
-- 5. Verifique se não há erros
--
-- ==============================================================================

-- ==============================================================================
-- PARTE 1: PADRONIZAR TIPOS DE CONTA (PORTUGUÊS)
-- ==============================================================================

-- Remover constraint antiga (se existir)
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS check_account_type;

-- Converter TODOS os valores para português padronizado
UPDATE accounts SET type = 'CONTA CORRENTE' WHERE UPPER(type) IN ('CHECKING', 'CONTA CORRENTE', 'CONTACORRENTE');
UPDATE accounts SET type = 'POUPANÇA' WHERE UPPER(type) IN ('SAVINGS', 'POUPANCA', 'POUPANÇA');
UPDATE accounts SET type = 'CARTÃO DE CRÉDITO' WHERE UPPER(type) IN ('CREDIT_CARD', 'CREDITCARD', 'CARTAO DE CREDITO', 'CARTÃO DE CRÉDITO');
UPDATE accounts SET type = 'DINHEIRO' WHERE UPPER(type) IN ('CASH', 'DINHEIRO');
UPDATE accounts SET type = 'INVESTIMENTOS' WHERE UPPER(type) IN ('INVESTMENT', 'INVESTMENTS', 'INVESTIMENTOS', 'INVESTIMENTO');
UPDATE accounts SET type = 'OUTROS' WHERE UPPER(type) IN ('OTHER', 'OTHERS', 'OUTROS', 'LOAN', 'EMPRESTIMO', 'EMPRÉSTIMO');

-- Adicionar nova constraint com valores em português
ALTER TABLE accounts
ADD CONSTRAINT check_account_type
CHECK (type IN (
    'CONTA CORRENTE',
    'POUPANÇA', 
    'CARTÃO DE CRÉDITO',
    'DINHEIRO',
    'INVESTIMENTOS',
    'OUTROS'
));

-- ==============================================================================
-- PARTE 2: CORRIGIR TRIGGER DE SALDO (COM SUPORTE A REFUND)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- DELETE ou UPDATE: Reverter efeito da transação antiga
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Ignorar se for dívida compartilhada (outro pagou)
        IF NOT (OLD.is_shared IS TRUE AND OLD.payer_id IS NOT NULL AND OLD.payer_id != 'me' AND OLD.payer_id != OLD.user_id::text) THEN
            
            -- RECEITA
            IF (OLD.type = 'RECEITA') THEN
                IF (OLD.is_refund IS TRUE) THEN
                    -- Refund de receita: era negativo, reverter = adicionar
                    UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                ELSE
                    -- Receita normal: era positivo, reverter = subtrair
                    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id::uuid;
                END IF;
                
            -- DESPESA
            ELSIF (OLD.type = 'DESPESA') THEN
                IF (OLD.is_refund IS TRUE) THEN
                    -- Refund de despesa: era positivo (devolução), reverter = subtrair
                    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id::uuid;
                ELSE
                    -- Despesa normal: era negativo, reverter = adicionar
                    UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                END IF;
                
            -- TRANSFERÊNCIA
            ELSIF (OLD.type = 'TRANSFERÊNCIA') THEN
                UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                IF OLD.destination_account_id IS NOT NULL THEN
                    UPDATE public.accounts 
                    SET balance = balance - COALESCE(OLD.destination_amount, OLD.amount)
                    WHERE id = OLD.destination_account_id::uuid;
                END IF;
            END IF;
        END IF;
    END IF;

    -- INSERT ou UPDATE: Aplicar efeito da transação nova
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Ignorar se for dívida compartilhada (outro pagou)
        IF NOT (NEW.is_shared IS TRUE AND NEW.payer_id IS NOT NULL AND NEW.payer_id != 'me' AND NEW.payer_id != NEW.user_id::text) THEN
            
            -- RECEITA
            IF (NEW.type = 'RECEITA') THEN
                IF (NEW.is_refund IS TRUE) THEN
                    -- Refund de receita: devolução de algo que recebi = subtrair
                    UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                ELSE
                    -- Receita normal: adicionar
                    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id::uuid;
                END IF;
                
            -- DESPESA
            ELSIF (NEW.type = 'DESPESA') THEN
                IF (NEW.is_refund IS TRUE) THEN
                    -- Refund de despesa: devolução de algo que paguei = adicionar
                    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id::uuid;
                ELSE
                    -- Despesa normal: subtrair
                    UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                END IF;
                
            -- TRANSFERÊNCIA
            ELSIF (NEW.type = 'TRANSFERÊNCIA') THEN
                UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                IF NEW.destination_account_id IS NOT NULL THEN
                    UPDATE public.accounts 
                    SET balance = balance + COALESCE(NEW.destination_amount, NEW.amount)
                    WHERE id = NEW.destination_account_id::uuid;
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 3: FUNÇÃO DE RECÁLCULO DE SALDOS (CORRIGIDA)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void AS $$
DECLARE
    r_account RECORD;
    v_calc_balance NUMERIC;
BEGIN
    -- Desabilitar trigger temporariamente
    ALTER TABLE public.transactions DISABLE TRIGGER trg_update_account_balance;

    FOR r_account IN SELECT id, initial_balance, user_id FROM public.accounts WHERE deleted = false LOOP
        
        v_calc_balance := COALESCE(r_account.initial_balance, 0);

        -- Receitas (considerando refunds)
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(
                CASE WHEN is_refund = TRUE THEN -amount ELSE amount END
            ), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'RECEITA'
            AND deleted = FALSE
        );

        -- Despesas (considerando refunds e dívidas compartilhadas)
        v_calc_balance := v_calc_balance - (
            SELECT COALESCE(SUM(
                CASE WHEN is_refund = TRUE THEN -amount ELSE amount END
            ), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'DESPESA'
            AND deleted = FALSE
            AND NOT (is_shared = TRUE AND payer_id IS NOT NULL AND payer_id != 'me' AND payer_id != user_id::text)
        );

        -- Transferências (Saída)
        v_calc_balance := v_calc_balance - (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'TRANSFERÊNCIA'
            AND deleted = FALSE
        );

        -- Transferências (Entrada)
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(COALESCE(destination_amount, amount)), 0)
            FROM public.transactions
            WHERE destination_account_id::uuid = r_account.id 
            AND type = 'TRANSFERÊNCIA'
            AND deleted = FALSE
        );

        UPDATE public.accounts SET balance = v_calc_balance WHERE id = r_account.id;
        
    END LOOP;

    -- Reabilitar trigger
    ALTER TABLE public.transactions ENABLE TRIGGER trg_update_account_balance;
END;
$$ LANGUAGE plpgsql;

-- ==============================================================================
-- PARTE 4: ÍNDICES DE PERFORMANCE OTIMIZADOS
-- ==============================================================================

-- Índice principal para transações (mais usado)
DROP INDEX IF EXISTS idx_transactions_user_date_range;
CREATE INDEX idx_transactions_user_date_range 
ON public.transactions(user_id, date DESC)
WHERE deleted = false;

-- Índice para transações por conta
DROP INDEX IF EXISTS idx_transactions_account_date;
CREATE INDEX idx_transactions_account_date
ON public.transactions(account_id, date DESC)
WHERE deleted = false AND account_id IS NOT NULL;

-- Índice para transações compartilhadas não liquidadas
DROP INDEX IF EXISTS idx_transactions_unsettled_shared;
CREATE INDEX idx_transactions_unsettled_shared
ON public.transactions(user_id, is_settled, date DESC)
WHERE deleted = false AND is_settled = false AND (is_shared = true OR shared_with IS NOT NULL);

-- Índice para séries de parcelas
DROP INDEX IF EXISTS idx_transactions_series;
CREATE INDEX idx_transactions_series
ON public.transactions(series_id)
WHERE series_id IS NOT NULL AND deleted = false;

-- Índice para contas ativas
DROP INDEX IF EXISTS idx_accounts_user_active;
CREATE INDEX idx_accounts_user_active
ON public.accounts(user_id, type, currency)
WHERE deleted = false;

-- Índice para viagens
DROP INDEX IF EXISTS idx_trips_user_active;
CREATE INDEX idx_trips_user_active
ON public.trips(user_id, start_date DESC)
WHERE deleted = false;

-- ==============================================================================
-- PARTE 5: EXECUTAR RECÁLCULO DE SALDOS
-- ==============================================================================

SELECT public.recalculate_all_balances();

-- ==============================================================================
-- PARTE 6: ATUALIZAR ESTATÍSTICAS
-- ==============================================================================

ANALYZE public.transactions;
ANALYZE public.accounts;
ANALYZE public.trips;
ANALYZE public.family_members;
ANALYZE public.budgets;
ANALYZE public.goals;
ANALYZE public.assets;

-- ==============================================================================
-- VERIFICAÇÃO FINAL
-- ==============================================================================

DO $$
DECLARE
    v_accounts INTEGER;
    v_transactions INTEGER;
    v_types TEXT;
    v_credit_cards INTEGER;
BEGIN
    SELECT COUNT(*) INTO v_accounts FROM accounts WHERE deleted = false;
    SELECT COUNT(*) INTO v_transactions FROM transactions WHERE deleted = false;
    SELECT string_agg(DISTINCT type, ', ') INTO v_types FROM accounts WHERE deleted = false;
    SELECT COUNT(*) INTO v_credit_cards FROM accounts WHERE deleted = false AND type = 'CARTÃO DE CRÉDITO';
    
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════════════════════════╗';
    RAISE NOTICE '║           ✅ CORREÇÕES APLICADAS COM SUCESSO!                ║';
    RAISE NOTICE '╠══════════════════════════════════════════════════════════════╣';
    RAISE NOTICE '║ 📊 Contas ativas: %', v_accounts;
    RAISE NOTICE '║ 📊 Transações ativas: %', v_transactions;
    RAISE NOTICE '║ 💳 Cartões de crédito: %', v_credit_cards;
    RAISE NOTICE '║ 📊 Tipos de conta: %', v_types;
    RAISE NOTICE '╚══════════════════════════════════════════════════════════════╝';
END $$;

-- Mostrar resumo das contas
SELECT 
    name as "Nome",
    type as "Tipo",
    currency as "Moeda",
    balance as "Saldo"
FROM accounts 
WHERE deleted = false 
ORDER BY type, name;
