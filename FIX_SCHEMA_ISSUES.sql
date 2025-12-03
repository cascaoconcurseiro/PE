-- ========================================
-- CORREÇÕES DE SCHEMA - APPLY THIS SCRIPT
-- ========================================
-- Execute este script no Supabase Dashboard > SQL Editor
-- Corrige inconsistências encontradas na auditoria

-- ========================================
-- 1. CORRIGIR TIPO DO CAMPO payer_id
-- ========================================
-- Problema: Campo definido como UUID mas código usa strings genéricas ("me", "user")
-- Solução: Mudar para TEXT

ALTER TABLE public.transactions 
ALTER COLUMN payer_id TYPE text USING payer_id::text;

COMMENT ON COLUMN public.transactions.payer_id IS 'ID do pagador. Pode ser: UUID de family_member, "me", "user", ou null';

-- ========================================
-- 2. ADICIONAR CAMPOS FALTANTES
-- ========================================
-- Campos que existem no TypeScript mas não no banco

-- Campo para relacionar transação com membro específico
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS related_member_id text;

COMMENT ON COLUMN public.transactions.related_member_id IS 'ID do membro relacionado à transação (ex: acerto de contas)';

-- Campo para rastrear transação que liquidou esta
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS settled_by_tx_id uuid REFERENCES public.transactions(id);

COMMENT ON COLUMN public.transactions.settled_by_tx_id IS 'ID da transação que liquidou esta dívida';

-- Campos para reconciliação bancária
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS reconciled boolean DEFAULT false;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS reconciled_with text;

COMMENT ON COLUMN public.transactions.reconciled IS 'Indica se transação foi reconciliada com extrato bancário';
COMMENT ON COLUMN public.transactions.reconciled_with IS 'Referência do extrato bancário (ex: ID OFX)';

-- ========================================
-- 3. ADICIONAR CAMPOS PARA TRANSFERÊNCIAS MULTI-MOEDA
-- ========================================
-- Estes campos já existem mas vamos garantir

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS destination_amount numeric;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS exchange_rate numeric;

COMMENT ON COLUMN public.transactions.destination_amount IS 'Valor que chega na conta destino (para transferências multi-moeda)';
COMMENT ON COLUMN public.transactions.exchange_rate IS 'Taxa de câmbio aplicada na transferência';

-- ========================================
-- 4. ADICIONAR ÍNDICES PARA NOVOS CAMPOS
-- ========================================

-- Índice para related_member_id
CREATE INDEX IF NOT EXISTS idx_transactions_related_member 
ON public.transactions(related_member_id) 
WHERE related_member_id IS NOT NULL AND deleted = false;

-- Índice para settled_by_tx_id
CREATE INDEX IF NOT EXISTS idx_transactions_settled_by 
ON public.transactions(settled_by_tx_id) 
WHERE settled_by_tx_id IS NOT NULL;

-- Índice para reconciled
CREATE INDEX IF NOT EXISTS idx_transactions_reconciled 
ON public.transactions(user_id, reconciled) 
WHERE deleted = false;

-- ========================================
-- 5. ADICIONAR CONSTRAINTS DE VALIDAÇÃO
-- ========================================

-- Validar que payer_id é UUID válido OU string específica
ALTER TABLE public.transactions 
ADD CONSTRAINT check_payer_id_format 
CHECK (
    payer_id IS NULL OR 
    payer_id IN ('me', 'user') OR 
    payer_id ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
);

-- Validar que exchange_rate é positivo
ALTER TABLE public.transactions 
ADD CONSTRAINT check_exchange_rate_positive 
CHECK (exchange_rate IS NULL OR exchange_rate > 0);

-- Validar que destination_amount é positivo
ALTER TABLE public.transactions 
ADD CONSTRAINT check_destination_amount_positive 
CHECK (destination_amount IS NULL OR destination_amount > 0);

-- ========================================
-- 6. VERIFICAR ALTERAÇÕES
-- ========================================

-- Listar todas as colunas da tabela transactions
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'transactions'
ORDER BY ordinal_position;

-- Listar todos os índices
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND tablename = 'transactions'
ORDER BY indexname;

-- Listar todas as constraints
SELECT
    conname AS constraint_name,
    contype AS constraint_type,
    pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint
WHERE conrelid = 'public.transactions'::regclass
ORDER BY conname;
