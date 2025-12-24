-- NUCLEAR TRIGGER CLEANUP
-- DATA: 2026-03-01
-- OBJETIVO: Remover TODOS os triggers da tabela transactions para eliminar duplicidade oculta.
--           Recriar APENAS os essenciais.

BEGIN;

-- 1. DROP ALL KNOWN TRIGGERS ON TRANSACTIONS
-- Explicitamente removendo tudo que apareceu na sua lista e mais alguns palpites
DROP TRIGGER IF EXISTS trg_audit_transactions ON public.transactions;
DROP TRIGGER IF EXISTS trg_block_mirror_deletion ON public.transactions;
DROP TRIGGER IF EXISTS trg_propagate_deletion ON public.transactions;
DROP TRIGGER IF EXISTS trg_update_transactions_updated_at ON public.transactions;
DROP TRIGGER IF EXISTS trg_validate_domain ON public.transactions;
DROP TRIGGER IF EXISTS trg_generate_installments ON public.transactions;
DROP TRIGGER IF EXISTS trg_process_recurrence ON public.transactions;
DROP TRIGGER IF EXISTS trg_handle_shared_transaction ON public.transactions;

-- 2. DROP FUNCTIONS IF THEY ARE NOT USED ELSEWHERE (Safe cleanup)
DROP FUNCTION IF EXISTS public.audit_transactions_trigger(); 
DROP FUNCTION IF EXISTS public.propagate_deletion_trigger();
-- Não dropamos validate_domain pois é útil, mas removemos o trigger para garantir.

-- 3. RECRIAR APENAS O ESSENCIAL
-- Apenas Updated_at é 100% essencial agora.
-- Domain validation pode esperar. Audit pode esperar.

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_update_transactions_updated_at
    BEFORE UPDATE ON public.transactions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

-- LOG DE CLEANUP
INSERT INTO audit_logs (entity, action, changes, user_id)
VALUES ('SYSTEM', 'TRIGGER_NUKE', '{"message": "Dropped all transaction triggers to fix duplication"}', auth.uid());

COMMIT;
