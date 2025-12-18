-- ==============================================================================
-- MIGRATION: CONSOLIDAÇÃO FINAL - RPCs E BALANCE
-- DATA: 2026-01-27
-- OBJETIVO: Consolidar todas as funções RPC e triggers em versões definitivas
--           Remover duplicações e garantir sincronização frontend/backend
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: LIMPEZA - REMOVER TODAS AS VERSÕES ANTIGAS
-- ==============================================================================

-- Remover todas as versões antigas de create_transaction
DROP FUNCTION IF EXISTS public.create_transaction(TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, JSONB);
DROP FUNCTION IF EXISTS public.create_transaction(TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT);
DROP FUNCTION IF EXISTS public.create_transaction(TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT);

-- Remover todas as versões antigas de update_transaction
DROP FUNCTION IF EXISTS public.update_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, BOOLEAN, JSONB);
DROP FUNCTION IF EXISTS public.update_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT, BOOLEAN, INTEGER, INTEGER, UUID, BOOLEAN, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.update_transaction(UUID, TEXT, NUMERIC, TEXT, TEXT, DATE, UUID, UUID, UUID, BOOLEAN, TEXT);

-- Remover triggers antigos de balance
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.transactions;
DROP TRIGGER IF EXISTS tr_update_account_balance_v4 ON public.transactions;
DROP TRIGGER IF EXISTS update_account_balance_trigger ON public.transactions;

-- Remover funções antigas de balance
DROP FUNCTION IF EXISTS public.fn_update_account_balance() CASCADE;
DROP FUNCTION IF EXISTS public.update_account_balance_v4() CASCADE;
DROP FUNCTION IF EXISTS public.update_account_balance() CASCADE;

-- ==============================================================================
-- PARTE 2: FUNÇÃO RPC - CREATE_TRANSACTION (VERSÃO DEFINITIVA)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.create_transaction(
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_shared_with JSONB DEFAULT '[]'::jsonb
)
RETURNS UUID AS $$
DECLARE
    v_new_id UUID;
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Validação de autenticação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Domain Resolution: TRAVEL se tem trip, senão PERSONAL
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- Validação de Transferência
    IF p_type = 'TRANSFERÊNCIA' AND p_destination_account_id IS NULL THEN
        RAISE EXCEPTION 'Transferência requer conta de destino.';
    END IF;

    -- Inserção da transação
    INSERT INTO public.transactions (
        description, amount, type, category, date,
        account_id, destination_account_id, trip_id,
        is_shared, domain, user_id,
        is_installment, current_installment, total_installments, series_id,
        is_recurring, frequency,
        shared_with, payer_id,
        created_at, updated_at
    ) VALUES (
        p_description, p_amount, p_type, p_category, p_date,
        p_account_id, p_destination_account_id, p_trip_id,
        p_is_shared, v_final_domain, v_user_id,
        p_is_installment, p_current_installment, p_total_installments, p_series_id,
        p_is_recurring, p_frequency,
        p_shared_with,
        CASE WHEN p_is_shared THEN 'me' ELSE NULL END,
        NOW(), NOW()
    ) RETURNING id INTO v_new_id;

    -- Sincronização de transações compartilhadas (falha silenciosamente se não existir)
    BEGIN
        PERFORM public.sync_shared_transaction(v_new_id);
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '[create_transaction] Sync compartilhado falhou para ID %: %', v_new_id, SQLERRM;
    END;

    RETURN v_new_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 3: FUNÇÃO RPC - UPDATE_TRANSACTION (VERSÃO DEFINITIVA)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.update_transaction(
    p_id UUID,
    p_description TEXT,
    p_amount NUMERIC,
    p_type TEXT,
    p_category TEXT,
    p_date DATE,
    p_account_id UUID DEFAULT NULL,
    p_destination_account_id UUID DEFAULT NULL,
    p_trip_id UUID DEFAULT NULL,
    p_is_shared BOOLEAN DEFAULT FALSE,
    p_domain TEXT DEFAULT NULL,
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL,
    p_is_recurring BOOLEAN DEFAULT FALSE,
    p_frequency TEXT DEFAULT NULL,
    p_is_settled BOOLEAN DEFAULT FALSE,
    p_shared_with JSONB DEFAULT NULL
)
RETURNS VOID AS $$
DECLARE
    v_final_domain TEXT;
    v_user_id UUID := auth.uid();
BEGIN
    -- Validação de autenticação
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Usuário não autenticado.';
    END IF;

    -- Verificar propriedade
    IF NOT EXISTS (SELECT 1 FROM public.transactions WHERE id = p_id AND user_id = v_user_id) THEN
        RAISE EXCEPTION 'Transação não encontrada ou acesso negado.';
    END IF;

    -- Domain Resolution
    IF p_trip_id IS NOT NULL THEN
        v_final_domain := 'TRAVEL';
    ELSE
        v_final_domain := COALESCE(NULLIF(p_domain, ''), 'PERSONAL');
    END IF;

    -- Atualização
    UPDATE public.transactions SET
        description = p_description,
        amount = p_amount,
        type = p_type,
        category = p_category,
        date = p_date,
        account_id = p_account_id,
        destination_account_id = p_destination_account_id,
        trip_id = p_trip_id,
        is_shared = p_is_shared,
        domain = v_final_domain,
        is_installment = p_is_installment,
        current_installment = p_current_installment,
        total_installments = p_total_installments,
        series_id = p_series_id,
        is_recurring = p_is_recurring,
        frequency = p_frequency,
        is_settled = p_is_settled,
        shared_with = COALESCE(p_shared_with, shared_with), -- Manter existente se null
        updated_at = NOW()
    WHERE id = p_id AND user_id = v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 4: TRIGGER DE BALANCE (VERSÃO DEFINITIVA E SIMPLIFICADA)
