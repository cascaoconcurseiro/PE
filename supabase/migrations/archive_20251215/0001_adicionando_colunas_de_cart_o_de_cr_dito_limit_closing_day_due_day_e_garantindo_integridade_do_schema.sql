-- Corrigir tabela ACCOUNTS (Adicionar suporte a Cartão de Crédito)
ALTER TABLE public.accounts 
ADD COLUMN IF NOT EXISTS "limit" NUMERIC, -- "limit" é palavra reservada, precisa de aspas
ADD COLUMN IF NOT EXISTS closing_day INTEGER,
ADD COLUMN IF NOT EXISTS due_day INTEGER,
ADD COLUMN IF NOT EXISTS initial_balance NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_international BOOLEAN DEFAULT FALSE;

-- Corrigir tabela TRANSACTIONS (Garantir campos de parcelamento e relacionamentos)
ALTER TABLE public.transactions
ADD COLUMN IF NOT EXISTS account_id UUID, -- Garantir que existe
ADD COLUMN IF NOT EXISTS destination_account_id UUID,
ADD COLUMN IF NOT EXISTS trip_id UUID,
ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_installment BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS current_installment INTEGER,
ADD COLUMN IF NOT EXISTS total_installments INTEGER,
ADD COLUMN IF NOT EXISTS original_amount NUMERIC,
ADD COLUMN IF NOT EXISTS series_id TEXT,
ADD COLUMN IF NOT EXISTS enable_notification BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS notification_date DATE,
ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS payer_id TEXT,
ADD COLUMN IF NOT EXISTS is_settled BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_refund BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS destination_amount NUMERIC,
ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC;

-- Corrigir coluna shared_with para JSONB (caso ainda não seja)
DO $$
BEGIN
    -- Se a coluna existe mas não é JSONB (ex: text ou array), tenta converter
    -- Se não existir, cria.
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='transactions' AND column_name='shared_with') THEN
        ALTER TABLE public.transactions ADD COLUMN shared_with JSONB DEFAULT '[]'::jsonb;
    END IF;
END $$;

-- Corrigir tabela ASSETS (Investimentos)
ALTER TABLE public.assets
ADD COLUMN IF NOT EXISTS ticker TEXT,
ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS average_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS current_price NUMERIC DEFAULT 0,
ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'BRL',
ADD COLUMN IF NOT EXISTS account_id UUID,
ADD COLUMN IF NOT EXISTS last_update TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS trade_history JSONB DEFAULT '[]'::jsonb;