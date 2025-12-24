-- ==============================================================================
-- MIGRATION: ARCHITECTURE RESET & LEDGER IMPLEMENTATION
-- DATA: 2026-03-01
-- OBJETIVO: Implementar arquitetura Ledger-First limpa, removendo legados.
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. LIMPEZA RADICAL (CLEANUP)
-- ==============================================================================

-- Remover Triggers Antigos/Duplicados
DROP TRIGGER IF EXISTS trg_sync_ddd_ledger ON public.transactions;
DROP TRIGGER IF EXISTS sync_transaction_to_ddd_ledger ON public.transactions;
DROP TRIGGER IF EXISTS trg_validate_splits ON public.transaction_splits;
DROP TRIGGER IF EXISTS trg_update_account_balance ON public.transactions;

-- Remover Funções Obsoletas
DROP FUNCTION IF EXISTS public.sync_transaction_to_ddd_ledger();
DROP FUNCTION IF EXISTS public.validate_transaction_splits();
DROP FUNCTION IF EXISTS public.create_shared_payer_ledger_entries(UUID, UUID, NUMERIC, NUMERIC, TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.create_shared_acceptor_ledger_entries(UUID, UUID, NUMERIC, TEXT, UUID, TIMESTAMP WITH TIME ZONE, TEXT, UUID, TEXT);
DROP FUNCTION IF EXISTS public.validate_ledger_balance(UUID);

-- ==============================================================================
-- 2. GARANTIA DE ESTRUTURA (SCHEMA)
-- ==============================================================================

-- Garantir Chart of Accounts
CREATE TABLE IF NOT EXISTS public.chart_of_accounts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE', 'RECEIVABLE', 'PAYABLE')),
    code TEXT, 
    parent_id UUID REFERENCES public.chart_of_accounts(id),
    linked_account_id UUID REFERENCES public.accounts(id) ON DELETE SET NULL,
    linked_category TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted BOOLEAN DEFAULT FALSE,
    CONSTRAINT code_unique_per_user UNIQUE (user_id, code) DEFERRABLE INITIALLY DEFERRED
);

-- Garantir Ledger Entries
CREATE TABLE IF NOT EXISTS public.ledger_entries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    transaction_id UUID, -- Link opcional mas recomendado
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    debit_account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
    credit_account_id UUID REFERENCES public.chart_of_accounts(id) NOT NULL,
    amount NUMERIC NOT NULL CHECK (amount > 0),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    posted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    domain TEXT DEFAULT 'PERSONAL',
    trip_id UUID,
    description TEXT,
    metadata JSONB DEFAULT '{}'::jsonb,
    archived BOOLEAN DEFAULT FALSE
);

