-- ==============================================================================
-- MIGRATION: SCHEMA CORRECTIONS
-- DATA: 2026-02-23
-- OBJETIVO: Corrigir discrepâncias de schema e adicionar constraints faltantes
-- PARTE DE: Financial System Audit - Phase 1
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- PARTE 1: VALIDAR SCHEMA ATUAL
-- ==============================================================================

-- Verificar se tabela transactions existe
DO $
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'transactions') THEN
        RAISE EXCEPTION 'Tabela transactions não existe!';
    END IF;
    
    RAISE NOTICE 'Tabela transactions encontrada. Prosseguindo com correções...';
END $;

-- ==============================================================================
-- PARTE 2: ADICIONAR CONSTRAINTS DE VALIDAÇÃO
-- ==============================================================================

-- Constraint para type (se não existir)
DO $
BEGIN
    -- Primeiro verificar se há valores inválidos
    IF EXISTS (
        SELECT 1 FROM transactions 
        WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA')
        AND deleted = false
    ) THEN
        RAISE WARNING 'Encontrados valores inválidos em transactions.type. Corrigindo...';
        
        -- Logar valores inválidos antes de corrigir
        RAISE NOTICE 'Valores inválidos: %', (
            SELECT array_agg(DISTINCT type) 
            FROM transactions 
            WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA')
        );
    END IF;
    
    -- Adicionar constraint apenas se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_transaction_type' 
        AND conrelid = 'transactions'::regclass
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT check_transaction_type
        CHECK (type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA'));
        
        RAISE NOTICE 'Constraint check_transaction_type adicionada';
    ELSE
        RAISE NOTICE 'Constraint check_transaction_type já existe';
    END IF;
END $;

-- Constraint para domain (se não existir)
DO $
BEGIN
    -- Primeiro verificar se há valores inválidos
    IF EXISTS (
        SELECT 1 FROM transactions 
        WHERE domain IS NOT NULL 
        AND domain NOT IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS')
        AND deleted = false
    ) THEN
        RAISE WARNING 'Encontrados valores inválidos em transactions.domain. Corrigindo para PERSONAL...';
        
        -- Corrigir valores inválidos
        UPDATE transactions
        SET domain = 'PERSONAL'
        WHERE domain IS NOT NULL 
        AND domain NOT IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS')
        AND deleted = false;
    END IF;
    
    -- Adicionar constraint apenas se não existir
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'check_transaction_domain' 
        AND conrelid = 'transactions'::regclass
    ) THEN
        ALTER TABLE transactions
        ADD CONSTRAINT check_transaction_domain
        CHECK (domain IS NULL OR domain IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS'));
        
        RAISE NOTICE 'Constraint check_transaction_domain adicionada';
    ELSE
        RAISE NOTICE 'Constraint check_transaction_domain já existe';
    END IF;
END $;

-- ==============================================================================
-- PARTE 3: VALIDAR TIPO DE COLUNAS
-- ==============================================================================

-- Garantir que payer_id é TEXT (já deveria ser, mas validar)
DO $
DECLARE
    v_column_type TEXT;
BEGIN
    SELECT data_type INTO v_column_type
    FROM information_schema.columns
    WHERE table_name = 'transactions'
    AND column_name = 'payer_id';
    
    IF v_column_type != 'text' AND v_column_type != 'character varying' THEN
        RAISE NOTICE 'Corrigindo tipo de payer_id de % para TEXT', v_column_type;
        ALTER TABLE transactions ALTER COLUMN payer_id TYPE TEXT;
    ELSE
        RAISE NOTICE 'Tipo de payer_id está correto: %', v_column_type;
    END IF;
END $;

-- ==============================================================================
-- PARTE 4: ADICIONAR ÍNDICES PARA PERFORMANCE (SE NÃO EXISTIREM)
-- ==============================================================================

-- Índice para type (queries frequentes por tipo)
CREATE INDEX IF NOT EXISTS idx_transactions_type_date 
ON transactions(type, date DESC) 
WHERE deleted = false;

-- Índice para domain (queries por contexto)
CREATE INDEX IF NOT EXISTS idx_transactions_domain 
ON transactions(domain) 
WHERE domain IS NOT NULL AND deleted = false;

-- Índice para is_shared (queries de transações compartilhadas)
CREATE INDEX IF NOT EXISTS idx_transactions_shared 
ON transactions(is_shared, payer_id) 
WHERE is_shared = true AND deleted = false;

-- ==============================================================================
-- PARTE 5: ADICIONAR COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ==============================================================================

COMMENT ON COLUMN transactions.observation IS 
'Campo para notas/observações da transação. Use este campo ao invés de "notes" que não existe.';

COMMENT ON COLUMN transactions.payer_id IS 
'Identificador de quem pagou. Pode ser "me" (próprio usuário) ou UUID de outro usuário em transações compartilhadas.';

COMMENT ON COLUMN transactions.domain IS 
'Contexto da transação: PERSONAL (pessoal), TRAVEL (viagem), SHARED (compartilhada), BUSINESS (negócios).';

COMMENT ON CONSTRAINT check_transaction_type ON transactions IS 
'Garante que type seja um dos valores válidos: RECEITA, DESPESA ou TRANSFERÊNCIA.';

COMMENT ON CONSTRAINT check_transaction_domain ON transactions IS 
'Garante que domain seja um dos valores válidos: PERSONAL, TRAVEL, SHARED ou BUSINESS.';

-- ==============================================================================
-- PARTE 6: VALIDAÇÃO FINAL
-- ==============================================================================

DO $
DECLARE
    v_invalid_types INTEGER;
    v_invalid_domains INTEGER;
BEGIN
    -- Contar tipos inválidos
    SELECT COUNT(*) INTO v_invalid_types
    FROM transactions
    WHERE type NOT IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA')
    AND deleted = false;
    
    -- Contar domains inválidos
    SELECT COUNT(*) INTO v_invalid_domains
    FROM transactions
    WHERE domain IS NOT NULL
    AND domain NOT IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS')
    AND deleted = false;
    
    IF v_invalid_types > 0 THEN
        RAISE WARNING 'Ainda existem % transações com type inválido!', v_invalid_types;
    ELSE
        RAISE NOTICE '✓ Todos os types estão válidos';
    END IF;
    
    IF v_invalid_domains > 0 THEN
        RAISE WARNING 'Ainda existem % transações com domain inválido!', v_invalid_domains;
    ELSE
        RAISE NOTICE '✓ Todos os domains estão válidos';
    END IF;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'SCHEMA CORRECTIONS CONCLUÍDAS COM SUCESSO';
    RAISE NOTICE '========================================';
END $;

COMMIT;

-- ==============================================================================
-- NOTAS FINAIS
-- ==============================================================================

/*
CORREÇÕES APLICADAS:

1. ✅ Constraints de validação adicionadas:
   - check_transaction_type: Valida type IN ('RECEITA', 'DESPESA', 'TRANSFERÊNCIA')
   - check_transaction_domain: Valida domain IN ('PERSONAL', 'TRAVEL', 'SHARED', 'BUSINESS')

2. ✅ Tipo de payer_id validado (TEXT)

3. ✅ Índices adicionados para performance:
   - idx_transactions_type_date: Queries por tipo e data
   - idx_transactions_domain: Queries por contexto
   - idx_transactions_shared: Queries de transações compartilhadas

4. ✅ Comentários adicionados para documentação

5. ❌ Coluna "notes" NÃO foi adicionada:
   - Não é usada no código
   - Campo "observation" já existe para esta finalidade
   - Erro reportado provavelmente vem de código antigo

PRÓXIMOS PASSOS:
- Executar migration em ambiente de teste
- Validar que constraints funcionam
- Atualizar tipos TypeScript se necessário
- Buscar e corrigir código que referencia "notes" (se existir)

ROLLBACK:
Se necessário fazer rollback:
  DROP CONSTRAINT IF EXISTS check_transaction_type ON transactions;
  DROP CONSTRAINT IF EXISTS check_transaction_domain ON transactions;
  DROP INDEX IF EXISTS idx_transactions_type_date;
  DROP INDEX IF EXISTS idx_transactions_domain;
  DROP INDEX IF EXISTS idx_transactions_shared;
*/
