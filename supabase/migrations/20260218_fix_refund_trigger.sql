-- ==============================================================================
-- MIGRATION: CORREÇÃO DO TRIGGER PARA REFUNDS
-- DATA: 2026-02-18
-- OBJETIVO: Tratar corretamente transações de reembolso (is_refund)
-- ==============================================================================

-- PROBLEMA IDENTIFICADO:
-- O trigger atual não considera is_refund
-- Um refund de despesa deveria ADICIONAR ao saldo, não subtrair
-- Um refund de receita deveria SUBTRAIR do saldo, não adicionar

BEGIN;

-- ==============================================================================
-- ATUALIZAR FUNÇÃO DE BALANCE
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- =========================================================================
    -- LÓGICA: Backend atualiza saldos automaticamente via trigger
    -- Frontend apenas lê account.balance (não recalcula)
    -- =========================================================================

    -- DELETE ou UPDATE: Reverter efeito da transação antiga
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Ignorar se for dívida compartilhada (outro pagou)
        IF NOT (OLD.is_shared IS TRUE AND OLD.payer_id IS NOT NULL AND OLD.payer_id != 'me' AND OLD.payer_id != OLD.user_id::text) THEN
            
            -- RECEITA
            IF (OLD.type = 'RECEITA') THEN
                IF (OLD.is_refund IS TRUE) THEN
                    -- Refund de receita: era subtração, reverter = adicionar
                    UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                ELSE
                    -- Receita normal: era adição, reverter = subtrair
                    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id::uuid;
                END IF;
                
            -- DESPESA
            ELSIF (OLD.type = 'DESPESA') THEN
                IF (OLD.is_refund IS TRUE) THEN
                    -- Refund de despesa: era adição, reverter = subtrair
                    UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id::uuid;
                ELSE
                    -- Despesa normal: era subtração, reverter = adicionar
                    UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                END IF;
                
            -- TRANSFERÊNCIA
            ELSIF (OLD.type = 'TRANSFERÊNCIA') THEN
                -- Reverter origem (devolver dinheiro)
                UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
                -- Reverter destino (remover dinheiro)
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
                    -- Refund de receita: devolução de dinheiro recebido = subtrai
                    UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                ELSE
                    -- Receita normal: adiciona
                    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id::uuid;
                END IF;
                
            -- DESPESA
            ELSIF (NEW.type = 'DESPESA') THEN
                IF (NEW.is_refund IS TRUE) THEN
                    -- Refund de despesa: devolução de dinheiro gasto = adiciona
                    UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id::uuid;
                ELSE
                    -- Despesa normal: subtrai
                    UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                END IF;
                
            -- TRANSFERÊNCIA
            ELSIF (NEW.type = 'TRANSFERÊNCIA') THEN
                -- Deduzir origem
                UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
                -- Adicionar destino
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
-- RECALCULAR SALDOS PARA APLICAR CORREÇÃO
-- ==============================================================================

-- Atualizar função de recálculo também
CREATE OR REPLACE FUNCTION public.recalculate_all_balances()
RETURNS void AS $$
DECLARE
    r_account RECORD;
    v_calc_balance NUMERIC;
BEGIN
    -- Desabilitar trigger temporariamente para evitar loops
    ALTER TABLE public.transactions DISABLE TRIGGER trg_update_account_balance;

    -- Loop através de todas as contas
    FOR r_account IN SELECT id, initial_balance, user_id FROM public.accounts WHERE deleted = false LOOP
        
        -- Começar com saldo inicial
        v_calc_balance := COALESCE(r_account.initial_balance, 0);

        -- 1. Adicionar Receitas (considerando refunds)
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(
                CASE WHEN is_refund = TRUE THEN -amount ELSE amount END
            ), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'RECEITA'
            AND deleted = FALSE
        );

        -- 2. Subtrair Despesas (considerando refunds e dívidas compartilhadas)
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

        -- 3. TRANSFERÊNCIAS (Origem - Saída)
        v_calc_balance := v_calc_balance - (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'TRANSFERÊNCIA'
            AND deleted = FALSE
        );

        -- 4. TRANSFERÊNCIAS (Destino - Entrada)
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(COALESCE(destination_amount, amount)), 0)
            FROM public.transactions
            WHERE destination_account_id::uuid = r_account.id 
            AND type = 'TRANSFERÊNCIA'
            AND deleted = FALSE
        );

        -- Atualizar conta
        UPDATE public.accounts 
        SET balance = v_calc_balance 
        WHERE id = r_account.id;
        
    END LOOP;

    -- Reabilitar trigger
    ALTER TABLE public.transactions ENABLE TRIGGER trg_update_account_balance;
END;
$$ LANGUAGE plpgsql;

-- Executar recálculo
SELECT public.recalculate_all_balances();

COMMIT;

-- ==============================================================================
-- NOTAS:
-- ==============================================================================
-- 1. Refund de DESPESA = dinheiro volta para conta (adiciona)
-- 2. Refund de RECEITA = devolução de dinheiro recebido (subtrai)
-- 3. Transferências não têm conceito de refund (usar transferência inversa)
-- ==============================================================================
