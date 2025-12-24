-- ==============================================================================
-- MIGRATION: BACKFILL LEDGER FROM LEGACY TRANSACTIONS
-- DATA: 2026-03-01
-- OBJETIVO: Popular a tabela ledger_entries com base nas transações existentes.
-- ==============================================================================

BEGIN;

-- 1. Limpar Ledger (caso tenha sujeira de testes)
TRUNCATE TABLE public.ledger_entries CASCADE;

-- 2. Função Temporária de Migração
CREATE OR REPLACE FUNCTION pg_temp.migrate_all_transactions()
RETURNS VOID AS $$
DECLARE
    r_trans RECORD;
    v_debit_acc UUID;
    v_credit_acc UUID;
    v_receivable_acc UUID;
    v_total_assigned NUMERIC;
    v_my_part NUMERIC;
    v_split RECORD;
    v_counter INTEGER := 0;
BEGIN
    FOR r_trans IN SELECT * FROM public.transactions WHERE deleted = FALSE ORDER BY date ASC LOOP
        
        -- A. Resolver Contas (Mesma lógica do RPC)
        
        -- Conta Asset/Liability (Banco/Cartão)
        SELECT id INTO v_credit_acc FROM public.chart_of_accounts 
        WHERE linked_account_id = r_trans.account_id;

        IF v_credit_acc IS NULL THEN
             -- Criar conta se não existir
            INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
            SELECT user_id, name, CASE WHEN type IN ('CREDIT_CARD', 'LOAN') THEN 'LIABILITY' ELSE 'ASSET' END, id
            FROM public.accounts WHERE id = r_trans.account_id
            RETURNING id INTO v_credit_acc;
        END IF;

        -- Conta Categoria
        SELECT id INTO v_debit_acc FROM public.chart_of_accounts 
        WHERE linked_category = r_trans.category AND user_id = r_trans.user_id;

        IF v_debit_acc IS NULL AND r_trans.category IS NOT NULL THEN
             INSERT INTO public.chart_of_accounts (user_id, name, type, linked_category)
             VALUES (r_trans.user_id, r_trans.category, CASE WHEN r_trans.type = 'RECEITA' THEN 'REVENUE' ELSE 'EXPENSE' END, r_trans.category)
             RETURNING id INTO v_debit_acc;
        END IF;

        -- Conta Receivables
        SELECT id INTO v_receivable_acc FROM public.chart_of_accounts WHERE user_id = r_trans.user_id AND code = '1.2.01';
        IF v_receivable_acc IS NULL THEN
            INSERT INTO public.chart_of_accounts (user_id, name, type, code, is_system)
            VALUES (r_trans.user_id, 'Contas a Receber', 'RECEIVABLE', '1.2.01', TRUE) RETURNING id INTO v_receivable_acc;
        END IF;

        -- B. Inserir no Ledger
        
        IF v_credit_acc IS NOT NULL THEN -- Só migra se tiver conta válida
            
            IF r_trans.type = 'DESPESA' THEN
                IF r_trans.is_shared AND r_trans.shared_with IS NOT NULL THEN
                   -- Lógica Shared (Tenta 'amount' e 'assignedAmount' para compatibilidade)
                   SELECT COALESCE(SUM(COALESCE((value->>'amount'), (value->>'assignedAmount'))::NUMERIC), 0) INTO v_total_assigned
                   FROM jsonb_array_elements(r_trans.shared_with);
                   
                   v_my_part := r_trans.amount - v_total_assigned;
                   
                   -- Minha Parte
                   IF v_my_part > 0 AND v_debit_acc IS NOT NULL THEN
                       INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                       VALUES (r_trans.id, r_trans.user_id, v_debit_acc, v_credit_acc, v_my_part, r_trans.date, r_trans.description || ' (Backfill: Minha Parte)');
                   END IF;
                   
                   -- Receivables
                   FOR v_split IN SELECT * FROM jsonb_array_elements(r_trans.shared_with) LOOP
                       INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                       VALUES (r_trans.id, r_trans.user_id, v_receivable_acc, v_credit_acc, COALESCE((v_split.value->>'amount'), (v_split.value->>'assignedAmount'))::NUMERIC, r_trans.date, 'Backfill: A receber de ' || COALESCE((v_split.value->>'email'), '?'));
                   END LOOP;
                   
                ELSE
                   -- Normal
                   IF v_debit_acc IS NOT NULL THEN
                       INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                       VALUES (r_trans.id, r_trans.user_id, v_debit_acc, v_credit_acc, r_trans.amount, r_trans.date, r_trans.description || ' (Backfill)');
                   END IF;
                END IF;

            ELSIF r_trans.type = 'RECEITA' AND v_debit_acc IS NOT NULL THEN
                -- Inverte D/C
                INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                VALUES (r_trans.id, r_trans.user_id, v_credit_acc, v_debit_acc, r_trans.amount, r_trans.date, r_trans.description || ' (Backfill)');
                
            ELSIF r_trans.type = 'TRANSFERÊNCIA' AND r_trans.destination_account_id IS NOT NULL THEN
                -- Transferência
                DECLARE v_dest_acc UUID;
                BEGIN
                    SELECT id INTO v_dest_acc FROM public.chart_of_accounts WHERE linked_account_id = r_trans.destination_account_id;
                    IF v_dest_acc IS NULL THEN
                        INSERT INTO public.chart_of_accounts (user_id, name, type, linked_account_id)
                        SELECT user_id, name, 'ASSET', id FROM public.accounts WHERE id = r_trans.destination_account_id
                        RETURNING id INTO v_dest_acc;
                    END IF;
                    
                    INSERT INTO public.ledger_entries (transaction_id, user_id, debit_account_id, credit_account_id, amount, occurred_at, description)
                    VALUES (r_trans.id, r_trans.user_id, v_dest_acc, v_credit_acc, r_trans.amount, r_trans.date, r_trans.description || ' (Backfill)');
                END;
            END IF;
            
        END IF;

        v_counter := v_counter + 1;
    END LOOP;
    
    RAISE NOTICE 'Migração concluída. % transações processadas.', v_counter;
END;
$$ LANGUAGE plpgsql;

-- 3. Executar Migração
SELECT pg_temp.migrate_all_transactions();

COMMIT;
