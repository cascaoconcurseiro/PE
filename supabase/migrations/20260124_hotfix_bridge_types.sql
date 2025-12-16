-- ==============================================================================
-- HOTFIX: BRIDGE TRIGGER UUID TYPES
-- DATA: 2026-01-24
-- OBJ: Corrigir erro "operator does not exist: uuid ~ unknown".
--      A coluna account_id já é UUID, então a validação de regex é desnecessária e incompatível.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.process_transaction_into_ledger()
RETURNS TRIGGER AS $$
DECLARE
    v_ledger_id UUID;
    v_dest_ledger_id UUID;
    v_account_id_uuid UUID;
    v_dest_account_id_uuid UUID;
BEGIN
    -- 1. Atribuição Direta (Schema Strict já garante UUID)
    v_account_id_uuid := NEW.account_id;
    v_dest_account_id_uuid := NEW.destination_account_id;

    IF (TG_OP = 'DELETE' OR TG_OP = 'UPDATE') THEN
        -- Remove entradas antigas para garantir consistência no Replay/Update
        DELETE FROM public.journal_entries WHERE transaction_id = OLD.id;
    END IF;

    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        -- Se não tem conta, não gera ledger (Ex: rascunho órfão)
        IF v_account_id_uuid IS NOT NULL THEN
            
            -- Garantir existência da Ledger Account
            SELECT id INTO v_ledger_id FROM public.ledger_accounts WHERE account_id = v_account_id_uuid;
            IF v_ledger_id IS NULL THEN
                INSERT INTO public.ledger_accounts (account_id, balance, user_id) 
                VALUES (v_account_id_uuid, 0, NEW.user_id) 
                RETURNING id INTO v_ledger_id;
            END IF;

            -- Gerar Entries
            IF (NEW.type = 'RECEITA') THEN
                INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, user_id, domain)
                VALUES (v_ledger_id, NEW.id, 'CREDIT', NEW.amount, 'Receita: ' || NEW.description, 'TRANSACTION', NEW.user_id, NEW.domain);
            
            ELSIF (NEW.type = 'DESPESA') THEN
                 INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, user_id, domain)
                VALUES (v_ledger_id, NEW.id, 'DEBIT', NEW.amount, 'Despesa: ' || NEW.description, 'TRANSACTION', NEW.user_id, NEW.domain);
            
            ELSIF (NEW.type = 'TRANSFERÊNCIA') THEN
                -- Saída da Origem
                INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, user_id, domain)
                VALUES (v_ledger_id, NEW.id, 'DEBIT', NEW.amount, 'Transf. Enviada: ' || NEW.description, 'TRANSACTION', NEW.user_id, NEW.domain);
                
                -- Entrada no Destino (Multi-Leg)
                IF (v_dest_account_id_uuid IS NOT NULL) THEN
                    SELECT id INTO v_dest_ledger_id FROM public.ledger_accounts WHERE account_id = v_dest_account_id_uuid;
                    IF v_dest_ledger_id IS NULL THEN
                        INSERT INTO public.ledger_accounts (account_id, balance, user_id) 
                        VALUES (v_dest_account_id_uuid, 0, NEW.user_id) 
                        RETURNING id INTO v_dest_ledger_id;
                    END IF;
                    
                    INSERT INTO public.journal_entries (ledger_account_id, transaction_id, entry_type, amount, description, source_type, user_id, domain)
                    VALUES (v_dest_ledger_id, NEW.id, 'CREDIT', COALESCE(NEW.destination_amount, NEW.amount), 'Transf. Recebida: ' || NEW.description, 'TRANSACTION', NEW.user_id, NEW.domain);
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;
