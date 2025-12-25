-- ==============================================================================
-- CORREÇÃO DE INTEGRIDADE DOS DADOS FINANCEIROS
-- DATA: 25/12/2024
-- OBJETIVO: Corrigir problemas identificados na auditoria
-- ATENÇÃO: EXECUTAR APENAS APÓS BACKUP E VALIDAÇÃO
-- ==============================================================================

BEGIN;

-- ==============================================================================
-- 1. BACKUP DE SEGURANÇA
-- ==============================================================================

-- Criar tabelas de backup
CREATE TABLE IF NOT EXISTS backup_transactions_integrity_fix AS
SELECT * FROM transactions WHERE 1=0;

CREATE TABLE IF NOT EXISTS backup_ledger_entries_integrity_fix AS
SELECT * FROM ledger_entries WHERE 1=0;

CREATE TABLE IF NOT EXISTS backup_shared_transaction_mirrors_integrity_fix AS
SELECT * FROM shared_transaction_mirrors WHERE 1=0;

-- Fazer backup dos dados que serão modificados
INSERT INTO backup_transactions_integrity_fix
SELECT * FROM transactions
WHERE deleted = false
AND (
    -- Transações com problemas
    id IN (
        SELECT t.id FROM transactions t
        LEFT JOIN ledger_entries l ON l.transaction_id = t.id
        WHERE t.deleted = false AND l.id IS NULL
    )
    OR
    -- Splits incorretos
    (is_shared = true AND shared_with IS NOT NULL AND (
        SELECT SUM((split->>'assignedAmount')::numeric)
        FROM jsonb_array_elements(shared_with) as split
    ) > amount + 0.01)
    OR
    -- Transferências sem destino
    (type = 'TRANSFERÊNCIA' AND (destination_account_id IS NULL OR destination_account_id = ''))
    OR
    -- Valores inválidos
    (amount IS NULL OR amount <= 0)
);

RAISE NOTICE 'Backup criado com % transações', (SELECT COUNT(*) FROM backup_transactions_integrity_fix);

-- ==============================================================================
-- 2. CORRIGIR SOLICITAÇÕES EXPIRADAS
-- ==============================================================================

-- Marcar solicitações expiradas
UPDATE shared_transaction_requests
SET 
    status = 'EXPIRED',
    updated_at = NOW()
WHERE status = 'PENDING'
AND expires_at < NOW();

RAISE NOTICE 'Solicitações expiradas marcadas: %', (SELECT COUNT(*) FROM shared_transaction_requests WHERE status = 'EXPIRED');

-- ==============================================================================
-- 3. CORRIGIR ESPELHOS NÃO SINCRONIZADOS
-- ==============================================================================

-- Tentar ressincronizar espelhos com erro
UPDATE shared_transaction_mirrors m
SET 
    sync_status = 'PENDING',
    last_sync_at = NOW(),
    sync_error = NULL
WHERE sync_status = 'ERROR'
AND EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = m.original_transaction_id
    AND t.deleted = false
);

RAISE NOTICE 'Espelhos marcados para ressincronização: %', 
    (SELECT COUNT(*) FROM shared_transaction_mirrors WHERE sync_status = 'PENDING');

-- ==============================================================================
-- 4. REMOVER ESPELHOS ÓRFÃOS
-- ==============================================================================

-- Deletar espelhos sem transação original
DELETE FROM shared_transaction_mirrors m
WHERE NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = m.original_transaction_id
);

RAISE NOTICE 'Espelhos órfãos removidos: %', 
    (SELECT COUNT(*) FROM shared_transaction_mirrors m WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id = m.original_transaction_id));

-- ==============================================================================
-- 5. CORRIGIR SOLICITAÇÕES SEM TRANSAÇÃO
-- ==============================================================================

-- Deletar solicitações sem transação
DELETE FROM shared_transaction_requests r
WHERE NOT EXISTS (
    SELECT 1 FROM transactions t
    WHERE t.id = r.transaction_id
);

RAISE NOTICE 'Solicitações órfãs removidas: %',
    (SELECT COUNT(*) FROM shared_transaction_requests r WHERE NOT EXISTS (SELECT 1 FROM transactions t WHERE t.id = r.transaction_id));

-- ==============================================================================
-- 6. CORRIGIR PARCELAS DUPLICADAS
-- ==============================================================================

