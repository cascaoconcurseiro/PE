-- ==============================================================================
-- MIGRATION: FIX INSTALLMENTS FUNCTION CONFLICT
-- DATA: 2026-03-02
-- OBJETIVO: Resolver conflito de assinatura da função create_financial_record
--           e garantir suporte completo a parcelas
-- ==============================================================================

BEGIN;

-- Remover a função antiga para evitar ambiguidade
DROP FUNCTION IF EXISTS public.create_financial_record(
    UUID, NUMERIC, TEXT, TIMESTAMP WITH TIME ZONE, TEXT, TEXT, UUID, UUID, JSONB, UUID, TEXT
);

-- Recriar com assinatura completa incluindo campos de parcelas
CREATE OR REPLACE FUNCTION public.create_financial_record(
    p_user_id UUID,
    p_amount NUMERIC,
    p_description TEXT,
    p_date TIMESTAMP WITH TIME ZONE,
    p_type TEXT, -- RECEITA, DESPESA, TRANSFERENCIA
    p_category TEXT,
    p_account_id UUID, -- Origem/Pagamento
    p_destination_account_id UUID DEFAULT NULL, -- Apenas Transferência
    p_splits JSONB DEFAULT NULL, -- Para Shared
    p_trip_id UUID DEFAULT NULL,
    p_notes TEXT DEFAULT NULL,
    -- New Fields for Installments
    p_is_installment BOOLEAN DEFAULT FALSE,
    p_current_installment INTEGER DEFAULT NULL,
    p_total_installments INTEGER DEFAULT NULL,
    p_series_id UUID DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_transaction_id UUID;
    v_debit_acc UUID;
    v_credit_acc UUID;
    v_receivable_acc UUID;
    v_payable_acc UUID;
    v_split RECORD;
    v_total_assigned NUMERIC := 0;
    v_my_part NUMERIC;
BEGIN
    -- 1. Criação do Registro de Contexto (Transactions)
    INSERT INTO public.transactions (
        user_id, description, amount, type, category, date, account_id, 
        destination_account_id, trip_id, notes, shared_with, is_shared, currency,
        -- New Columns for Installments
        is_installment, current_installment, total_installments, series_id
    ) VALUES (
        p_user_id, p_description, p_amount, p_type, p_category, p_date, p_account_id, 
        p_destination_account_id, p_trip_id, p_notes, p_splits, (p_splits IS NOT NULL), 'BRL',
        -- New Values for Installments
        p_is_installment, p_current_installment, p_total_installments, p_series_id
    ) RETURNING id INTO v_transaction_id;

    -- 2. Resolução de Contas (Chart of Accounts)
    
    -- Conta "Real" (Banco/Cartão)
    SELECT id INTO v_credit_acc FROM public.chart_of_accounts 
    WHERE linked_account_id = p_account_id; 

    IF v_credit_acc IS NULL THEN
        -- Tenta criar on-the-fly
        INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
        SELECT user_id, name, CASE WHEN type IN ('CREDIT_CARD', 'LOAN') THEN 'LIABILITY' ELSE 'ASSET' END, id
        FROM public.accounts WHERE id = p_account_id
        RETURNING id INTO v_credit_acc;
    END IF;

    -- Conta de Categoria (Despesa/Receita)
    SELECT id INTO v_debit_acc FROM public.chart_of_accounts 
    WHERE linked_category = p_category AND user_id = p_user_id;

    IF v_debit_acc IS NULL AND p_category IS NOT NULL THEN
         INSERT INTO public.chart_of_accounts (user_id, name, type, linked_category)
         VALUES (p_user_id, p_category, CASE WHEN p_type = 'RECEITA' THEN 'REVENUE' ELSE 'EXPENSE' END, p_category)
         RETURNING id INTO v_debit_acc;
    END IF;
    
    -- Contas de Receivables/Payables (System Accounts)
    SELECT id INTO v_receivable_acc FROM public.chart_of_accounts WHERE user_id = p_user_id AND code = '1.2.01';
    IF v_receivable_acc IS NULL THEN
        INSERT INTO public.chart_of_accounts (user_id, name, type, code, is_system)
        VALUES (p_user_id, 'Contas a Receber', 'RECEIVABLE', '1.2.01', TRUE) RETURNING id INTO v_receivable_acc;
    END IF;

    -- 3. Escrituração (Ledger Entries)
    
    IF p_type = 'DESPESA' THEN
        IF p_splits IS NOT NULL THEN
            -- Lógica de Shared Expenses
            SELECT COALESCE(SUM((value->>'amount')::NUMERIC), 0) INTO v_total_assigned
            FROM jsonb_array_elements(p_splits);
            
            v_my_part := p_amount - v_total_assigned;

            -- 1.1 Minha Despesa
            IF v_my_part > 0 THEN
                INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                VALUES (v_transaction_id, p_user_id, v_debit_acc, v_credit_acc, v_my_part, p_date, p_description || ' (Minha Parte)');
            END IF;

            -- 1.2 Receivables
            FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
                INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                VALUES (v_transaction_id, p_user_id, v_receivable_acc, v_credit_acc, (v_split.value->>'amount')::NUMERIC, p_date, 'A receber de: ' || COALESCE(v_split.value->>'email', 'Desconhecido'));
            END LOOP;

        ELSE
            -- Despesa Simples
            INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
            VALUES (v_transaction_id, p_user_id, v_debit_acc, v_credit_acc, p_amount, p_date, p_description);
        END IF;

    ELSIF p_type = 'RECEITA' THEN
        INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
        VALUES (v_transaction_id, p_user_id, v_credit_acc, v_debit_acc, p_amount, p_date, p_description); 

    ELSIF p_type = 'TRANSFERENCIA' THEN
        DECLARE v_dest_acc UUID;
        BEGIN
            SELECT id INTO v_dest_acc FROM public.chart_of_accounts WHERE linked_account_id = p_destination_account_id;
            IF v_dest_acc IS NULL THEN
                  INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
                  SELECT user_id, name, 'ASSET', id FROM public.accounts WHERE id = p_destination_account_id
                  RETURNING id INTO v_dest_acc;
            END IF;
            
            INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
            VALUES (v_transaction_id, p_user_id, v_dest_acc, v_credit_acc, p_amount, p_date, p_description);
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$;

COMMIT;
