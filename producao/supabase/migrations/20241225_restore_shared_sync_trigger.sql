-- ============================================
-- RESTAURAR TRIGGER DE SINCRONIZAÇÃO DE TRANSAÇÕES COMPARTILHADAS
-- Data: 2024-12-25
-- Descrição: Recriar trigger que chama sync_shared_transaction automaticamente
--            para criar espelhos quando transações compartilhadas são criadas/atualizadas
-- ============================================

BEGIN;

-- 1. CRIAR FUNÇÃO DO TRIGGER
CREATE OR REPLACE FUNCTION public.handle_shared_transaction_sync()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Apenas processar se for transação compartilhada
    IF NEW.is_shared = true AND NEW.shared_with IS NOT NULL AND jsonb_array_length(NEW.shared_with) > 0 THEN
        -- Chamar função de sincronização
        PERFORM public.sync_shared_transaction(NEW.id);
    END IF;
    
    RETURN NEW;
END;
$$;

-- 2. CRIAR TRIGGER PARA INSERT
DROP TRIGGER IF EXISTS trg_sync_shared_transaction_insert ON public.transactions;
CREATE TRIGGER trg_sync_shared_transaction_insert
    AFTER INSERT ON public.transactions
    FOR EACH ROW
    WHEN (NEW.is_shared = true)
    EXECUTE FUNCTION public.handle_shared_transaction_sync();

-- 3. CRIAR TRIGGER PARA UPDATE
DROP TRIGGER IF EXISTS trg_sync_shared_transaction_update ON public.transactions;
CREATE TRIGGER trg_sync_shared_transaction_update
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    WHEN (NEW.is_shared = true AND (
        OLD.is_shared IS DISTINCT FROM NEW.is_shared OR
        OLD.shared_with IS DISTINCT FROM NEW.shared_with OR
        OLD.amount IS DISTINCT FROM NEW.amount OR
        OLD.description IS DISTINCT FROM NEW.description OR
        OLD.date IS DISTINCT FROM NEW.date
    ))
    EXECUTE FUNCTION public.handle_shared_transaction_sync();

-- 4. LOG
INSERT INTO audit_logs (entity, action, changes, user_id)
VALUES (
    'SYSTEM', 
    'TRIGGER_RESTORE', 
    '{"message": "Restored shared transaction sync triggers", "triggers": ["trg_sync_shared_transaction_insert", "trg_sync_shared_transaction_update"]}',
    auth.uid()
);

COMMIT;

-- ============================================
-- FIM DA RESTAURAÇÃO
-- ============================================