-- Identificar e manter apenas a primeira parcela de cada duplicata
WITH duplicates AS (
    SELECT 
        series_id,
        current_installment,
        ARRAY_AGG(id ORDER BY created_at) as ids
    FROM transactions
    WHERE is_installment = true
    AND deleted = false
    AND series_id IS NOT NULL
    GROUP BY series_id, current_installment
    HAVING COUNT(*) > 1
)
UPDATE transactions t
SET deleted = true, updated_at = NOW()
FROM duplicates d
WHERE t.id = ANY(d.ids[2:]) -- Manter apenas o primeiro (índice 1)
AND t.series_id = d.series_id
AND t.current_installment = d.current_installment;

RAISE NOTICE 'Parcelas duplicadas removidas: %',
    (SELECT COUNT(*) FROM transactions WHERE deleted = true AND updated_at > NOW() - INTERVAL '1 minute');

-- ==============================================================================
-- 7. CORRIGIR TRANSFERÊNCIAS SEM DESTINO
-- ==============================================================================

-- Marcar transferências sem destino como deletadas
UPDATE transactions
SET 
    deleted = true,
    updated_at = NOW(),
    notes = COALESCE(notes || ' | ', '') || 'Deletada automaticamente: transferência sem conta de destino'
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND (destination_account_id IS NULL OR destination_account_id = '');

RAISE NOTICE 'Transferências sem destino removidas: %',
    (SELECT COUNT(*) FROM transactions WHERE type = 'TRANSFERÊNCIA' AND deleted = true AND notes LIKE '%sem conta de destino%');

-- ==============================================================================
-- 8. CORRIGIR TRANSFERÊNCIAS CIRCULARES
-- ==============================================================================

-- Marcar transferências circulares como deletadas
UPDATE transactions
SET 
    deleted = true,
    updated_at = NOW(),
    notes = COALESCE(notes || ' | ', '') || 'Deletada automaticamente: transferência circular (origem = destino)'
WHERE type = 'TRANSFERÊNCIA'
AND deleted = false
AND account_id = destination_account_id;

RAISE NOTICE 'Transferências circulares removidas: %',
    (SELECT COUNT(*) FROM transactions WHERE type = 'TRANSFERÊNCIA' AND deleted = true AND notes LIKE '%circular%');

-- ==============================================================================
-- 9. CORRIGIR VALORES INVÁLIDOS
-- ==============================================================================

-- Marcar transações com valores inválidos como deletadas
UPDATE transactions
SET 
    deleted = true,
    updated_at = NOW(),
    notes = COALESCE(notes || ' | ', '') || 'Deletada automaticamente: valor inválido (NULL ou <= 0)'
WHERE deleted = false
AND (amount IS NULL OR amount <= 0);

RAISE NOTICE 'Transações com valores inválidos removidas: %',
    (SELECT COUNT(*) FROM transactions WHERE deleted = true AND notes LIKE '%valor inválido%');

-- ==============================================================================
-- 10. CORRIGIR SPLITS MAIORES QUE O TOTAL
-- ==============================================================================

-- Ajustar splits proporcionalmente quando excedem o total
WITH bad_splits AS (
    SELECT 
        id,
        amount,
        shared_with,
        (
            SELECT SUM((split->>'assignedAmount')::numeric)
            FROM jsonb_array_elements(shared_with) as split
        ) as splits_total
    FROM transactions
    WHERE is_shared = true
    AND deleted = false
    AND shared_with IS NOT NULL
    AND (
        SELECT SUM((split->>'assignedAmount')::numeric)
        FROM jsonb_array_elements(shared_with) as split
    ) > amount + 0.01
)
UPDATE transactions t
SET 
    shared_with = (
        SELECT jsonb_agg(
            jsonb_set(
                split,
                '{assignedAmount}',
                to_jsonb(
                    ROUND(
                        ((split->>'assignedAmount')::numeric / bs.splits_total * bs.amount)::numeric,
                        2
                    )
                )
            )
        )
        FROM jsonb_array_elements(bs.shared_with) as split
    ),
    updated_at = NOW(),
    notes = COALESCE(t.notes || ' | ', '') || 'Splits ajustados automaticamente (excediam o total)'
FROM bad_splits bs
WHERE t.id = bs.id;

RAISE NOTICE 'Splits ajustados: %',
    (SELECT COUNT(*) FROM transactions WHERE notes LIKE '%Splits ajustados%');

-- ==============================================================================
-- 11. CRIAR ENTRADAS DE LEDGER FALTANTES
-- ==============================================================================

