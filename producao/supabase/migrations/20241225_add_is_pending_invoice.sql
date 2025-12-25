-- ============================================================================
-- MIGRATION: Adicionar coluna is_pending_invoice
-- ============================================================================
-- Data: 25/12/2024
-- Objetivo: Adicionar coluna para marcar faturas de cartão não pagas
-- 
-- CONTEXTO:
-- Faturas importadas de cartão de crédito não devem aparecer em transações
-- até serem pagas. Precisamos de um campo para identificá-las.
-- ============================================================================

-- PASSO 1: Adicionar coluna is_pending_invoice
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'transactions' 
        AND column_name = 'is_pending_invoice'
    ) THEN
        ALTER TABLE transactions 
        ADD COLUMN is_pending_invoice BOOLEAN DEFAULT false;
        
        RAISE NOTICE 'Coluna is_pending_invoice adicionada com sucesso';
    ELSE
        RAISE NOTICE 'Coluna is_pending_invoice já existe';
    END IF;
END $$;

-- PASSO 2: Criar índice para performance
CREATE INDEX IF NOT EXISTS idx_transactions_pending_invoice 
ON transactions(is_pending_invoice) 
WHERE is_pending_invoice = true AND is_settled = false;

-- PASSO 3: Marcar faturas importadas existentes como pendentes
UPDATE transactions
SET is_pending_invoice = true
WHERE description LIKE 'Fatura Importada%'
  AND is_settled = false
  AND deleted = false
  AND is_pending_invoice IS NOT true;

-- PASSO 4: Verificar resultado
SELECT 
    COUNT(*) as total_faturas_pendentes,
    SUM(amount) as valor_total
FROM transactions
WHERE is_pending_invoice = true
  AND is_settled = false
  AND deleted = false;

-- ============================================================================
-- COMENTÁRIOS:
-- 1. is_pending_invoice = true: Fatura importada, não paga
-- 2. is_pending_invoice = false: Transação normal
-- 3. Quando pagar a fatura: is_settled = true (is_pending_invoice continua true)
-- 4. Filtro: WHERE NOT (is_pending_invoice = true AND is_settled = false)
-- ============================================================================
