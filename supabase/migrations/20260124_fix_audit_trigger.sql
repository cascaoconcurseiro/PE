-- ==============================================================================
-- HOTFIX: AUDIT LOG TRIGGER
-- DATA: 2026-01-24
-- OBJ: Corrigir erro "null value in column action" durante Auditoria/Replay.
--      A tabela audit_logs parece ter ganho uma coluna 'action' obrigatória.
-- ==============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_audit_log_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_entity text;
BEGIN
    -- Map Table Name to Entity
    CASE TG_TABLE_NAME
        WHEN 'transactions' THEN v_entity := 'TRANSACTION';
        WHEN 'accounts' THEN v_entity := 'ACCOUNT';
        WHEN 'trips' THEN v_entity := 'TRIP';
        WHEN 'goals' THEN v_entity := 'GOAL';
        WHEN 'budgets' THEN v_entity := 'BUDGET';
        WHEN 'family_members' THEN v_entity := 'FAMILY';
        ELSE v_entity := UPPER(TG_TABLE_NAME);
    END CASE;

    -- Insert with 'action' populated (Generic Fix)
    -- Se a coluna 'action' existe e é obrigatória, passamos TG_OP.
    -- Se 'operation' também existe, mantemos.
    
    INSERT INTO public.audit_logs (
        entity,
        table_name,
        record_id,
        operation, -- Mantemos operation antigo
        action,    -- Adicionamos action (Novo requirements?)
        old_values,
        new_values,
        changed_by,
        changed_at
    )
    VALUES (
        v_entity,
        TG_TABLE_NAME::text,
        COALESCE(
            CASE WHEN TG_OP = 'DELETE' THEN OLD.id ELSE NEW.id END,
            gen_random_uuid()
        ),
        TG_OP, -- operation
        TG_OP, -- action (Maps to same value)
        CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN row_to_json(OLD) ELSE NULL END,
        CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN row_to_json(NEW) ELSE NULL END,
        COALESCE(
            auth.uid(),
            (CASE WHEN TG_OP = 'DELETE' THEN OLD.user_id ELSE NEW.user_id END),
            '00000000-0000-0000-0000-000000000000'::uuid
        ),
        NOW()
    );

    RETURN NULL;
EXCEPTION
    WHEN undefined_column THEN
        -- Fallback: Se a coluna 'action' ou 'operation' não existir, tentamos apenas a que sobrar?
        -- Mas 'undefined_column' aborta a transação em triggers.
        -- Vamos assumir que ambas existem pois o erro diz 'null value in action'.
        RAISE EXCEPTION 'Audit Log Schema Mismatch. Please check columns of public.audit_logs.';
END;
$$;

COMMIT;