-- Função para criar entradas de ledger para transações sem ledger
CREATE OR REPLACE FUNCTION create_missing_ledger_entries()
RETURNS INTEGER AS $
DECLARE
    v_count INTEGER := 0;
    r_tx RECORD;
    v_debit_acc UUID;
    v_credit_acc UUID;
BEGIN
    FOR r_tx IN 
        SELECT t.*
        FROM transactions t
        LEFT JOIN ledger_entries l ON l.transaction_id = t.id
        WHERE t.deleted = false
        AND l.id IS NULL
        ORDER BY t.date ASC
    LOOP
        -- RECEITA: Debit ASSET (Banco), Credit REVENUE (Categoria)
        IF r_tx.type = 'RECEITA' THEN
            -- Achar Conta Banco
            SELECT id INTO v_debit_acc 
            FROM chart_of_accounts 
            WHERE linked_account_id = r_tx.account_id 
            AND type = 'ASSET'
            LIMIT 1;
            
            -- Achar Conta Receita
            SELECT id INTO v_credit_acc 
            FROM chart_of_accounts 
            WHERE linked_category = r_tx.category 
            AND type = 'REVENUE' 
            AND user_id = r_tx.user_id
            LIMIT 1;
            
            -- Se não existir, criar conta de receita
            IF v_credit_acc IS NULL THEN
                INSERT INTO chart_of_accounts (user_id, name, type, linked_category)
                VALUES (r_tx.user_id, r_tx.category, 'REVENUE', r_tx.category)
                RETURNING id INTO v_credit_acc;
            END IF;
            
            IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, 
                    amount, occurred_at, domain, trip_id, description
                ) VALUES (
                    r_tx.id, r_tx.user_id, v_debit_acc, v_credit_acc,
                    r_tx.amount, r_tx.date::timestamptz, 
                    COALESCE(r_tx.domain, 'PERSONAL'), r_tx.trip_id, r_tx.description
                );
                v_count := v_count + 1;
            END IF;
            
        -- DESPESA: Debit EXPENSE (Categoria), Credit ASSET/LIABILITY (Banco/Cartão)
        ELSIF r_tx.type = 'DESPESA' THEN
            -- Achar Conta Despesa
            SELECT id INTO v_debit_acc 
            FROM chart_of_accounts 
            WHERE linked_category = r_tx.category 
            AND type = 'EXPENSE' 
            AND user_id = r_tx.user_id
            LIMIT 1;
            
            -- Se não existir, criar conta de despesa
            IF v_debit_acc IS NULL THEN
                INSERT INTO chart_of_accounts (user_id, name, type, linked_category)
                VALUES (r_tx.user_id, r_tx.category, 'EXPENSE', r_tx.category)
                RETURNING id INTO v_debit_acc;
            END IF;
            
            -- Achar Conta Banco/Cartão
            SELECT id INTO v_credit_acc 
            FROM chart_of_accounts 
            WHERE linked_account_id = r_tx.account_id 
            AND type IN ('ASSET', 'LIABILITY')
            LIMIT 1;
            
            IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, 
                    amount, occurred_at, domain, trip_id, description
                ) VALUES (
                    r_tx.id, r_tx.user_id, v_debit_acc, v_credit_acc,
                    r_tx.amount, r_tx.date::timestamptz, 
                    COALESCE(r_tx.domain, 'PERSONAL'), r_tx.trip_id, r_tx.description
                );
                v_count := v_count + 1;
            END IF;
            
        -- TRANSFERÊNCIA: Debit ASSET (Destino), Credit ASSET (Origem)
        ELSIF r_tx.type = 'TRANSFERÊNCIA' THEN
            -- Achar Conta Origem
            SELECT id INTO v_credit_acc 
            FROM chart_of_accounts 
            WHERE linked_account_id = r_tx.account_id 
            AND type IN ('ASSET', 'LIABILITY')
            LIMIT 1;
            
            -- Achar Conta Destino
            SELECT id INTO v_debit_acc 
            FROM chart_of_accounts 
            WHERE linked_account_id = r_tx.destination_account_id 
            AND type IN ('ASSET', 'LIABILITY')
            LIMIT 1;
            
            IF v_debit_acc IS NOT NULL AND v_credit_acc IS NOT NULL THEN
                INSERT INTO ledger_entries (
                    transaction_id, user_id, debit_account_id, credit_account_id, 
                    amount, occurred_at, domain, trip_id, description
                ) VALUES (
                    r_tx.id, r_tx.user_id, v_debit_acc, v_credit_acc,
                    r_tx.amount, r_tx.date::timestamptz, 
                    COALESCE(r_tx.domain, 'PERSONAL'), r_tx.trip_id, r_tx.description
                );
                v_count := v_count + 1;
            END IF;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$ LANGUAGE plpgsql;

