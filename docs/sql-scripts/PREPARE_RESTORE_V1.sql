-- ==============================================================================
-- SCRIPT DE PREPARAÇÃO PARA RESTAURAÇÃO DE DADOS
-- DATA: 2025-12-20
-- OBJETIVO: Permitir restauração de dados sem erros de Foreign Key ou auditoria
-- ==============================================================================

-- PARTE 1: LIMPEZA TOTAL (RESET) - Opcional mas recomendado para Restore Completo
-- ==============================================================================
-- ATENÇÃO: Isso apaga todos os dados das tabelas listadas!
-- Use apenas se estiver fazendo uma restauração completa.

-- TRUNCATE public.transactions, public.accounts, public.trips, public.goals, public.budgets, public.family_members, public.transaction_audit CASCADE;
-- (Comentado por segurança padrão. Se desejar limpar, descomente a linha acima ou execute manualmente).

-- PARTE 2: DESABILITAR PROTEÇÕES (Execute ANTES de restaurar os dados)
-- ==============================================================================

BEGIN;

-- 1. Desabilitar o trigger de auditoria automática
-- Isso evita que registros duplicados sejam criados durante a restauração
ALTER TABLE public.transactions DISABLE TRIGGER trg_audit_transactions;

-- 2. Relaxar a Foreign Key da auditoria para CASCADE (facilita se precisar limpar)
-- Ou simplesmente desabilitar a checagem se for superuser (não disponível em todos os tiers Supabase via Editor)
ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE CASCADE;

-- 3. Desabilitar triggers redundantes que podem causar lentidão ou erros de saldo durante a carga
ALTER TABLE public.transactions DISABLE TRIGGER trg_update_account_balance;

-- Nota: NUNCA use "DISABLE TRIGGER ALL" no Supabase, pois ele tenta desativar gatilhos de sistema e falha por falta de permissão.

COMMIT;

-- [!} PAUSE: Execute seu script de restauração/insert de dados agora.


-- PARTE 3: REATIVAR PROTEÇÕES E LIMPEZA (Execute APÓS restaurar os dados)
-- ==============================================================================

BEGIN;

-- 1. Reabilitar os triggers customizados
ALTER TABLE public.transactions ENABLE TRIGGER trg_audit_transactions;
ALTER TABLE public.transactions ENABLE TRIGGER trg_update_account_balance;

-- 2. Corrigir a função de integridade (tinha um erro de sintaxe)
CREATE OR REPLACE FUNCTION verify_financial_integrity(p_user_id UUID)
RETURNS TABLE (
  issue_type TEXT,
  issue_description TEXT,
  severity TEXT,
  affected_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  
  -- 1. Verificar transações com valor inválido
  SELECT 
    'INVALID_AMOUNT'::TEXT,
    'Transações com valor zero ou negativo'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND amount <= 0

  UNION ALL
  
  -- 2. Verificar transferências sem destino
  SELECT 
    'TRANSFER_NO_DESTINATION'::TEXT,
    'Transferências sem conta de destino'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND type = 'TRANSFERÊNCIA'
    AND destination_account_id IS NULL

  UNION ALL

  -- 3. Verificar transferências circulares
  SELECT 
    'TRANSFER_CIRCULAR'::TEXT,
    'Transferências com origem igual ao destino'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND type = 'TRANSFERÊNCIA'
    AND account_id = destination_account_id

  UNION ALL

  -- 4. Verificar transações órfãs (conta deletada)
  SELECT 
    'ORPHAN_TRANSACTION'::TEXT,
    'Transações com conta de origem inexistente'::TEXT,
    'WARNING'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions t
  WHERE t.user_id = p_user_id 
    AND t.deleted = false
    AND t.account_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM accounts a 
      WHERE a.id = t.account_id 
      AND a.deleted = false
    )

  UNION ALL

  -- 5. Verificar parcelas inconsistentes
  SELECT 
    'INVALID_INSTALLMENT'::TEXT,
    'Parcelas com número inválido'::TEXT,
    'WARNING'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions
  WHERE user_id = p_user_id 
    AND deleted = false
    AND is_installment = true
    AND (
      total_installments IS NULL 
      OR total_installments < 1  -- Corrigido para < 1 conforme constraint
      OR current_installment IS NULL
      OR current_installment < 1
      OR current_installment > total_installments
    )

  UNION ALL
  
  -- 6. Verificar mirrors órfãos ou quebrados (Ghost/Broken Mirrors)
  SELECT 
    'GHOST_MIRROR'::TEXT,
    'Transações compartilhadas inválidas (sem origem)'::TEXT,
    'CRITICAL'::TEXT,
    COUNT(*)::BIGINT
  FROM transactions t
  WHERE t.user_id = p_user_id 
    AND t.deleted = false
    AND (
      -- Caso A: Tem source_id mas o original não existe
      (t.source_transaction_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM transactions t_orig 
        WHERE t_orig.id = t.source_transaction_id 
          AND t_orig.deleted = false
      ))
      OR
      -- Caso B: É compartilhado mas perdeu o source_id (e não é o dono)
      (t.is_shared = true 
       AND t.source_transaction_id IS NULL 
       AND t.description LIKE '%(%)%' -- Heurística de segurança
       AND t.user_id != 'd7f294f7-8651-47f1-844b-9e04fbca0ea5')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Limpar registros de auditoria órfãos
