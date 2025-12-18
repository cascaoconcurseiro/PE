-- ==============================================================================
-- SOFT DELETE PROPAGATION & HEALTH CHECK
-- DATA: 2026-01-24
-- OBJ: Garantir que "Soft Deletes" (lixeira) revertam ações associadas.
--      Ex: Ao excluir a transação de pagamento, o Split deve reabrir.
-- ==============================================================================

BEGIN;

-- 1. TRIGGER: SOFT DELETE REVERSAL
-- ------------------------------------------------------------------------------
-- Correção crítica detectada: O sistema usa "Soft Delete" (deleted=true).
-- A Foreign Key só dispara ações se for "Hard Delete".
-- Precisamos deste trigger para simular o "ON DELETE SET NULL" lógico.

CREATE OR REPLACE FUNCTION public.handle_soft_delete_propagation()
RETURNS TRIGGER AS $$
BEGIN
    -- Se a transação foi enviada para lixeira (Soft Deleted)
    IF (OLD.deleted = FALSE AND NEW.deleted = TRUE) THEN
        
        -- Verificar se ela era pagamento de algum Split
        -- Desvincula o pagamento (NULL) e reabre a dívida (OPEN)
        UPDATE public.transaction_splits
        SET payment_transaction_id = NULL, status = 'OPEN'
        WHERE payment_transaction_id = NEW.id;

    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_propagate_soft_delete ON public.transactions;
CREATE TRIGGER trg_propagate_soft_delete
    AFTER UPDATE ON public.transactions
    FOR EACH ROW
    WHEN (OLD.deleted = FALSE AND NEW.deleted = TRUE)
    EXECUTE FUNCTION public.handle_soft_delete_propagation();


-- 2. HEALTH CHECK (PROACTIVE DIAGNOSTICS)
-- ------------------------------------------------------------------------------
-- Função para verificar se existem links quebrados no sistema.
-- Retorna TEXT com relatório.

CREATE OR REPLACE FUNCTION public.system_health_check()
RETURNS TABLE(issue TEXT, severity TEXT) LANGUAGE plpgsql AS $$
BEGIN
    -- A) Verificar Splits com Pagamentos Deletados mas Status Settled
    RETURN QUERY 
    SELECT 'Split Settled with Deleted Payment', 'HIGH'
    FROM public.transaction_splits s
    JOIN public.transactions t ON t.id = s.payment_transaction_id
    WHERE s.status = 'SETTLED' AND t.deleted = TRUE;

    -- B) Verificar Transações de Viagem sem Domínio Travel
    RETURN QUERY 
    SELECT 'Trip Transaction without TRAVEL domain', 'MEDIUM'
    FROM public.transactions 
    WHERE trip_id IS NOT NULL AND domain != 'TRAVEL' AND deleted = FALSE;

    -- C) Verificar Journal Entries órfãs
    RETURN QUERY 
    SELECT 'Journal Entry without Account', 'LOW'
    FROM public.journal_entries je
    LEFT JOIN public.ledger_accounts la ON la.id = je.ledger_account_id
    WHERE la.id IS NULL;
    
    RETURN;
END;
$$;

COMMIT;
