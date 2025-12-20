-- ==============================================================================
-- SCRIPT DE PREPARAÇÃO PARA RESTAURAÇÃO DE DADOS
-- DATA: 2025-12-20
-- OBJETIVO: Permitir restauração de dados sem erros de Foreign Key ou auditoria
-- ==============================================================================

-- PARTE 1: DESABILITAR PROTEÇÕES (Execute ANTES de restaurar os dados)
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


-- PARTE 2: REATIVAR PROTEÇÕES E LIMPEZA (Execute APÓS restaurar os dados)
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
      OR total_installments < 2
      OR current_installment IS NULL
      OR current_installment < 1
      OR current_installment > total_installments
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

-- 5. Verificar saúde após restauração
SELECT * FROM verify_financial_integrity(auth.uid());