-- Índices essenciais
CREATE INDEX IF NOT EXISTS idx_ledger_entries_transaction ON public.ledger_entries(transaction_id);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_user_date ON public.ledger_entries(user_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_ledger_entries_accounts ON public.ledger_entries(debit_account_id, credit_account_id);

-- ==============================================================================
-- 3. INTERFACE DE ESCRITA (RPC)
-- ==============================================================================

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
    p_notes TEXT DEFAULT NULL
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
    -- Isso mantém a compatibilidade com a UI atual enquanto migramos
    INSERT INTO public.transactions (
        user_id, description, amount, type, category, date, account_id, 
        destination_account_id, trip_id, notes, shared_with, is_shared, currency
    ) VALUES (
        p_user_id, p_description, p_amount, p_type, p_category, p_date, p_account_id, 
        p_destination_account_id, p_trip_id, p_notes, p_splits, (p_splits IS NOT NULL), 'BRL'
    ) RETURNING id INTO v_transaction_id;

    -- 2. Resolução de Contas (Chart of Accounts)
    
    -- Conta "Real" (Banco/Cartão)
    SELECT id INTO v_credit_acc FROM public.chart_of_accounts 
    WHERE linked_account_id = p_account_id; -- Normalmente Crédito em Despesa (Sai Dinheiro/Aumenta Dívida)

    IF v_credit_acc IS NULL THEN
        -- Tenta criar on-the-fly se for conta existente no sistema antigo
        INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
        SELECT id, name, CASE WHEN type IN ('CREDIT_CARD', 'LOAN') THEN 'LIABILITY' ELSE 'ASSET' END, id
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
            -- Lógica de Shared Expenses (Complexa)
            
            -- Calcular total repassado a terceiros
            SELECT COALESCE(SUM((value->>'amount')::NUMERIC), 0) INTO v_total_assigned
            FROM jsonb_array_elements(p_splits);
            
            v_my_part := p_amount - v_total_assigned;

            -- A. Minha Parte (Despesa Real)
            -- D: Despesa
            -- C: Banco/Cartão (Proporcional? Não, no ledger do Payer sai TUDO do banco. Ajustamos abaixo)
            
            -- Vamos modelar o FLUXO FINANCEIRO REAL DO PAGADOR:
            -- Saiu R$ Total do Banco.
            -- R$ X virou Despesa Minha.
            -- R$ Y virou Direito de Receber (Receivable).
            
            -- Entry 1: Saída Total do Banco (Credit Asset) vs Vários Débitos
            
            -- 1.1 Minha Despesa
            IF v_my_part > 0 THEN
                INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                VALUES (v_transaction_id, p_user_id, v_debit_acc, v_credit_acc, v_my_part, p_date, p_description || ' (Minha Parte)');
            END IF;

            -- 1.2 Receivables (Para cada pessoa que deve)
            FOR v_split IN SELECT * FROM jsonb_array_elements(p_splits) LOOP
                INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                VALUES (v_transaction_id, p_user_id, v_receivable_acc, v_credit_acc, (v_split.value->>'amount')::NUMERIC, p_date, 'A receber de: ' || (v_split.value->>'email'));
                
                -- Opcional: Já criar a "Obrigação" no Ledger do outro usuário se ele existir no sistema?
                -- Por enquanto, focamos no Ledger do Payer. O "Accept" do outro usuário geraria a contraparte.
            END LOOP;

        ELSE
            -- Despesa Simples
            INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
            VALUES (v_transaction_id, p_user_id, v_debit_acc, v_credit_acc, p_amount, p_date, p_description);
        END IF;

    ELSIF p_type = 'RECEITA' THEN
        -- Inverte lógica: D: Banco, C: Receita
        -- O v_credit_acc acima pegou o banco. Vamos chamar de v_asset_acc para clareza, mas é o mesmo ID.
        INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
        VALUES (v_transaction_id, p_user_id, v_credit_acc, v_debit_acc, p_amount, p_date, p_description); 

    ELSIF p_type = 'TRANSFERENCIA' THEN
        -- D: Destino, C: Origem
        DECLARE v_dest_acc UUID;
        BEGIN
            SELECT id INTO v_dest_acc FROM public.chart_of_accounts WHERE linked_account_id = p_destination_account_id;
            IF v_dest_acc IS NULL THEN
                  INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
                  SELECT id, name, 'ASSET', id FROM public.accounts WHERE id = p_destination_account_id
                  RETURNING id INTO v_dest_acc;
            END IF;
            
            INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
            VALUES (v_transaction_id, p_user_id, v_dest_acc, v_credit_acc, p_amount, p_date, p_description);
        END;
    END IF;

    RETURN jsonb_build_object('success', true, 'transaction_id', v_transaction_id);
END;
$$;

-- ==============================================================================
-- 4. VIEWS DE LEITURA (O NOVO "GET_BALANCE")
-- ==============================================================================

CREATE OR REPLACE VIEW public.view_account_balances AS
SELECT 
    l.user_id,
    c.linked_account_id as account_id,
    SUM(
        CASE 
            WHEN l.debit_account_id = c.id THEN l.amount  -- Se Debitou Ativo, Aumentou (Depósito)
            WHEN l.credit_account_id = c.id THEN -l.amount -- Se Creditou Ativo, Diminuiu (Saque)
            ELSE 0 
        END
    ) as balance
FROM public.ledger_entries l
JOIN public.chart_of_accounts c ON c.id IN (l.debit_account_id, l.credit_account_id)
WHERE c.type IN ('ASSET', 'LIABILITY') -- Apenas contas "Reais"
  AND l.archived = FALSE
GROUP BY l.user_id, c.linked_account_id;

COMMIT;