-- Executar criação de entradas de ledger
SELECT create_missing_ledger_entries() as ledger_entries_created;

-- ==============================================================================
-- 12. RECALCULAR SALDOS DAS CONTAS
-- ==============================================================================

-- Função para recalcular saldos
CREATE OR REPLACE FUNCTION recalculate_account_balances()
RETURNS INTEGER AS $
DECLARE
    v_count INTEGER := 0;
    r_acc RECORD;
    v_calculated_balance NUMERIC;
BEGIN
    FOR r_acc IN SELECT * FROM accounts WHERE deleted = false LOOP
        -- Calcular saldo baseado em transações
        SELECT 
            r_acc.initial_balance + COALESCE(SUM(
                CASE 
                    WHEN t.type = 'RECEITA' THEN 
                        CASE WHEN t.is_refund THEN -t.amount ELSE t.amount END
                    WHEN t.type = 'DESPESA' THEN 
                        CASE WHEN t.is_refund THEN t.amount ELSE -t.amount END
                    WHEN t.type = 'TRANSFERÊNCIA' AND t.account_id = r_acc.id THEN -t.amount
                    WHEN t.type = 'TRANSFERÊNCIA' AND t.destination_account_id = r_acc.id THEN 
                        COALESCE(t.destination_amount, t.amount)
                    ELSE 0
                END
            ), 0)
        INTO v_calculated_balance
        FROM transactions t
        WHERE (t.account_id = r_acc.id OR t.destination_account_id = r_acc.id)
        AND t.deleted = false
        AND NOT (t.is_shared = true AND t.payer_id IS NOT NULL AND t.payer_id != 'me');
        
        -- Atualizar se houver diferença
        IF ABS(r_acc.balance - v_calculated_balance) >= 0.01 THEN
            UPDATE accounts
            SET 
                balance = v_calculated_balance,
                updated_at = NOW()
            WHERE id = r_acc.id;
            
            v_count := v_count + 1;
        END IF;
    END LOOP;
    
    RETURN v_count;
END;
$ LANGUAGE plpgsql;

-- Executar recálculo de saldos
SELECT recalculate_account_balances() as accounts_updated;

-- ==============================================================================
-- 13. VALIDAÇÃO FINAL
-- ==============================================================================

-- Verificar se ainda existem problemas
DO $
DECLARE
    v_problems INTEGER := 0;
BEGIN
    -- Contar problemas restantes
    SELECT 
        (SELECT COUNT(*) FROM transactions t LEFT JOIN ledger_entries l ON l.transaction_id = t.id WHERE t.deleted = false AND l.id IS NULL) +
        (SELECT COUNT(*) FROM transactions WHERE is_shared = true AND deleted = false AND shared_with IS NOT NULL AND (SELECT SUM((split->>'assignedAmount')::numeric) FROM jsonb_array_elements(shared_with) as split) > amount + 0.01) +
        (SELECT COUNT(*) FROM transactions WHERE type = 'TRANSFERÊNCIA' AND deleted = false AND (destination_account_id IS NULL OR destination_account_id = '')) +
        (SELECT COUNT(*) FROM transactions WHERE deleted = false AND (amount IS NULL OR amount <= 0))
    INTO v_problems;
    
    IF v_problems = 0 THEN
        RAISE NOTICE '✅ CORREÇÃO CONCLUÍDA COM SUCESSO! Nenhum problema restante.';
    ELSE
        RAISE WARNING '⚠️ Ainda existem % problemas. Revisar manualmente.', v_problems;
    END IF;
END;
$;

-- ==============================================================================
-- 14. COMMIT OU ROLLBACK
-- ==============================================================================

-- ATENÇÃO: Descomentar apenas UMA das linhas abaixo

-- COMMIT; -- Aplicar correções
-- ROLLBACK; -- Desfazer correções

RAISE NOTICE '⚠️ TRANSAÇÃO ABERTA! Execute COMMIT para aplicar ou ROLLBACK para desfazer.';