-- ==============================================================================

-- Função de atualização de saldo (BACKEND COMO FONTE DE VERDADE)
CREATE OR REPLACE FUNCTION public.fn_update_account_balance()
RETURNS TRIGGER AS $$
BEGIN
    -- =========================================================================
    -- LÓGICA: Backend atualiza saldos automaticamente via trigger
    -- Frontend apenas lê account.balance (não recalcula)
    -- =========================================================================

    -- DELETE: Reverter efeito da transação antiga
    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Ignorar se for dívida compartilhada (outro pagou)
        IF NOT (OLD.is_shared IS TRUE AND OLD.payer_id IS NOT NULL AND OLD.payer_id != 'me' AND OLD.payer_id != OLD.user_id::text) THEN
            -- Reverter RECEITA
            IF (OLD.type = 'RECEITA') THEN
                UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id::uuid;
            -- Reverter DESPESA
            ELSIF (OLD.type = 'DESPESA') THEN
                UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id::uuid;
            -- Reverter TRANSFERÊNCIA
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

    -- INSERT/UPDATE: Aplicar efeito da transação nova
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Ignorar se for dívida compartilhada (outro pagou)
        IF NOT (NEW.is_shared IS TRUE AND NEW.payer_id IS NOT NULL AND NEW.payer_id != 'me' AND NEW.payer_id != NEW.user_id::text) THEN
            -- Aplicar RECEITA
            IF (NEW.type = 'RECEITA') THEN
                UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id::uuid;
            -- Aplicar DESPESA
            ELSIF (NEW.type = 'DESPESA') THEN
                UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id::uuid;
            -- Aplicar TRANSFERÊNCIA
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

-- Criar trigger (SEMPRE ATIVO)
CREATE TRIGGER trg_update_account_balance
AFTER INSERT OR UPDATE OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.fn_update_account_balance();

-- ==============================================================================
-- PARTE 5: FUNÇÃO DE RECÁLCULO DE SALDOS (BACKFILL)
-- ==============================================================================

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

        -- 1. Adicionar Receitas
        v_calc_balance := v_calc_balance + (
            SELECT COALESCE(SUM(amount), 0)
            FROM public.transactions
            WHERE account_id::uuid = r_account.id 
            AND type = 'RECEITA'
            AND deleted = FALSE
        );

        -- 2. Subtrair Despesas (exceto dívidas compartilhadas não pagas por mim)
        v_calc_balance := v_calc_balance - (
            SELECT COALESCE(SUM(amount), 0)
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

-- ==============================================================================
-- PARTE 6: FUNÇÕES RPC AUXILIARES (CONSOLIDADAS)
-- ==============================================================================

-- get_account_totals (para compatibilidade, mas backend já mantém balance atualizado)
CREATE OR REPLACE FUNCTION public.get_account_totals(p_user_id UUID)
RETURNS TABLE (account_id UUID, calculated_balance NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        a.id,
        a.balance as calculated_balance  -- Usar balance do banco (já calculado)
    FROM 
        accounts a
    WHERE 
        a.user_id = p_user_id AND a.deleted = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- get_monthly_cashflow
CREATE OR REPLACE FUNCTION public.get_monthly_cashflow(p_year INT, p_user_id UUID)
RETURNS TABLE (month INT, income NUMERIC, expense NUMERIC) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        EXTRACT(MONTH FROM date)::INT as month,
        SUM(CASE WHEN type = 'RECEITA' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN type = 'DESPESA' THEN amount ELSE 0 END) as expense
    FROM 
        transactions
    WHERE 
        user_id = p_user_id
        AND deleted = false
        AND EXTRACT(YEAR FROM date)::INT = p_year
        AND type IN ('RECEITA', 'DESPESA')
        AND category != 'Saldo Inicial / Ajuste'
    GROUP BY 
        EXTRACT(MONTH FROM date)
    ORDER BY 
        month;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- PARTE 7: SINCRONIZAÇÃO INICIAL DE SALDOS
-- ==============================================================================

-- Executar recálculo para sincronizar todos os saldos
SELECT public.recalculate_all_balances();

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS:
-- ==============================================================================
-- 1. Backend é a fonte de verdade para saldos (account.balance)
-- 2. Frontend deve apenas LER account.balance, não recalcular
-- 3. Trigger trg_update_account_balance está SEMPRE ATIVO
-- 4. Funções RPC estão consolidadas em versões definitivas
-- ==============================================================================