DELETE FROM public.transaction_audit 
WHERE transaction_id NOT IN (SELECT id FROM public.transactions);

-- 4. Restaurar a FK original (ON DELETE SET NULL)
ALTER TABLE public.transaction_audit DROP CONSTRAINT IF EXISTS transaction_audit_transaction_id_fkey;
ALTER TABLE public.transaction_audit ADD CONSTRAINT transaction_audit_transaction_id_fkey 
    FOREIGN KEY (transaction_id) REFERENCES public.transactions(id) ON DELETE SET NULL;

COMMIT;

-- PARTE 4: REPARO ATIVO DE DADOS (Execute se o diagnóstico acima acusar erros)
-- ==============================================================================

-- Desabilitar proteção contra exclusão de mirrors para permitir o reparo
ALTER TABLE public.transactions DISABLE TRIGGER trg_block_mirror_deletion;

BEGIN;

-- 1. Reparar VALORES ZERO OU NEGATIVOS
-- Notas: Transações com valor zero são inúteis, valores negativos são normalizados para positivo
UPDATE transactions 
SET amount = ABS(amount)
WHERE deleted = false AND amount < 0;

UPDATE transactions 
SET deleted = true, 
    description = description || ' (Auto-deletado: Valor Zero)'
WHERE deleted = false AND amount = 0;

-- 2. Reparar TRANSFERÊNCIAS SEM DESTINO OU CIRCULARES
-- Nota: Marcar como deletado para evitar erros de cálculo de saldo
UPDATE transactions 
SET deleted = true,
    description = description || ' (Auto-deletado: Transferência Inválida)'
WHERE deleted = false 
  AND type = 'TRANSFERÊNCIA' 
  AND (destination_account_id IS NULL OR account_id = destination_account_id);

-- 3. Reparar TRANSAÇÕES ÓRFÃS (Sem conta de origem válida)
UPDATE transactions t
SET deleted = true,
    description = description || ' (Auto-deletado: Conta Origem Inexistente)'
WHERE t.deleted = false
  AND t.account_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM accounts a WHERE a.id = t.account_id AND a.deleted = false
  );

-- 4a. Reparar MIRRORS ÓRFÃOS (Fantasmas: espelhos com source_id apontando para nada)
UPDATE transactions t_mirror
SET deleted = true,
    description = description || ' (Auto-deletado: Original Inexistente)'
WHERE t_mirror.deleted = false
  AND t_mirror.source_transaction_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM transactions t_orig 
    WHERE t_orig.id = t_mirror.source_transaction_id 
      AND t_orig.deleted = false
  );

-- 4b. Reparar MIRRORS QUEBRADOS (Fantasmas: source_id NULO mas marcado como compartilhado de outro)
-- Heurística: É compartilhado, NÃO é o dono (pela descrição ou lógica), mas não tem link.
UPDATE transactions 
SET deleted = true,
    description = description || ' (Auto-deletado: Link Quebrado)'
WHERE deleted = false
  AND is_shared = true
  AND source_transaction_id IS NULL
  AND description LIKE '%(%)%' -- Segurança: Garante que tem sufixo de nome (indica mirror)
  AND user_id != 'd7f294f7-8651-47f1-844b-9e04fbca0ea5'; -- Garante que não deleta do Wesley (Dono Master)

-- 5. Reparar PARCELAS INVÁLIDAS
-- Se for parcela mas os dados estiverem corrompidos, removemos o atributo de parcelamento
UPDATE transactions 
SET is_installment = false,
    description = description || ' (Parcelamento removido por inconsistência)'
WHERE deleted = false 
  AND is_installment = true 
  AND (
    total_installments IS NULL 
    OR total_installments < 1 
    OR current_installment IS NULL 
    OR current_installment < 1 
    OR current_installment > total_installments
  );

COMMIT;

-- Reabilitar proteção
ALTER TABLE public.transactions ENABLE TRIGGER trg_block_mirror_deletion;

-- 5. Verificar saúde após REPARO
SELECT * FROM verify_financial_integrity(auth.uid());
